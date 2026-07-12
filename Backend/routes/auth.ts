import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { authMiddleware, type AuthUser } from '../middleware/auth'
import { loginHandler, logoutHandler, setPasswordHandler } from '../handlers/auth'
import { applySessionCookie, clientMeta } from '../lib/http'

const auth = new Hono<{ Variables: { user: AuthUser } }>()

// POST /api/auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>()
  const result = await loginHandler({ email: body.email, password: body.password, meta: clientMeta(c) })
  if (result.cookie) {
    applySessionCookie(c, result.cookie)
  }
  return c.json(result.body, result.status)
})

// POST /api/auth/logout
auth.post('/logout', authMiddleware, async (c) => {
  const result = await logoutHandler({
    sessionId: getCookie(c, 'sessionId'),
    operator: c.get('user'),
    meta: clientMeta(c),
  })
  if (result.cookie) {
    applySessionCookie(c, result.cookie)
  }
  return c.json(result.body, result.status)
})

// GET /api/auth/session
auth.get('/session', authMiddleware, (c) => {
  const user = c.get('user')
  return c.json({
    seAdminUserId: user.seAdminUserId,
    email: user.email,
    mustChangePassword: user.mustChangePassword,
  })
})

// POST /api/auth/password
auth.post('/password', authMiddleware, async (c) => {
  const body = await c.req.json<{ password?: string; passwordConfirm?: string }>()
  const result = await setPasswordHandler({
    operator: c.get('user'),
    password: body.password,
    passwordConfirm: body.passwordConfirm,
    meta: clientMeta(c),
  })
  if (result.cookie) {
    applySessionCookie(c, result.cookie)
  }
  return c.json(result.body, result.status)
})

export { auth }
