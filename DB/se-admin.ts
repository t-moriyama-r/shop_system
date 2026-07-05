import { and, eq } from 'drizzle-orm'

import { db } from './client'
import { auditLogs, seAdminUsers, sessions } from './schema'

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
  const condition = isUuid(normalized)
    ? and(eq(seAdminUsers.seAdminUserId, normalized), eq(seAdminUsers.isDeleted, false))
    : and(eq(seAdminUsers.email, normalized), eq(seAdminUsers.isDeleted, false))

  const [target] = await db
    .select({ seAdminUserId: seAdminUsers.seAdminUserId, email: seAdminUsers.email })
    .from(seAdminUsers)
    .where(condition)

  if (!target) {
    throw new SeAdminDeleteError(`対象のSE管理者アカウントが見つかりません: ${normalized}`)
  }

  const now = new Date()
  await db
    .update(seAdminUsers)
    .set({ isDeleted: true, deletedAt: now, updatedAt: now })
    .where(eq(seAdminUsers.seAdminUserId, target.seAdminUserId))

  // 該当ユーザーの既存セッションを無効化する。
  const invalidatedSessions = await db
    .delete(sessions)
    .where(eq(sessions.seAdminUserId, target.seAdminUserId))
    .returning({ sessionId: sessions.sessionId })

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
    invalidatedSessionCount: invalidatedSessions.length,
  }
}
