import { findActiveSeAdminById } from 'db/se-admin'
import { extendSession, findValidSession } from 'db/sessions'
import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'

export interface AuthUser {
  seAdminUserId: string
  email: string
  isPasswordSet: boolean
}

export const authMiddleware = createMiddleware<{ Variables: { user: AuthUser } }>(
  async (c, next) => {
    const sessionId = getCookie(c, 'sessionId')
    if (!sessionId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const now = new Date()
    const session = await findValidSession(sessionId, now)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const user = await findActiveSeAdminById(session.seAdminUserId)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // スライディングウィンドウ: セッション有効期限を延長
    await extendSession(sessionId, new Date(now.getTime() + 30 * 60 * 1000))

    c.set('user', {
      seAdminUserId: user.seAdminUserId,
      email: user.email,
      isPasswordSet: user.password !== null,
    })

    await next()
  },
)
