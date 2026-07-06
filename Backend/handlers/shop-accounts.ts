import bcrypt from 'bcrypt'
import crypto from 'node:crypto'
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
import { recordAuditLog } from '../lib/audit-log'
import type { AuthUser } from '../middleware/auth'
import type { ClientMeta, HandlerResult } from './types'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const MAX_FIELD_LENGTH = 255
const BCRYPT_SALT_ROUNDS = 10
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 発行時に付与する一時パスワードを生成する。平文はメール本文でのみ利用され、
// DB にはハッシュ値のみを保存する（設計 BP-003 備考）。
function generateInitialPassword(): string {
  return crypto.randomBytes(18).toString('base64url')
}

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

  const existing = await findShopAccountByEmail(email.value)
  if (existing) {
    return { status: 409, body: { error: 'このメールアドレスは既に登録されています' } }
  }

  const initialPasswordHash = await bcrypt.hash(generateInitialPassword(), BCRYPT_SALT_ROUNDS)

  const account = await createShopAccount({
    shopName: shopName.value,
    contactName: contactName.value,
    email: email.value,
    initialPasswordHash,
    issuedBySeAdminUserId: input.operator.seAdminUserId,
  })

  await recordAuditLog({
    operatorType: 'se_admin',
    seAdminUserId: input.operator.seAdminUserId,
    actionType: 'SHOP_ACCOUNT_CREATE',
    targetType: 'shop_account',
    targetId: account.shopAccountId,
    result: 'SUCCESS',
    detail: `ショップアカウント(${account.email})を発行`,
    ...input.meta,
  })

  return {
    status: 201,
    body: { message: 'ショップアカウントを発行しました', shopAccount: account },
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

  const account = await findShopAccountById(input.shopAccountId)
  if (!account) {
    return { status: 404, body: { error: '対象のショップアカウントが見つかりません' } }
  }

  const page = parsePositiveInt(input.page, DEFAULT_PAGE)
  const limit = parsePositiveInt(input.limit, DEFAULT_LIMIT, MAX_LIMIT)

  const { rows, total } = await listEmailNotificationLogsPage({
    shopAccountId: input.shopAccountId,
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

  const account = await findShopAccountById(input.shopAccountId)
  if (!account) {
    return { status: 404, body: { error: '対象のショップアカウントが見つかりません' } }
  }

  const log = await createResendEmailNotificationLog({
    shopAccountId: input.shopAccountId,
    toEmail: account.email,
    notificationType: SHOP_ACCOUNT_ISSUED_NOTIFICATION,
  })

  await recordAuditLog({
    operatorType: 'se_admin',
    seAdminUserId: input.operator.seAdminUserId,
    actionType: 'SHOP_ACCOUNT_NOTIFICATION_RESEND',
    targetType: 'shop_account',
    targetId: input.shopAccountId,
    result: 'SUCCESS',
    detail: `ショップアカウント(${account.email})の通知メール再送信をトリガー`,
    ...input.meta,
  })

  return {
    status: 200,
    body: { message: '通知メールの再送信をトリガーしました', emailNotificationLog: log },
  }
}
