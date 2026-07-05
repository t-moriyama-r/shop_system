import { Hono } from 'hono'
import { db } from 'db'
import { seAdminUsers, sessions } from 'db/schema'
import { eq, and } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import crypto from 'node:crypto'
import { getCookie, setCookie } from 'hono/cookie'
import { authMiddleware, type AuthUser } from '../middleware/auth'
import { recordAuditLog } from '../lib/audit-log'

const auth = new Hono<{ Variables: { user: AuthUser } }>()

// POST /api/auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>()
  const { email, password } = body

  if (!email || !password) {
    return c.json({ error: 'メールアドレスとパスワードは必須です' }, 400)
  }

  const ipAddress = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? null
  const userAgent = c.req.header('user-agent') ?? null

  const [user] = await db
    .select()
    .from(seAdminUsers)
    .where(and(eq(seAdminUsers.email, email), eq(seAdminUsers.isDeleted, false)))

  if (!user) {
    await recordAuditLog({
      operatorType: 'se_admin',
      actionType: 'LOGIN_FAILURE',
      result: 'FAILURE',
      detail: 'ユーザーが見つかりません',
      ipAddress,
      userAgent,
    })
    return c.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, 401)
  }

  // アカウントロックチェック
  if (user.isLocked) {
    await recordAuditLog({
      operatorType: 'se_admin',
      seAdminUserId: user.seAdminUserId,
      actionType: 'LOGIN_FAILURE',
      targetType: 'se_admin_user',
      targetId: user.seAdminUserId,
      result: 'FAILURE',
      detail: 'アカウントがロックされています',
      ipAddress,
      userAgent,
    })
    return c.json({ error: 'アカウントがロックされています。管理者に連絡してください。' }, 403)
  }

  // パスワード未設定の場合 - メールアドレスのみで認証しPW設定画面へ
  if (user.password === null) {
    const sessionId = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

    await db.insert(sessions).values({
      sessionId,
      seAdminUserId: user.seAdminUserId,
      expiresAt,
    })

    await db
      .update(seAdminUsers)
      .set({ lastLoginAt: new Date(), failedLoginCount: 0, updatedAt: new Date() })
      .where(eq(seAdminUsers.seAdminUserId, user.seAdminUserId))

    await recordAuditLog({
      operatorType: 'se_admin',
      seAdminUserId: user.seAdminUserId,
      actionType: 'LOGIN_SUCCESS',
      targetType: 'se_admin_user',
      targetId: user.seAdminUserId,
      result: 'SUCCESS',
      detail: 'パスワード未設定 - PW設定画面へ遷移',
      ipAddress,
      userAgent,
    })

    setCookie(c, 'sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: 30 * 60,
    })

    return c.json({ redirectTo: '/password/setup', isPasswordSet: false })
  }

  // パスワード検証
  const isValid = await bcrypt.compare(password, user.password)
  if (!isValid) {
    const newCount = user.failedLoginCount + 1
    const isLocked = newCount >= 5

    await db
      .update(seAdminUsers)
      .set({
        failedLoginCount: newCount,
        isLocked,
        updatedAt: new Date(),
      })
      .where(eq(seAdminUsers.seAdminUserId, user.seAdminUserId))

    await recordAuditLog({
      operatorType: 'se_admin',
      seAdminUserId: user.seAdminUserId,
      actionType: isLocked ? 'ACCOUNT_LOCK' : 'LOGIN_FAILURE',
      targetType: 'se_admin_user',
      targetId: user.seAdminUserId,
      result: 'FAILURE',
      detail: isLocked
        ? `連続ログイン失敗${newCount}回 - アカウントロック`
        : `連続ログイン失敗${newCount}回`,
      ipAddress,
      userAgent,
    })

    if (isLocked) {
      return c.json({ error: 'アカウントがロックされました。管理者に連絡してください。' }, 403)
    }
    return c.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, 401)
  }

  // 認証成功
  const sessionId = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

  await db.insert(sessions).values({
    sessionId,
    seAdminUserId: user.seAdminUserId,
    expiresAt,
  })

  await db
    .update(seAdminUsers)
    .set({ lastLoginAt: new Date(), failedLoginCount: 0, updatedAt: new Date() })
    .where(eq(seAdminUsers.seAdminUserId, user.seAdminUserId))

  await recordAuditLog({
    operatorType: 'se_admin',
    seAdminUserId: user.seAdminUserId,
    actionType: 'LOGIN_SUCCESS',
    targetType: 'se_admin_user',
    targetId: user.seAdminUserId,
    result: 'SUCCESS',
    ipAddress,
    userAgent,
  })

  setCookie(c, 'sessionId', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: 30 * 60,
  })

  return c.json({ redirectTo: '/dashboard', isPasswordSet: true })
})

// POST /api/auth/logout
auth.post('/logout', authMiddleware, async (c) => {
  const sessionId = getCookie(c, 'sessionId')

  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.sessionId, sessionId))
  }

  const user = c.get('user')
  const ipAddress = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? null
  const userAgent = c.req.header('user-agent') ?? null

  await recordAuditLog({
    operatorType: 'se_admin',
    seAdminUserId: user.seAdminUserId,
    actionType: 'LOGOUT_SUCCESS',
    targetType: 'se_admin_user',
    targetId: user.seAdminUserId,
    result: 'SUCCESS',
    ipAddress,
    userAgent,
  })

  setCookie(c, 'sessionId', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
  })

  return c.json({ message: 'ログアウトしました' })
})

// GET /api/auth/session
auth.get('/session', authMiddleware, async (c) => {
  const user = c.get('user')
  return c.json({
    seAdminUserId: user.seAdminUserId,
    email: user.email,
    isPasswordSet: user.isPasswordSet,
  })
})

// POST /api/auth/password
auth.post('/password', authMiddleware, async (c) => {
  const user = c.get('user')

  if (user.isPasswordSet) {
    return c.json({ error: 'パスワードは既に設定されています' }, 409)
  }

  const body = await c.req.json<{ password?: string; passwordConfirm?: string }>()
  const { password, passwordConfirm } = body

  if (!password || !passwordConfirm) {
    return c.json({ error: 'パスワードと確認用パスワードは必須です' }, 400)
  }

  if (password !== passwordConfirm) {
    return c.json({ error: 'パスワードが一致しません' }, 400)
  }

  // パスワードポリシー: 8文字以上、英字と数字を含む
  if (password.length < 8) {
    return c.json({ error: 'パスワードは8文字以上で入力してください' }, 400)
  }

  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  if (!hasLetter || !hasNumber) {
    return c.json({ error: 'パスワードは英字と数字を含めてください' }, 400)
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  await db
    .update(seAdminUsers)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(seAdminUsers.seAdminUserId, user.seAdminUserId))

  // パスワード設定に伴い既存セッションを全て破棄し、セッションを再発行する。
  // パスワード未設定時はメールアドレスのみでセッションが作れるため、設定完了時点で
  // 古いセッション（他者が作成した可能性のあるものを含む）を無効化する。
  await db.delete(sessions).where(eq(sessions.seAdminUserId, user.seAdminUserId))

  const sessionId = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
  await db.insert(sessions).values({
    sessionId,
    seAdminUserId: user.seAdminUserId,
    expiresAt,
  })

  setCookie(c, 'sessionId', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: 30 * 60,
  })

  const ipAddress = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? null
  const userAgent = c.req.header('user-agent') ?? null

  await recordAuditLog({
    operatorType: 'se_admin',
    seAdminUserId: user.seAdminUserId,
    actionType: 'SE_ADMIN_PASSWORD_SET',
    targetType: 'se_admin_user',
    targetId: user.seAdminUserId,
    result: 'SUCCESS',
    ipAddress,
    userAgent,
  })

  return c.json({ message: 'パスワードを設定しました', redirectTo: '/dashboard' })
})

export { auth }
