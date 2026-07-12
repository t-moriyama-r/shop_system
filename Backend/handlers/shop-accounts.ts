import {
  createResendEmailNotificationLog,
  createShopAccount,
  findShopAccountByEmail,
  findShopAccountById,
  isShopAccountStatus,
  listEmailLogsByShopAccount,
  listEmailNotificationLogsPage,
  listShopAccounts,
  SHOP_ACCOUNT_ISSUED_NOTIFICATION,
  SHOP_ACCOUNT_STATUSES,
  updateShopAccountStatus,
} from 'db/shop-accounts'
import type { ShopAccountStatus } from 'db/shop-accounts'
import { recordAuditLog } from '../lib/audit-log'
import { sendShopAccountIssuedNotification } from '../lib/email/notify'
import { buildPagination, parsePositiveInt } from '../lib/pagination'
import { generateInitialPassword, hashPassword } from '../lib/password'
import type { AuthUser } from '../middleware/auth'
import type { ClientMeta, HandlerResult, ServiceResult } from './types'
import { serviceErrorResult } from './types'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const MAX_FIELD_LENGTH = 255
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  const result = await listShopAccountsService({
    page,
    limit,
    status: statusRaw && isShopAccountStatus(statusRaw) ? statusRaw : undefined,
    keyword: input.keyword?.trim(),
    includeDeleted: input.includeDeleted === 'true',
    sort: input.sort,
  })
  if (!result.ok) return serviceErrorResult(result)

  return {
    status: 200,
    body: {
      data: result.data.rows,
      pagination: buildPagination(page, limit, result.data.total),
    },
  }
}

export interface CreateShopAccountInput {
  shopName: unknown
  contactName: unknown
  email: unknown
  operator: AuthUser
  meta: ClientMeta
}

type FieldResult = { ok: true; value: string } | { ok: false; error: string }

function validateRequiredField(value: unknown, label: string): FieldResult {
  if (typeof value !== 'string' || value.trim() === '') {
    return { ok: false, error: `${label}は必須です` }
  }
  const trimmed = value.trim()
  if (trimmed.length > MAX_FIELD_LENGTH) {
    return { ok: false, error: `${label}は${MAX_FIELD_LENGTH}文字以内で指定してください` }
  }
  return { ok: true, value: trimmed }
}

export async function createShopAccountHandler(
  input: CreateShopAccountInput,
): Promise<HandlerResult> {
  const shopName = validateRequiredField(input.shopName, 'ショップ名')
  if (!shopName.ok) return { status: 400, body: { error: shopName.error } }

  const contactName = validateRequiredField(input.contactName, '担当者名')
  if (!contactName.ok) return { status: 400, body: { error: contactName.error } }

  const email = validateRequiredField(input.email, 'メールアドレス')
  if (!email.ok) return { status: 400, body: { error: email.error } }
  if (!EMAIL_PATTERN.test(email.value)) {
    return { status: 400, body: { error: 'メールアドレスの形式が正しくありません' } }
  }

  const result = await createShopAccountService({
    shopName: shopName.value,
    contactName: contactName.value,
    email: email.value,
    operator: input.operator,
    meta: input.meta,
  })
  if (!result.ok) return serviceErrorResult(result)

  return {
    status: 201,
    body: { message: 'ショップアカウントを発行しました', shopAccount: result.data.account },
  }
}

export interface GetShopAccountInput {
  shopAccountId: string
}

export async function getShopAccountHandler(input: GetShopAccountInput): Promise<HandlerResult> {
  if (!UUID_PATTERN.test(input.shopAccountId)) {
    return { status: 400, body: { error: 'shopAccountId はUUID形式で指定してください' } }
  }

  const result = await getShopAccountService(input.shopAccountId)
  if (!result.ok) return serviceErrorResult(result)

  return { status: 200, body: { ...result.data.account, emailNotificationLogs: result.data.emailNotificationLogs } }
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

  const result = await updateShopAccountStatusService({
    shopAccountId: input.shopAccountId,
    status: input.status,
    operator: input.operator,
    meta: input.meta,
  })
  if (!result.ok) return serviceErrorResult(result)

  return {
    status: 200,
    body: { message: 'ショップアカウントのステータスを更新しました', accountStatus: result.data.accountStatus },
  }
}

export interface ListNotificationLogsInput {
  shopAccountId: string
  page?: string
  limit?: string
}

export async function listNotificationLogsHandler(
  input: ListNotificationLogsInput,
): Promise<HandlerResult> {
  if (!UUID_PATTERN.test(input.shopAccountId)) {
    return { status: 400, body: { error: 'shopAccountId はUUID形式で指定してください' } }
  }

  const page = parsePositiveInt(input.page, DEFAULT_PAGE)
  const limit = parsePositiveInt(input.limit, DEFAULT_LIMIT, MAX_LIMIT)

  const result = await listNotificationLogsService({ shopAccountId: input.shopAccountId, page, limit })
  if (!result.ok) return serviceErrorResult(result)

  return {
    status: 200,
    body: {
      data: result.data.rows,
      pagination: buildPagination(page, limit, result.data.total),
    },
  }
}

export interface ResendNotificationInput {
  shopAccountId: string
  operator: AuthUser
  meta: ClientMeta
}

export async function resendNotificationHandler(
  input: ResendNotificationInput,
): Promise<HandlerResult> {
  if (!UUID_PATTERN.test(input.shopAccountId)) {
    return { status: 400, body: { error: 'shopAccountId はUUID形式で指定してください' } }
  }

  const result = await resendNotificationService(input)
  if (!result.ok) return serviceErrorResult(result)

  return {
    status: 200,
    body: { message: '通知メールの再送信をトリガーしました', emailNotificationLog: result.data.log },
  }
}

async function listShopAccountsService(params: {
  page: number
  limit: number
  status?: ShopAccountStatus
  keyword?: string
  includeDeleted: boolean
  sort?: string
}): Promise<ServiceResult<{ rows: Awaited<ReturnType<typeof listShopAccounts>>['rows']; total: number }>> {
  const { rows, total } = await listShopAccounts({
    keyword: params.keyword || undefined,
    status: params.status,
    includeDeleted: params.includeDeleted,
    sort: params.sort,
    page: params.page,
    limit: params.limit,
  })

  return { ok: true, data: { rows, total } }
}

async function createShopAccountService(params: {
  shopName: string
  contactName: string
  email: string
  operator: AuthUser
  meta: ClientMeta
}): Promise<ServiceResult<{ account: Awaited<ReturnType<typeof createShopAccount>>['account'] }>> {
  const existing = await findShopAccountByEmail(params.email)
  if (existing) {
    return { ok: false, reason: 'conflict', message: 'このメールアドレスは既に登録されています' }
  }

  const temporaryPassword = generateInitialPassword()
  const initialPasswordHash = await hashPassword(temporaryPassword)

  const { account, emailNotificationLogId } = await createShopAccount({
    shopName: params.shopName,
    contactName: params.contactName,
    email: params.email,
    initialPasswordHash,
    issuedBySeAdminUserId: params.operator.seAdminUserId,
  })

  triggerShopAccountIssuedNotification({
    emailNotificationLogId,
    shopAccountId: account.shopAccountId,
    toEmail: account.email,
    shopName: account.shopName,
    contactName: account.contactName,
    temporaryPassword,
  })

  await recordAuditLog({
    operatorType: 'se_admin',
    seAdminUserId: params.operator.seAdminUserId,
    actionType: 'SHOP_ACCOUNT_CREATE',
    targetType: 'shop_account',
    targetId: account.shopAccountId,
    result: 'SUCCESS',
    detail: `ショップアカウント(${account.email})を発行`,
    ...params.meta,
  })

  return { ok: true, data: { account } }
}

async function getShopAccountService(
  shopAccountId: string,
): Promise<
  ServiceResult<{
    account: NonNullable<Awaited<ReturnType<typeof findShopAccountById>>>
    emailNotificationLogs: Awaited<ReturnType<typeof listEmailLogsByShopAccount>>
  }>
> {
  const account = await findShopAccountById(shopAccountId)
  if (!account) {
    return { ok: false, reason: 'not_found', message: '対象のショップアカウントが見つかりません' }
  }

  const emailNotificationLogs = await listEmailLogsByShopAccount(shopAccountId)

  return { ok: true, data: { account, emailNotificationLogs } }
}

async function updateShopAccountStatusService(params: {
  shopAccountId: string
  status: ShopAccountStatus
  operator: AuthUser
  meta: ClientMeta
}): Promise<ServiceResult<{ accountStatus: ShopAccountStatus }>> {
  const account = await findShopAccountById(params.shopAccountId)
  if (!account) {
    return { ok: false, reason: 'not_found', message: '対象のショップアカウントが見つかりません' }
  }

  await updateShopAccountStatus(params.shopAccountId, params.status)

  await recordAuditLog({
    operatorType: 'se_admin',
    seAdminUserId: params.operator.seAdminUserId,
    actionType: 'SHOP_ACCOUNT_STATUS_UPDATE',
    targetType: 'shop_account',
    targetId: params.shopAccountId,
    result: 'SUCCESS',
    detail: `ショップアカウント(${account.email})のステータスを ${account.accountStatus} → ${params.status} に変更`,
    ...params.meta,
  })

  return { ok: true, data: { accountStatus: params.status } }
}

async function listNotificationLogsService(params: {
  shopAccountId: string
  page: number
  limit: number
}): Promise<
  ServiceResult<{
    rows: Awaited<ReturnType<typeof listEmailNotificationLogsPage>>['rows']
    total: number
  }>
> {
  const account = await findShopAccountById(params.shopAccountId)
  if (!account) {
    return { ok: false, reason: 'not_found', message: '対象のショップアカウントが見つかりません' }
  }

  const { rows, total } = await listEmailNotificationLogsPage({
    shopAccountId: params.shopAccountId,
    page: params.page,
    limit: params.limit,
  })

  return { ok: true, data: { rows, total } }
}

async function resendNotificationService(
  params: ResendNotificationInput,
): Promise<ServiceResult<{ log: Awaited<ReturnType<typeof createResendEmailNotificationLog>> }>> {
  const account = await findShopAccountById(params.shopAccountId)
  if (!account) {
    return { ok: false, reason: 'not_found', message: '対象のショップアカウントが見つかりません' }
  }

  // 再送信時は新しい一時パスワードを発行し直す。
  const temporaryPassword = generateInitialPassword()
  const initialPasswordHash = await hashPassword(temporaryPassword)

  const log = await createResendEmailNotificationLog({
    shopAccountId: params.shopAccountId,
    toEmail: account.email,
    notificationType: SHOP_ACCOUNT_ISSUED_NOTIFICATION,
    initialPasswordHash,
  })

  triggerShopAccountIssuedNotification({
    emailNotificationLogId: log.emailNotificationLogId,
    shopAccountId: params.shopAccountId,
    toEmail: account.email,
    shopName: account.shopName,
    contactName: account.contactName,
    temporaryPassword,
  })

  await recordAuditLog({
    operatorType: 'se_admin',
    seAdminUserId: params.operator.seAdminUserId,
    actionType: 'SHOP_ACCOUNT_NOTIFICATION_RESEND',
    targetType: 'shop_account',
    targetId: params.shopAccountId,
    result: 'SUCCESS',
    detail: `ショップアカウント(${account.email})の通知メール再送信をトリガー`,
    ...params.meta,
  })

  return { ok: true, data: { log } }
}

// 発行完了通知メールの送信をトリガーする。BP-005/BP-011 の設計どおり非同期
// （fire-and-forget）で実行し、HTTPレスポンスをブロックしない。
function triggerShopAccountIssuedNotification(
  params: Parameters<typeof sendShopAccountIssuedNotification>[0],
): void {
  void sendShopAccountIssuedNotification(params).catch((err) => {
    console.error('通知メールの送信処理でエラーが発生しました', err)
  })
}
