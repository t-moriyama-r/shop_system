import { and, asc, count, desc, eq, ilike, type SQL } from 'drizzle-orm'

import { db } from './client'
import { auditLogs, seAdminUsers } from './schema'
import { deleteSessionsForUser } from './sessions'

export type SeAdminUser = typeof seAdminUsers.$inferSelect

// 一般的なメールアドレス形式の簡易チェック（空白なし・@・ドメインにドット）。
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// UUID v4 形式（削除コマンドの引数がメールアドレスか ID かの判定に使う）。
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email)
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}

/**
 * SE管理者アカウント追加時の入力・重複エラー。CLI 側で終了コードの出し分けに使う。
 */
export class SeAdminCreateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SeAdminCreateError'
  }
}

export interface CreatedSeAdmin {
  seAdminUserId: string
  email: string
}

/**
 * SE管理者アカウントを追加する（DB への直接書き込み）。
 *
 * 不正アクセスのリスクを抑えるため、追加は Web 画面ではなく CLI からのみ行う運用。
 * `password` は NULL（パスワード未設定 = 初回ログイン時に画面で設定）で作成し、
 * `audit_logs` に `SE_ADMIN_CREATE`（operator_type=cli）を記録する。
 *
 * @throws {SeAdminCreateError} メール形式が不正、または既に同一メールが存在する場合
 */
export async function createSeAdmin(email: string): Promise<CreatedSeAdmin> {
  const normalizedEmail = email.trim()

  if (!isValidEmail(normalizedEmail)) {
    throw new SeAdminCreateError(`メールアドレスの形式が不正です: ${email}`)
  }

  // email はユニーク制約があり論理削除済みレコードも枠を占有するため、is_deleted で絞らず存在確認する。
  const existing = await db
    .select({ seAdminUserId: seAdminUsers.seAdminUserId })
    .from(seAdminUsers)
    .where(eq(seAdminUsers.email, normalizedEmail))

  if (existing.length > 0) {
    throw new SeAdminCreateError(`既に登録済みのメールアドレスです: ${normalizedEmail}`)
  }

  const [created] = await db
    .insert(seAdminUsers)
    .values({ email: normalizedEmail })
    .returning({ seAdminUserId: seAdminUsers.seAdminUserId, email: seAdminUsers.email })

  await db.insert(auditLogs).values({
    operatorType: 'cli',
    actionType: 'SE_ADMIN_CREATE',
    targetType: 'se_admin_user',
    targetId: created.seAdminUserId,
    result: 'SUCCESS',
    detail: `CLI による SE 管理者アカウント追加: ${created.email}`,
  })

  return created
}

/**
 * SE管理者アカウント削除時の入力・存在エラー。CLI 側で終了コードの出し分けに使う。
 */
export class SeAdminDeleteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SeAdminDeleteError'
  }
}

export interface DeletedSeAdmin {
  seAdminUserId: string
  email: string
  invalidatedSessionCount: number
}

/**
 * SE管理者アカウントを削除する（DB への直接書き込み・論理削除）。
 *
 * 追加と同様、不正アクセスのリスクを抑えるため CLI からのみ行う運用。
 * `is_deleted=true`/`deleted_at` を立てる論理削除とし、該当ユーザーの既存セッションを
 * 無効化（`sessions` から削除）したうえで、`audit_logs` に `SE_ADMIN_DELETE`
 * （operator_type=cli）を記録する。
 *
 * @param identifier 削除対象のメールアドレスまたは SE管理者ユーザーID（UUID）
 * @throws {SeAdminDeleteError} 引数が空、または対象アカウントが見つからない場合
 */
export async function deleteSeAdmin(identifier: string): Promise<DeletedSeAdmin> {
  const normalized = identifier.trim()

  if (!normalized) {
    throw new SeAdminDeleteError('削除対象のメールアドレスまたはIDを指定してください。')
  }

  // 論理削除済みは対象外（is_deleted=false のみ）。引数が UUID なら ID、それ以外はメールで検索する。
  const target = isUuid(normalized)
    ? await findActiveSeAdminById(normalized)
    : await findActiveSeAdminByEmail(normalized)

  if (!target) {
    throw new SeAdminDeleteError(`対象のSE管理者アカウントが見つかりません: ${normalized}`)
  }

  const invalidatedSessionCount = await softDeleteSeAdminUser(target.seAdminUserId)

  await db.insert(auditLogs).values({
    operatorType: 'cli',
    actionType: 'SE_ADMIN_DELETE',
    targetType: 'se_admin_user',
    targetId: target.seAdminUserId,
    result: 'SUCCESS',
    detail: `CLI による SE 管理者アカウント削除（論理削除）: ${target.email}`,
  })

  return {
    seAdminUserId: target.seAdminUserId,
    email: target.email,
    invalidatedSessionCount,
  }
}

// ---------------------------------------------------------------------------
// データアクセス関数（Backend の route/middleware から利用する）
//
// route ハンドラ直下にクエリを書かず、ここに集約する（coder-guidelines 参照）。
// HTTP の関心事（バリデーション・レスポンス整形・監査ログの IP/UA 付与）は呼び出し側に残す。
// ---------------------------------------------------------------------------

const SORTABLE_COLUMNS = {
  createdAt: seAdminUsers.createdAt,
  email: seAdminUsers.email,
  lastLoginAt: seAdminUsers.lastLoginAt,
} as const

function parseSort(value: string | undefined) {
  const [rawColumn, rawDirection] = (value ?? '').split(':')
  const column =
    rawColumn in SORTABLE_COLUMNS
      ? SORTABLE_COLUMNS[rawColumn as keyof typeof SORTABLE_COLUMNS]
      : SORTABLE_COLUMNS.createdAt
  const direction = rawDirection === 'asc' ? asc : desc
  return direction(column)
}

export interface SeAdminListItem {
  seAdminUserId: string
  email: string
  isLocked: boolean
  failedLoginCount: number
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface SeAdminListFilters {
  keyword?: string
  isLocked?: boolean
  sort?: string
  page: number
  limit: number
}

/**
 * SE管理者アカウント一覧を取得する（論理削除済みは除外、password は返さない）。
 */
export async function listSeAdminUsers(
  filters: SeAdminListFilters,
): Promise<{ rows: SeAdminListItem[]; total: number }> {
  const conditions: SQL[] = [eq(seAdminUsers.isDeleted, false)]
  if (filters.keyword) {
    conditions.push(ilike(seAdminUsers.email, `%${filters.keyword}%`))
  }
  if (typeof filters.isLocked === 'boolean') {
    conditions.push(eq(seAdminUsers.isLocked, filters.isLocked))
  }

  const whereClause = and(...conditions)
  const orderBy = parseSort(filters.sort)

  const rows = await db
    .select({
      seAdminUserId: seAdminUsers.seAdminUserId,
      email: seAdminUsers.email,
      isLocked: seAdminUsers.isLocked,
      failedLoginCount: seAdminUsers.failedLoginCount,
      lastLoginAt: seAdminUsers.lastLoginAt,
      createdAt: seAdminUsers.createdAt,
      updatedAt: seAdminUsers.updatedAt,
    })
    .from(seAdminUsers)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(filters.limit)
    .offset((filters.page - 1) * filters.limit)

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(seAdminUsers)
    .where(whereClause)

  return { rows, total }
}

/**
 * 論理削除されていない SE管理者アカウントを ID で取得する。
 */
export async function findActiveSeAdminById(
  seAdminUserId: string,
): Promise<SeAdminUser | undefined> {
  const [user] = await db
    .select()
    .from(seAdminUsers)
    .where(and(eq(seAdminUsers.seAdminUserId, seAdminUserId), eq(seAdminUsers.isDeleted, false)))
  return user
}

/**
 * 論理削除されていない SE管理者アカウントをメールアドレスで取得する。
 */
export async function findActiveSeAdminByEmail(email: string): Promise<SeAdminUser | undefined> {
  const [user] = await db
    .select()
    .from(seAdminUsers)
    .where(and(eq(seAdminUsers.email, email), eq(seAdminUsers.isDeleted, false)))
  return user
}

/**
 * SE管理者アカウントを論理削除し、該当ユーザーの既存セッションを無効化する。
 * 監査ログの記録は呼び出し側の責務（CLI/API で operator_type や詳細が異なるため）。
 *
 * @returns 無効化した（削除した）セッション数
 */
export async function softDeleteSeAdminUser(seAdminUserId: string): Promise<number> {
  const now = new Date()
  await db
    .update(seAdminUsers)
    .set({ isDeleted: true, deletedAt: now, updatedAt: now })
    .where(eq(seAdminUsers.seAdminUserId, seAdminUserId))

  return deleteSessionsForUser(seAdminUserId)
}

/**
 * SE管理者アカウントのロック状態を更新する。ロック解除時は連続失敗カウントもリセットする。
 */
export async function setSeAdminLock(seAdminUserId: string, isLocked: boolean): Promise<void> {
  const now = new Date()
  await db
    .update(seAdminUsers)
    .set({
      isLocked,
      ...(isLocked ? {} : { failedLoginCount: 0 }),
      updatedAt: now,
    })
    .where(eq(seAdminUsers.seAdminUserId, seAdminUserId))
}

/**
 * ログイン成功時の更新（最終ログイン日時の記録・連続失敗カウントのリセット）。
 */
export async function recordSuccessfulLogin(
  seAdminUserId: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(seAdminUsers)
    .set({ lastLoginAt: now, failedLoginCount: 0, updatedAt: now })
    .where(eq(seAdminUsers.seAdminUserId, seAdminUserId))
}

/**
 * ログイン失敗時の更新（連続失敗カウント・ロック状態の反映）。
 */
export async function applyFailedLoginAttempt(
  seAdminUserId: string,
  failedLoginCount: number,
  isLocked: boolean,
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(seAdminUsers)
    .set({ failedLoginCount, isLocked, updatedAt: now })
    .where(eq(seAdminUsers.seAdminUserId, seAdminUserId))
}

/**
 * パスワード（ハッシュ済み）を設定する。
 */
export async function setSeAdminPassword(
  seAdminUserId: string,
  hashedPassword: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(seAdminUsers)
    .set({ password: hashedPassword, updatedAt: now })
    .where(eq(seAdminUsers.seAdminUserId, seAdminUserId))
}
