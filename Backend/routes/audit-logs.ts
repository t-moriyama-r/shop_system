import { Hono } from 'hono'
import { db } from 'db'
import { auditLogs } from 'db/schema'
import { and, asc, count, desc, eq, gte, lte, type SQL } from 'drizzle-orm'
import { authMiddleware, type AuthUser } from '../middleware/auth'

const auditLogsRoute = new Hono<{ Variables: { user: AuthUser } }>()

auditLogsRoute.use('*', authMiddleware)

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parsePositiveInt(value: string | undefined, fallback: number, max?: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }
  return max ? Math.min(parsed, max) : parsed
}

// GET /api/audit-logs
// 監査ログ参照API。改ざん防止のため参照（GET）のみを提供する。
auditLogsRoute.get('/', async (c) => {
  const page = parsePositiveInt(c.req.query('page'), DEFAULT_PAGE)
  const limit = parsePositiveInt(c.req.query('limit'), DEFAULT_LIMIT, MAX_LIMIT)

  const actionType = c.req.query('actionType')?.trim()
  const result = c.req.query('result')?.trim()
  const seAdminUserId = c.req.query('seAdminUserId')?.trim()
  const targetType = c.req.query('targetType')?.trim()
  const targetId = c.req.query('targetId')?.trim()
  const dateFrom = c.req.query('dateFrom')?.trim()
  const dateTo = c.req.query('dateTo')?.trim()

  const conditions: SQL[] = []

  if (actionType) {
    conditions.push(eq(auditLogs.actionType, actionType))
  }
  if (result) {
    conditions.push(eq(auditLogs.result, result))
  }
  if (targetType) {
    conditions.push(eq(auditLogs.targetType, targetType))
  }
  if (seAdminUserId) {
    if (!UUID_PATTERN.test(seAdminUserId)) {
      return c.json({ error: 'seAdminUserId はUUID形式で指定してください' }, 400)
    }
    conditions.push(eq(auditLogs.seAdminUserId, seAdminUserId))
  }
  if (targetId) {
    if (!UUID_PATTERN.test(targetId)) {
      return c.json({ error: 'targetId はUUID形式で指定してください' }, 400)
    }
    conditions.push(eq(auditLogs.targetId, targetId))
  }
  if (dateFrom) {
    const from = new Date(dateFrom)
    if (Number.isNaN(from.getTime())) {
      return c.json({ error: 'dateFrom は日時形式で指定してください' }, 400)
    }
    conditions.push(gte(auditLogs.createdAt, from))
  }
  if (dateTo) {
    const to = new Date(dateTo)
    if (Number.isNaN(to.getTime())) {
      return c.json({ error: 'dateTo は日時形式で指定してください' }, 400)
    }
    conditions.push(lte(auditLogs.createdAt, to))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  // ソートは createdAt 固定。sort=createdAt:asc で昇順、その他は降順（デフォルト）。
  const orderBy = c.req.query('sort') === 'createdAt:asc' ? asc(auditLogs.createdAt) : desc(auditLogs.createdAt)

  const rows = await db
    .select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit)
    .offset((page - 1) * limit)

  const [{ value: total }] = await db.select({ value: count() }).from(auditLogs).where(whereClause)

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

export { auditLogsRoute }
