import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { authenticateSession } from '../handlers/auth'

export interface AuthUser {
  seAdminUserId: string
  email: string
  /** true = メール送付された初期パスワードのまま（パスワード変更画面以外の利用は不可） */
  mustChangePassword: boolean
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
