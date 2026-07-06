import { Hono } from 'hono'
import { authMiddleware, type AuthUser } from '../middleware/auth'
import {
  createShopAccountHandler,
  getShopAccountHandler,
  listShopAccountsHandler,
  updateShopAccountStatusHandler,
} from '../handlers/shop-accounts'
import { clientMeta } from '../lib/http'

const shopAccountsRoute = new Hono<{ Variables: { user: AuthUser } }>()

shopAccountsRoute.use('*', authMiddleware)

// GET /api/shop-accounts
shopAccountsRoute.get('/', async (c) => {
  const result = await listShopAccountsHandler({
    page: c.req.query('page'),
    limit: c.req.query('limit'),
    sort: c.req.query('sort'),
    status: c.req.query('status'),
    keyword: c.req.query('keyword'),
    includeDeleted: c.req.query('includeDeleted'),
  })
  return c.json(result.body, result.status)
})

// POST /api/shop-accounts
shopAccountsRoute.post('/', async (c) => {
  const body = await c.req
    .json<{ shopName?: unknown; contactName?: unknown; email?: unknown }>()
    .catch(() => ({}) as { shopName?: unknown; contactName?: unknown; email?: unknown })
  const result = await createShopAccountHandler({
    shopName: body.shopName,
    contactName: body.contactName,
    email: body.email,
    operator: c.get('user'),
    meta: clientMeta(c),
  })
  return c.json(result.body, result.status)
})

// GET /api/shop-accounts/:shopAccountId
shopAccountsRoute.get('/:shopAccountId', async (c) => {
  const result = await getShopAccountHandler({ shopAccountId: c.req.param('shopAccountId') })
  return c.json(result.body, result.status)
})

// PATCH /api/shop-accounts/:shopAccountId/status
shopAccountsRoute.patch('/:shopAccountId/status', async (c) => {
  const body = await c.req
    .json<{ status?: string }>()
    .catch(() => ({}) as { status?: string })
  const result = await updateShopAccountStatusHandler({
    shopAccountId: c.req.param('shopAccountId'),
    operator: c.get('user'),
    status: body.status,
    meta: clientMeta(c),
  })
  return c.json(result.body, result.status)
})

export { shopAccountsRoute }
