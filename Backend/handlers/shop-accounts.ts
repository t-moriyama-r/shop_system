import {
  findShopAccountById,
  isShopAccountStatus,
  listEmailLogsByShopAccount,
  listShopAccounts,
  SHOP_ACCOUNT_STATUSES,
  updateShopAccountStatus,
} from 'db/shop-accounts'
import { recordAuditLog } from '../lib/audit-log'
import type { AuthUser } from '../middleware/auth'
import type { ClientMeta, HandlerResult } from './types'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parsePositiveInt(value: string | undefined, fallback: number, max?: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }
  return max ? Math.min(parsed, max) : parsed
}

const STATUS_ERROR = `status は ${SHOP_ACCOUNT_STATUSES.join(' / ')} のいずれかで指定してください`

export interface ListShopAccountsInput {
  page?: string
  limit?: string
  sort?: string
  status?: string
  keyword?: string
  includeDeleted?: string
}

export async function listShopAccountsHandler(input: ListShopAccountsInput): Promise<HandlerResult> {
  const page = parsePositiveInt(input.page, DEFAULT_PAGE)
  const limit = parsePositiveInt(input.limit, DEFAULT_LIMIT, MAX_LIMIT)

  const statusRaw = input.status?.trim()
  if (statusRaw && !isShopAccountStatus(statusRaw)) {
    return { status: 400, body: { error: STATUS_ERROR } }
  }

  const keyword = input.keyword?.trim()

  const { rows, total } = await listShopAccounts({
    keyword: keyword || undefined,
    status: statusRaw && isShopAccountStatus(statusRaw) ? statusRaw : undefined,
    includeDeleted: input.includeDeleted === 'true',
    sort: input.sort,
    page,
    limit,
  })

  return {
    status: 200,
    body: {
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  }
}

export interface GetShopAccountInput {
  shopAccountId: string
}

export async function getShopAccountHandler(input: GetShopAccountInput): Promise<HandlerResult> {
  if (!UUID_PATTERN.test(input.shopAccountId)) {
    return { status: 400, body: { error: 'shopAccountId はUUID形式で指定してください' } }
  }

  const account = await findShopAccountById(input.shopAccountId)
  if (!account) {
    return { status: 404, body: { error: '対象のショップアカウントが見つかりません' } }
  }

  const emailNotificationLogs = await listEmailLogsByShopAccount(input.shopAccountId)

  return { status: 200, body: { ...account, emailNotificationLogs } }
}

export interface UpdateShopAccountStatusInput {
  shopAccountId: string
  operator: AuthUser
  status: unknown
  meta: ClientMeta
}

export async function updateShopAccountStatusHandler(
  input: UpdateShopAccountStatusInput,
): Promise<HandlerResult> {
  if (!UUID_PATTERN.test(input.shopAccountId)) {
    return { status: 400, body: { error: 'shopAccountId はUUID形式で指定してください' } }
  }
  if (typeof input.status !== 'string' || !isShopAccountStatus(input.status)) {
    return { status: 400, body: { error: STATUS_ERROR } }
  }
  const status = input.status

  const account = await findShopAccountById(input.shopAccountId)
  if (!account) {
    return { status: 404, body: { error: '対象のショップアカウントが見つかりません' } }
  }

  await updateShopAccountStatus(input.shopAccountId, status)

  await recordAuditLog({
    operatorType: 'se_admin',
    seAdminUserId: input.operator.seAdminUserId,
    actionType: 'SHOP_ACCOUNT_STATUS_UPDATE',
    targetType: 'shop_account',
    targetId: input.shopAccountId,
    result: 'SUCCESS',
    detail: `ショップアカウント(${account.email})のステータスを ${account.accountStatus} → ${status} に変更`,
    ...input.meta,
  })

  return {
    status: 200,
    body: { message: 'ショップアカウントのステータスを更新しました', accountStatus: status },
  }
}
