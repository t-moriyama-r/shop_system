import { Hono } from 'hono'
import { authMiddleware, type AuthUser } from '../middleware/auth'
import { listAuditLogsHandler } from '../handlers/audit-logs'

const auditLogsRoute = new Hono<{ Variables: { user: AuthUser } }>()

auditLogsRoute.use('*', authMiddleware)

// GET /api/audit-logs
// 監査ログ参照API。改ざん防止のため参照（GET）のみを提供する。
// route は入力の取り出しに専念し、パース/バリデーション/クエリは handler に委譲する。
auditLogsRoute.get('/', async (c) => {
  const result = await listAuditLogsHandler({
    page: c.req.query('page'),
    limit: c.req.query('limit'),
    actionType: c.req.query('actionType'),
    result: c.req.query('result'),
    targetType: c.req.query('targetType'),
    seAdminUserId: c.req.query('seAdminUserId'),
    targetId: c.req.query('targetId'),
    dateFrom: c.req.query('dateFrom'),
    dateTo: c.req.query('dateTo'),
    sort: c.req.query('sort'),
  })
  return c.json(result.body, result.status)
})

export { auditLogsRoute }
