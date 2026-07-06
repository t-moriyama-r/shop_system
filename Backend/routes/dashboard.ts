import { Hono } from 'hono'
import { authMiddleware, type AuthUser } from '../middleware/auth'
import {
  getDashboardSummaryHandler,
  listShopAccountActivitiesHandler,
} from '../handlers/dashboard'

const dashboardRoute = new Hono<{ Variables: { user: AuthUser } }>()

dashboardRoute.use('*', authMiddleware)

// GET /api/dashboard/summary
dashboardRoute.get('/summary', async (c) => {
  const result = await getDashboardSummaryHandler()
  return c.json(result.body, result.status)
})

// GET /api/dashboard/shop-account-activities
dashboardRoute.get('/shop-account-activities', async (c) => {
  const result = await listShopAccountActivitiesHandler({ limit: c.req.query('limit') })
  return c.json(result.body, result.status)
})

export { dashboardRoute }
