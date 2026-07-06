import { Hono } from 'hono'
import { authMiddleware, type AuthUser } from '../middleware/auth'
import {
  deleteSeAdminUserHandler,
  listSeAdminUsersHandler,
  setSeAdminLockHandler,
} from '../handlers/se-admin-users'
import { clientMeta } from '../lib/http'

const seAdminUsersRoute = new Hono<{ Variables: { user: AuthUser } }>()

seAdminUsersRoute.use('*', authMiddleware)

// GET /api/se-admin-users
seAdminUsersRoute.get('/', async (c) => {
  const result = await listSeAdminUsersHandler({
    page: c.req.query('page'),
    limit: c.req.query('limit'),
    keyword: c.req.query('keyword'),
    isLocked: c.req.query('isLocked'),
    sort: c.req.query('sort'),
  })
  return c.json(result.body, result.status)
})

// DELETE /api/se-admin-users/:seAdminUserId
seAdminUsersRoute.delete('/:seAdminUserId', async (c) => {
  const result = await deleteSeAdminUserHandler({
    targetId: c.req.param('seAdminUserId'),
    operator: c.get('user'),
    meta: clientMeta(c),
  })
  return c.json(result.body, result.status)
})

// PATCH /api/se-admin-users/:seAdminUserId/lock
seAdminUsersRoute.patch('/:seAdminUserId/lock', async (c) => {
  const body = await c.req
    .json<{ isLocked?: boolean }>()
    .catch(() => ({}) as { isLocked?: boolean })
  const result = await setSeAdminLockHandler({
    targetId: c.req.param('seAdminUserId'),
    operator: c.get('user'),
    isLocked: body.isLocked,
    meta: clientMeta(c),
  })
  return c.json(result.body, result.status)
})

export { seAdminUsersRoute }
