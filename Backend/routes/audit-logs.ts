import { Hono } from 'hono'
import { listAuditLogs } from 'db/audit-logs'
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
// route は入力のパース・バリデーション・整形に専念し、クエリは db/audit-logs に委譲する。
auditLogsRoute.get('/', async (c) => {
  const page = parsePositiveInt(c.req.query('page'), DEFAULT_PAGE)
  const limit = parsePositiveInt(c.req.query('limit'), DEFAULT_LIMIT, MAX_LIMIT)

  const seAdminUserId = c.req.query('seAdminUserId')?.trim()
  const targetId = c.req.query('targetId')?.trim()
  const dateFromRaw = c.req.query('dateFrom')?.trim()
  const dateToRaw = c.req.query('dateTo')?.trim()

  if (seAdminUserId && !UUID_PATTERN.test(seAdminUserId)) {
    return c.json({ error: 'seAdminUserId はUUID形式で指定してください' }, 400)
  }
  if (targetId && !UUID_PATTERN.test(targetId)) {
    return c.json({ error: 'targetId はUUID形式で指定してください' }, 400)
  }

  let dateFrom: Date | undefined
  if (dateFromRaw) {
    dateFrom = new Date(dateFromRaw)
    if (Number.isNaN(dateFrom.getTime())) {
      return c.json({ error: 'dateFrom は日時形式で指定してください' }, 400)
    }
  }
  let dateTo: Date | undefined
  if (dateToRaw) {
    dateTo = new Date(dateToRaw)
    if (Number.isNaN(dateTo.getTime())) {
      return c.json({ error: 'dateTo は日時形式で指定してください' }, 400)
    }
  }

  const { rows, total } = await listAuditLogs({
    actionType: c.req.query('actionType')?.trim() || undefined,
    result: c.req.query('result')?.trim() || undefined,
    targetType: c.req.query('targetType')?.trim() || undefined,
    seAdminUserId: seAdminUserId || undefined,
    targetId: targetId || undefined,
    dateFrom,
    dateTo,
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

export { auditLogsRoute }
