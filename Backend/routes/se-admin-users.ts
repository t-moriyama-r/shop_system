import { Hono } from 'hono'
import { db } from 'db'
import { seAdminUsers, sessions } from 'db/schema'
import { and, eq, ilike, asc, desc, count, type SQL } from 'drizzle-orm'
import { authMiddleware, type AuthUser } from '../middleware/auth'
import { recordAuditLog } from '../lib/audit-log'

const seAdminUsersRoute = new Hono<{ Variables: { user: AuthUser } }>()

seAdminUsersRoute.use('*', authMiddleware)

const SORTABLE_COLUMNS = {
  createdAt: seAdminUsers.createdAt,
  email: seAdminUsers.email,
  lastLoginAt: seAdminUsers.lastLoginAt,
} as const

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

function parseSort(value: string | undefined) {
  const [rawColumn, rawDirection] = (value ?? '').split(':')
  const column = rawColumn in SORTABLE_COLUMNS
    ? SORTABLE_COLUMNS[rawColumn as keyof typeof SORTABLE_COLUMNS]
    : SORTABLE_COLUMNS.createdAt
  const direction = rawDirection === 'asc' ? asc : desc
  return direction(column)
}

// GET /api/se-admin-users
seAdminUsersRoute.get('/', async (c) => {
  const page = parsePositiveInt(c.req.query('page'), DEFAULT_PAGE)
  const limit = parsePositiveInt(c.req.query('limit'), DEFAULT_LIMIT, MAX_LIMIT)
  const keyword = c.req.query('keyword')?.trim()
  const isLockedParam = c.req.query('isLocked')

  const conditions: SQL[] = [eq(seAdminUsers.isDeleted, false)]
  if (keyword) {
    conditions.push(ilike(seAdminUsers.email, `%${keyword}%`))
  }
  if (isLockedParam === 'true' || isLockedParam === 'false') {
    conditions.push(eq(seAdminUsers.isLocked, isLockedParam === 'true'))
  }

  const whereClause = and(...conditions)
  const orderBy = parseSort(c.req.query('sort'))

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
    .limit(limit)
    .offset((page - 1) * limit)

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(seAdminUsers)
    .where(whereClause)

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

  const [target] = await db
    .select()
    .from(seAdminUsers)
    .where(and(eq(seAdminUsers.seAdminUserId, seAdminUserId), eq(seAdminUsers.isDeleted, false)))

  if (!target) {
    return c.json({ error: '対象のSE管理者アカウントが見つかりません' }, 404)
  }

  const now = new Date()
  await db
    .update(seAdminUsers)
    .set({ isDeleted: true, deletedAt: now, updatedAt: now })
    .where(eq(seAdminUsers.seAdminUserId, seAdminUserId))

  // 該当ユーザーの既存セッションを無効化
  await db.delete(sessions).where(eq(sessions.seAdminUserId, seAdminUserId))

  await recordAuditLog({
    operatorType: 'se_admin',
    seAdminUserId: operator.seAdminUserId,
    actionType: 'SE_ADMIN_DELETE',
    targetType: 'se_admin_user',
    targetId: seAdminUserId,
    result: 'SUCCESS',
    detail: `SE管理者アカウント(${target.email})を論理削除`,
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
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

  const [target] = await db
    .select()
    .from(seAdminUsers)
    .where(and(eq(seAdminUsers.seAdminUserId, seAdminUserId), eq(seAdminUsers.isDeleted, false)))

  if (!target) {
    return c.json({ error: '対象のSE管理者アカウントが見つかりません' }, 404)
  }

  const now = new Date()
  await db
    .update(seAdminUsers)
    .set({
      isLocked,
      // ロック解除時は連続失敗カウントもリセットする
      ...(isLocked ? {} : { failedLoginCount: 0 }),
      updatedAt: now,
    })
    .where(eq(seAdminUsers.seAdminUserId, seAdminUserId))

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
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  })

  return c.json({
    message: isLocked ? 'アカウントをロックしました' : 'アカウントのロックを解除しました',
    isLocked,
  })
})

export { seAdminUsersRoute }
