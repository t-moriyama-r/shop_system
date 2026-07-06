import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm'

import { db } from './client'
import { emailNotificationLogs, shopAccounts } from './schema'

export type EmailNotificationLog = typeof emailNotificationLogs.$inferSelect

// ショップアカウントの取りうるステータス。バリデーションと型付けに使う。
export const SHOP_ACCOUNT_STATUSES = ['active', 'pending', 'suspended'] as const
export type ShopAccountStatus = (typeof SHOP_ACCOUNT_STATUSES)[number]

export function isShopAccountStatus(value: string): value is ShopAccountStatus {
  return (SHOP_ACCOUNT_STATUSES as readonly string[]).includes(value)
}

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
