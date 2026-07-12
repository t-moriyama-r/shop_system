import {
  findActiveSeAdminById,
  listSeAdminUsers,
  setSeAdminLock,
  softDeleteSeAdminUser,
} from 'db/se-admin'
import { recordAuditLog } from '../lib/audit-log'
import { buildPagination, parsePositiveInt } from '../lib/pagination'
import type { AuthUser } from '../middleware/auth'
import type { ClientMeta, HandlerResult, ServiceResult } from './types'
import { serviceErrorResult } from './types'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export interface ListSeAdminUsersInput {
  page?: string
  limit?: string
  keyword?: string
  isLocked?: string
  sort?: string
}

export async function listSeAdminUsersHandler(
  input: ListSeAdminUsersInput,
): Promise<HandlerResult> {
  const page = parsePositiveInt(input.page, DEFAULT_PAGE)
  const limit = parsePositiveInt(input.limit, DEFAULT_LIMIT, MAX_LIMIT)
  const keyword = input.keyword?.trim()
  const isLocked =
    input.isLocked === 'true' ? true : input.isLocked === 'false' ? false : undefined

  const result = await listSeAdminUsersService({ page, limit, keyword, isLocked, sort: input.sort })
  if (!result.ok) return serviceErrorResult(result)

  return {
    status: 200,
    body: {
      data: result.data.rows,
      pagination: buildPagination(page, limit, result.data.total),
    },
  }
}

export interface DeleteSeAdminUserInput {
  targetId: string
  operator: AuthUser
  meta: ClientMeta
}

export async function deleteSeAdminUserHandler(
  input: DeleteSeAdminUserInput,
): Promise<HandlerResult> {
  if (input.targetId === input.operator.seAdminUserId) {
    return { status: 403, body: { error: '自分自身のアカウントは削除できません' } }
  }

  const result = await deleteSeAdminUserService(input)
  if (!result.ok) return serviceErrorResult(result)

  return { status: 200, body: { message: 'SE管理者アカウントを削除しました' } }
}

export interface SetSeAdminLockInput {
  targetId: string
  operator: AuthUser
  isLocked: unknown
  meta: ClientMeta
}

export async function setSeAdminLockHandler(input: SetSeAdminLockInput): Promise<HandlerResult> {
  if (typeof input.isLocked !== 'boolean') {
    return { status: 400, body: { error: 'isLockedは真偽値で指定してください' } }
  }

  const result = await setSeAdminLockService({
    targetId: input.targetId,
    operator: input.operator,
    isLocked: input.isLocked,
    meta: input.meta,
  })
  if (!result.ok) return serviceErrorResult(result)

  return {
    status: 200,
    body: {
      message: result.data.isLocked ? 'アカウントをロックしました' : 'アカウントのロックを解除しました',
      isLocked: result.data.isLocked,
    },
  }
}

async function listSeAdminUsersService(params: {
  page: number
  limit: number
  keyword?: string
  isLocked?: boolean
  sort?: string
}): Promise<
  ServiceResult<{ rows: Awaited<ReturnType<typeof listSeAdminUsers>>['rows']; total: number }>
> {
  const { rows, total } = await listSeAdminUsers({
    keyword: params.keyword || undefined,
    isLocked: params.isLocked,
    sort: params.sort,
    page: params.page,
    limit: params.limit,
  })

  return { ok: true, data: { rows, total } }
}

async function deleteSeAdminUserService(params: DeleteSeAdminUserInput): Promise<ServiceResult<null>> {
  const { targetId, operator, meta } = params

  const target = await findActiveSeAdminById(targetId)
  if (!target) {
    return { ok: false, reason: 'not_found', message: '対象のSE管理者アカウントが見つかりません' }
  }

  await softDeleteSeAdminUser(targetId)

  await recordAuditLog({
    operatorType: 'se_admin',
    seAdminUserId: operator.seAdminUserId,
    actionType: 'SE_ADMIN_DELETE',
    targetType: 'se_admin_user',
    targetId,
    result: 'SUCCESS',
    detail: `SE管理者アカウント(${target.email})を論理削除`,
    ...meta,
  })

  return { ok: true, data: null }
}

async function setSeAdminLockService(params: {
  targetId: string
  operator: AuthUser
  isLocked: boolean
  meta: ClientMeta
}): Promise<ServiceResult<{ isLocked: boolean }>> {
  const { targetId, operator, isLocked, meta } = params

  const target = await findActiveSeAdminById(targetId)
  if (!target) {
    return { ok: false, reason: 'not_found', message: '対象のSE管理者アカウントが見つかりません' }
  }

  await setSeAdminLock(targetId, isLocked)

  await recordAuditLog({
    operatorType: 'se_admin',
    seAdminUserId: operator.seAdminUserId,
    actionType: isLocked ? 'ACCOUNT_LOCK' : 'ACCOUNT_UNLOCK',
    targetType: 'se_admin_user',
    targetId,
    result: 'SUCCESS',
    detail: isLocked
      ? `SE管理者アカウント(${target.email})を手動ロック`
      : `SE管理者アカウント(${target.email})のロックを解除`,
    ...meta,
  })

  return { ok: true, data: { isLocked } }
}
