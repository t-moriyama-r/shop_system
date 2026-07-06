import {
  findActiveSeAdminById,
  listSeAdminUsers,
  setSeAdminLock,
  softDeleteSeAdminUser,
} from 'db/se-admin'
import { recordAuditLog } from '../lib/audit-log'
import type { AuthUser } from '../middleware/auth'
import type { ClientMeta, HandlerResult } from './types'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function parsePositiveInt(value: string | undefined, fallback: number, max?: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }
  return max ? Math.min(parsed, max) : parsed
}

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

  const { rows, total } = await listSeAdminUsers({
    keyword: keyword || undefined,
    isLocked:
      input.isLocked === 'true' ? true : input.isLocked === 'false' ? false : undefined,
    sort: input.sort,
    page,
    limit,
  })

  return {
    status: 200,
    body: {
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
  const { targetId, operator, meta } = input

  if (targetId === operator.seAdminUserId) {
    return { status: 403, body: { error: '自分自身のアカウントは削除できません' } }
  }

  const target = await findActiveSeAdminById(targetId)
  if (!target) {
    return { status: 404, body: { error: '対象のSE管理者アカウントが見つかりません' } }
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

  return { status: 200, body: { message: 'SE管理者アカウントを削除しました' } }
}

export interface SetSeAdminLockInput {
  targetId: string
  operator: AuthUser
  isLocked: unknown
  meta: ClientMeta
}

export async function setSeAdminLockHandler(input: SetSeAdminLockInput): Promise<HandlerResult> {
  const { targetId, operator, meta } = input

  if (typeof input.isLocked !== 'boolean') {
    return { status: 400, body: { error: 'isLockedは真偽値で指定してください' } }
  }
  const isLocked = input.isLocked

  const target = await findActiveSeAdminById(targetId)
  if (!target) {
    return { status: 404, body: { error: '対象のSE管理者アカウントが見つかりません' } }
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

  return {
    status: 200,
    body: {
      message: isLocked ? 'アカウントをロックしました' : 'アカウントのロックを解除しました',
      isLocked,
    },
  }
}
