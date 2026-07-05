import { db } from 'db'
import { sessions, seAdminUsers } from 'db/schema'
import { eq, and, gt } from 'drizzle-orm'
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
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.sessionId, sessionId), gt(sessions.expiresAt, now)))

    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const [user] = await db
      .select()
      .from(seAdminUsers)
      .where(
        and(
          eq(seAdminUsers.seAdminUserId, session.seAdminUserId),
          eq(seAdminUsers.isDeleted, false),
        ),
      )

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // スライディングウィンドウ: セッション有効期限を延長
    const newExpiry = new Date(now.getTime() + 30 * 60 * 1000)
    await db.update(sessions).set({ expiresAt: newExpiry }).where(eq(sessions.sessionId, sessionId))

    c.set('user', {
      seAdminUserId: user.seAdminUserId,
      email: user.email,
      isPasswordSet: user.password !== null,
    })

    await next()
  },
)
