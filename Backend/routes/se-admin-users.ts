import { Hono, type Context } from 'hono'
import {
  findActiveSeAdminById,
  listSeAdminUsers,
  setSeAdminLock,
  softDeleteSeAdminUser,
} from 'db/se-admin'
import { authMiddleware, type AuthUser } from '../middleware/auth'
import { recordAuditLog } from '../lib/audit-log'

const seAdminUsersRoute = new Hono<{ Variables: { user: AuthUser } }>()

seAdminUsersRoute.use('*', authMiddleware)

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

function clientMeta(c: Context) {
  return {
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  }
}

// GET /api/se-admin-users
seAdminUsersRoute.get('/', async (c) => {
  const page = parsePositiveInt(c.req.query('page'), DEFAULT_PAGE)
  const limit = parsePositiveInt(c.req.query('limit'), DEFAULT_LIMIT, MAX_LIMIT)
  const keyword = c.req.query('keyword')?.trim()
  const isLockedParam = c.req.query('isLocked')

  const { rows, total } = await listSeAdminUsers({
    keyword: keyword || undefined,
    isLocked:
      isLockedParam === 'true' ? true : isLockedParam === 'false' ? false : undefined,
    sort: c.req.query('sort'),
    page,
    limit,
  })

  return c.json({
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
})

// DELETE /api/se-admin-users/:seAdminUserId
seAdminUsersRoute.delete('/:seAdminUserId', async (c) => {
  const seAdminUserId = c.req.param('seAdminUserId')
  const operator = c.get('user')

  if (seAdminUserId === operator.seAdminUserId) {
    return c.json({ error: '自分自身のアカウントは削除できません' }, 403)
  }

  const target = await findActiveSeAdminById(seAdminUserId)
  if (!target) {
    return c.json({ error: '対象のSE管理者アカウントが見つかりません' }, 404)
  }

  await softDeleteSeAdminUser(seAdminUserId)

  await recordAuditLog({
    operatorType: 'se_admin',
    seAdminUserId: operator.seAdminUserId,
    actionType: 'SE_ADMIN_DELETE',
    targetType: 'se_admin_user',
    targetId: seAdminUserId,
    result: 'SUCCESS',
    detail: `SE管理者アカウント(${target.email})を論理削除`,
    ...clientMeta(c),
  })

  return c.json({ message: 'SE管理者アカウントを削除しました' })
})

// PATCH /api/se-admin-users/:seAdminUserId/lock
seAdminUsersRoute.patch('/:seAdminUserId/lock', async (c) => {
  const seAdminUserId = c.req.param('seAdminUserId')
  const operator = c.get('user')

  const body = await c.req.json<{ isLocked?: boolean }>().catch(() => ({}) as { isLocked?: boolean })
  if (typeof body.isLocked !== 'boolean') {
    return c.json({ error: 'isLockedは真偽値で指定してください' }, 400)
  }
  const { isLocked } = body

  const target = await findActiveSeAdminById(seAdminUserId)
  if (!target) {
    return c.json({ error: '対象のSE管理者アカウントが見つかりません' }, 404)
  }

  await setSeAdminLock(seAdminUserId, isLocked)

  await recordAuditLog({
    operatorType: 'se_admin',
    seAdminUserId: operator.seAdminUserId,
    actionType: isLocked ? 'ACCOUNT_LOCK' : 'ACCOUNT_UNLOCK',
    targetType: 'se_admin_user',
    targetId: seAdminUserId,
    result: 'SUCCESS',
    detail: isLocked
      ? `SE管理者アカウント(${target.email})を手動ロック`
      : `SE管理者アカウント(${target.email})のロックを解除`,
    ...clientMeta(c),
  })

  return c.json({
    message: isLocked ? 'アカウントをロックしました' : 'アカウントのロックを解除しました',
    isLocked,
  })
})

export { seAdminUsersRoute }
