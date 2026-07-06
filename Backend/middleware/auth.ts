import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { authenticateSession } from '../handlers/auth'

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

    const user = await authenticateSession(sessionId)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    c.set('user', user)

    await next()
  },
)
