import { and, asc, count, desc, eq, ilike, lt, or, sql, type SQL } from 'drizzle-orm'

import { db } from './client'
import { emailNotificationLogs, shopAccounts } from './schema'

export type EmailNotificationLog = typeof emailNotificationLogs.$inferSelect

// ショップアカウントの取りうるステータス。バリデーションと型付けに使う。
export const SHOP_ACCOUNT_STATUSES = ['active', 'pending', 'suspended'] as const
export type ShopAccountStatus = (typeof SHOP_ACCOUNT_STATUSES)[number]

export function isShopAccountStatus(value: string): value is ShopAccountStatus {
  return (SHOP_ACCOUNT_STATUSES as readonly string[]).includes(value)
}

// アカウント発行完了通知の種別（email_notification_logs.notification_type）。
export const SHOP_ACCOUNT_ISSUED_NOTIFICATION = 'SHOP_ACCOUNT_ISSUED'

// ---------------------------------------------------------------------------
// データアクセス関数（Backend の route/handler から利用する）。
//
// route/handler 直下にクエリを書かず、ここに集約する（coder-guidelines 参照）。
// initial_password_hash は秘匿情報のため、参照系の select には一切含めない。
// ---------------------------------------------------------------------------

// レスポンスに載せてよい列だけを明示的に select する（initial_password_hash を除外）。
const publicColumns = {
  shopAccountId: shopAccounts.shopAccountId,
  shopName: shopAccounts.shopName,
  contactName: shopAccounts.contactName,
  email: shopAccounts.email,
  mustChangePassword: shopAccounts.mustChangePassword,
  accountStatus: shopAccounts.accountStatus,
  issuedBySeAdminUserId: shopAccounts.issuedBySeAdminUserId,
  notificationSentAt: shopAccounts.notificationSentAt,
  isDeleted: shopAccounts.isDeleted,
  deletedAt: shopAccounts.deletedAt,
  createdAt: shopAccounts.createdAt,
  updatedAt: shopAccounts.updatedAt,
} as const

export interface ShopAccountListItem {
  shopAccountId: string
  shopName: string
  contactName: string
  email: string
  mustChangePassword: boolean
  accountStatus: string
  issuedBySeAdminUserId: string
  notificationSentAt: Date | null
  isDeleted: boolean
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const SORTABLE_COLUMNS = {
  createdAt: shopAccounts.createdAt,
  shopName: shopAccounts.shopName,
  updatedAt: shopAccounts.updatedAt,
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

export interface ShopAccountListFilters {
  keyword?: string
  status?: ShopAccountStatus
  includeDeleted?: boolean
  sort?: string
  page: number
  limit: number
}

/**
 * ショップアカウント一覧を取得する。
 * `includeDeleted` が真でない限り論理削除済み（is_deleted=true）は除外する。
 * keyword はショップ名またはメールアドレスへの部分一致。
 */
export async function listShopAccounts(
  filters: ShopAccountListFilters,
): Promise<{ rows: ShopAccountListItem[]; total: number }> {
  const conditions: SQL[] = []
  if (!filters.includeDeleted) {
    conditions.push(eq(shopAccounts.isDeleted, false))
  }
  if (filters.status) {
    conditions.push(eq(shopAccounts.accountStatus, filters.status))
  }
  if (filters.keyword) {
    const like = `%${filters.keyword}%`
    conditions.push(or(ilike(shopAccounts.shopName, like), ilike(shopAccounts.email, like)) as SQL)
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  const orderBy = parseSort(filters.sort)

  const rows = await db
    .select(publicColumns)
    .from(shopAccounts)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(filters.limit)
    .offset((filters.page - 1) * filters.limit)

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(shopAccounts)
    .where(whereClause)

  return { rows, total }
}

/**
 * メールアドレスからショップアカウントの存在を確認する（発行時の重複チェック用）。
 * email はユニーク制約があるため、論理削除済みも含めて全レコードを対象に確認する。
 */
export async function findShopAccountByEmail(
  email: string,
): Promise<{ shopAccountId: string } | undefined> {
  const [row] = await db
    .select({ shopAccountId: shopAccounts.shopAccountId })
    .from(shopAccounts)
    .where(eq(shopAccounts.email, email))
  return row
}

export interface CreateShopAccountInput {
  shopName: string
  contactName: string
  email: string
  initialPasswordHash: string
  issuedBySeAdminUserId: string
}

export interface CreateShopAccountResult {
  account: ShopAccountListItem
  emailNotificationLogId: string
}

/**
 * ショップアカウントを新規発行する。
 * shop_accounts への登録と、発行完了通知メールの PENDING レコード作成
 * （email_notification_logs）を単一トランザクションで行う。実際のメール送信は
 * BP-005（メール通知送信処理）が PENDING レコードを起点に非同期実行する。
 * 返り値には initial_password_hash を含めない（publicColumns のみ）。
 */
export async function createShopAccount(
  input: CreateShopAccountInput,
): Promise<CreateShopAccountResult> {
  return db.transaction(async (tx) => {
    const [account] = await tx
      .insert(shopAccounts)
      .values({
        shopName: input.shopName,
        contactName: input.contactName,
        email: input.email,
        initialPasswordHash: input.initialPasswordHash,
        mustChangePassword: true,
        accountStatus: 'pending',
        issuedBySeAdminUserId: input.issuedBySeAdminUserId,
      })
      .returning(publicColumns)

    const [log] = await tx
      .insert(emailNotificationLogs)
      .values({
        shopAccountId: account.shopAccountId,
        toEmail: input.email,
        notificationType: SHOP_ACCOUNT_ISSUED_NOTIFICATION,
        sendStatus: 'PENDING',
      })
      .returning({ emailNotificationLogId: emailNotificationLogs.emailNotificationLogId })

    return { account, emailNotificationLogId: log.emailNotificationLogId }
  })
}

/**
 * ショップアカウントを ID で取得する（initial_password_hash は含めない）。
 * `includeDeleted` が真でない限り、論理削除済みは undefined を返す。
 */
export async function findShopAccountById(
  shopAccountId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<ShopAccountListItem | undefined> {
  const conditions: SQL[] = [eq(shopAccounts.shopAccountId, shopAccountId)]
  if (!options.includeDeleted) {
    conditions.push(eq(shopAccounts.isDeleted, false))
  }

  const [row] = await db
    .select(publicColumns)
    .from(shopAccounts)
    .where(and(...conditions))
  return row
}

/**
 * 指定ショップアカウントのメール送信ログを新しい順に取得する（詳細画面で参照）。
 */
export async function listEmailLogsByShopAccount(
  shopAccountId: string,
): Promise<EmailNotificationLog[]> {
  return db
    .select()
    .from(emailNotificationLogs)
    .where(eq(emailNotificationLogs.shopAccountId, shopAccountId))
    .orderBy(desc(emailNotificationLogs.createdAt))
}

export interface ListEmailNotificationLogsInput {
  shopAccountId: string
  page: number
  limit: number
}

/**
 * 指定ショップアカウントのメール送信ログをページネーション付きで取得する
 * （createdAt 降順、API仕様書 項目12）。
 */
export async function listEmailNotificationLogsPage(
  input: ListEmailNotificationLogsInput,
): Promise<{ rows: EmailNotificationLog[]; total: number }> {
  const whereClause = eq(emailNotificationLogs.shopAccountId, input.shopAccountId)

  const rows = await db
    .select()
    .from(emailNotificationLogs)
    .where(whereClause)
    .orderBy(desc(emailNotificationLogs.createdAt))
    .limit(input.limit)
    .offset((input.page - 1) * input.limit)

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(emailNotificationLogs)
    .where(whereClause)

  return { rows, total }
}

/**
 * 通知メールの再送信をトリガーする。ショップの一時パスワードを再発行して
 * shop_accounts.initial_password_hash を更新し、email_notification_logs に
 * 新たな PENDING レコードを作成する（API仕様書 項目11）。
 * 平文パスワードは呼び出し側でのみ保持し、実際の送信は BP-005（メール送信処理）が
 * この PENDING レコードを起点に非同期実行する。
 */
export async function createResendEmailNotificationLog(input: {
  shopAccountId: string
  toEmail: string
  notificationType: string
  initialPasswordHash: string
}): Promise<EmailNotificationLog> {
  return db.transaction(async (tx) => {
    // 再送 = 初期パスワードの再発行なので、変更強制フラグも立て直す。
    await tx
      .update(shopAccounts)
      .set({
        initialPasswordHash: input.initialPasswordHash,
        mustChangePassword: true,
        updatedAt: new Date(),
      })
      .where(eq(shopAccounts.shopAccountId, input.shopAccountId))

    const [log] = await tx
      .insert(emailNotificationLogs)
      .values({
        shopAccountId: input.shopAccountId,
        toEmail: input.toEmail,
        notificationType: input.notificationType,
        sendStatus: 'PENDING',
      })
      .returning()

    return log
  })
}

export interface RecordEmailNotificationResultInput {
  emailNotificationLogId: string
  shopAccountId: string
  status: 'SUCCESS' | 'FAILURE'
  errorMessage?: string | null
  now?: Date
}

/**
 * メール送信結果を email_notification_logs に反映する（BP-005/BP-011）。
 * 成功時は shop_accounts.notification_sent_at も更新する。失敗時は
 * retry_count をインクリメントし、再送バッチ（別Issue）が対象を検出できるようにする。
 */
export async function recordEmailNotificationResult(
  input: RecordEmailNotificationResultInput,
): Promise<void> {
  const now = input.now ?? new Date()

  await db.transaction(async (tx) => {
    if (input.status === 'SUCCESS') {
      await tx
        .update(emailNotificationLogs)
        .set({ sendStatus: 'SUCCESS', sentAt: now, errorMessage: null, updatedAt: now })
        .where(eq(emailNotificationLogs.emailNotificationLogId, input.emailNotificationLogId))

      await tx
        .update(shopAccounts)
        .set({ notificationSentAt: now, updatedAt: now })
        .where(eq(shopAccounts.shopAccountId, input.shopAccountId))
      return
    }

    await tx
      .update(emailNotificationLogs)
      .set({
        sendStatus: 'FAILURE',
        errorMessage: input.errorMessage ?? '不明なエラー',
        retryCount: sql`${emailNotificationLogs.retryCount} + 1`,
        updatedAt: now,
      })
      .where(eq(emailNotificationLogs.emailNotificationLogId, input.emailNotificationLogId))
  })
}

/**
 * ショップアカウントのステータスを更新する。監査ログ記録は呼び出し側の責務。
 */
export async function updateShopAccountStatus(
  shopAccountId: string,
  status: ShopAccountStatus,
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(shopAccounts)
    .set({ accountStatus: status, updatedAt: now })
    .where(eq(shopAccounts.shopAccountId, shopAccountId))
}

// ---------------------------------------------------------------------------
// メール送信失敗レコード再送バッチ（BP-005/BP-011 BATCH、別Issue）向けの機能。
// ---------------------------------------------------------------------------

/** 自動再送を諦めるまでの最大試行回数（初回送信含まず、失敗からの再送回数）。 */
export const EMAIL_NOTIFICATION_MAX_RETRY_COUNT = 5

const EMAIL_NOTIFICATION_RETRY_BASE_MINUTES = 5
const EMAIL_NOTIFICATION_RETRY_MAX_MINUTES = 24 * 60

/**
 * 再試行回数に応じたバックオフ時間（ミリ秒）を返す。5分を基準に retryCount 回
 * ごとに倍化する指数バックオフとし、24時間を上限とする。
 */
export function emailNotificationRetryBackoffMs(retryCount: number): number {
  const minutes = Math.min(
    EMAIL_NOTIFICATION_RETRY_BASE_MINUTES * 2 ** retryCount,
    EMAIL_NOTIFICATION_RETRY_MAX_MINUTES,
  )
  return minutes * 60 * 1000
}

export interface EmailNotificationRetryCandidate {
  emailNotificationLogId: string
  shopAccountId: string
  toEmail: string
  shopName: string
  contactName: string
  notificationType: string
  retryCount: number
}

/**
 * 再送バッチの対象（送信失敗かつ再試行回数上限未満、バックオフ経過済み）を抽出する。
 * 論理削除済みのショップアカウントは対象外とする。
 */
export async function findEmailNotificationRetryCandidates(
  now: Date = new Date(),
): Promise<EmailNotificationRetryCandidate[]> {
  const rows = await db
    .select({
      emailNotificationLogId: emailNotificationLogs.emailNotificationLogId,
      shopAccountId: emailNotificationLogs.shopAccountId,
      toEmail: emailNotificationLogs.toEmail,
      notificationType: emailNotificationLogs.notificationType,
      retryCount: emailNotificationLogs.retryCount,
      updatedAt: emailNotificationLogs.updatedAt,
      shopName: shopAccounts.shopName,
      contactName: shopAccounts.contactName,
    })
    .from(emailNotificationLogs)
    .innerJoin(shopAccounts, eq(emailNotificationLogs.shopAccountId, shopAccounts.shopAccountId))
    .where(
      and(
        eq(emailNotificationLogs.sendStatus, 'FAILURE'),
        lt(emailNotificationLogs.retryCount, EMAIL_NOTIFICATION_MAX_RETRY_COUNT),
        eq(shopAccounts.isDeleted, false),
      ),
    )

  return rows
    .filter(
      (row) => now.getTime() - row.updatedAt.getTime() >= emailNotificationRetryBackoffMs(row.retryCount),
    )
    .map(({ updatedAt: _updatedAt, ...candidate }) => candidate)
}

export interface MarkEmailNotificationForRetryInput {
  emailNotificationLogId: string
  shopAccountId: string
  initialPasswordHash: string
  now?: Date
}

/**
 * 再送対象の通知ログを再送信可能な状態に戻す。一時パスワードは平文を保持しないため
 * 再発行し、`shop_accounts.initial_password_hash` を更新した上で対象ログを PENDING に戻す
 * （retryCount は据え置き、送信結果は recordEmailNotificationResult が反映する）。
 */
export async function markEmailNotificationForRetry(
  input: MarkEmailNotificationForRetryInput,
): Promise<void> {
  const now = input.now ?? new Date()

  await db.transaction(async (tx) => {
    // 再送 = 初期パスワードの再発行なので、変更強制フラグも立て直す。
    await tx
      .update(shopAccounts)
      .set({
        initialPasswordHash: input.initialPasswordHash,
        mustChangePassword: true,
        updatedAt: now,
      })
      .where(eq(shopAccounts.shopAccountId, input.shopAccountId))

    await tx
      .update(emailNotificationLogs)
      .set({ sendStatus: 'PENDING', updatedAt: now })
      .where(eq(emailNotificationLogs.emailNotificationLogId, input.emailNotificationLogId))
  })
}
