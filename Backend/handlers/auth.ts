import bcrypt from 'bcrypt'
import crypto from 'node:crypto'
import {
  applyFailedLoginAttempt,
  findActiveSeAdminByEmail,
  findActiveSeAdminById,
  recordSuccessfulLogin,
  setSeAdminPassword,
} from 'db/se-admin'
import {
  createSession,
  deleteSession,
  deleteSessionsForUser,
  extendSession,
  findValidSession,
} from 'db/sessions'
import { recordAuditLog } from '../lib/audit-log'
import type { AuthUser } from '../middleware/auth'
import type { ClientMeta, HandlerResult, SessionCookieDirective } from './types'

export const SESSION_TTL_MS = 30 * 60 * 1000
const MAX_FAILED_LOGIN = 5

// セッションを新規発行する。セッションID採番はドメインの責務なので handler が行い、
// Cookie への反映（HTTP の関心事）は route に委ねる。
async function issueSession(seAdminUserId: string): Promise<SessionCookieDirective> {
  const sessionId = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await createSession(sessionId, seAdminUserId, expiresAt)
  return { action: 'set', sessionId, maxAgeSeconds: SESSION_TTL_MS / 1000 }
}

export interface LoginInput {
  email?: string
  password?: string
  meta: ClientMeta
}

export async function loginHandler(input: LoginInput): Promise<HandlerResult> {
  const { email, password, meta } = input

  if (!email || !password) {
    return { status: 400, body: { error: 'メールアドレスとパスワードは必須です' } }
  }

  const user = await findActiveSeAdminByEmail(email)

  if (!user) {
    await recordAuditLog({
      operatorType: 'se_admin',
      actionType: 'LOGIN_FAILURE',
      result: 'FAILURE',
      detail: 'ユーザーが見つかりません',
      ...meta,
    })
    return { status: 401, body: { error: 'メールアドレスまたはパスワードが正しくありません' } }
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
      ...meta,
    })
    return {
      status: 403,
      body: { error: 'アカウントがロックされています。管理者に連絡してください。' },
    }
  }

  // パスワードが NULL のアカウントは旧方式（パスワード未設定運用）の名残でログイン不可。
  // 現方式では作成時に必ず初期パスワードが入るため、CLI での再作成が復旧手段。
  // 認証が成功し得ないアカウントのため、連続失敗カウントは加算しない。
  if (user.password === null) {
    await recordAuditLog({
      operatorType: 'se_admin',
      seAdminUserId: user.seAdminUserId,
      actionType: 'LOGIN_FAILURE',
      targetType: 'se_admin_user',
      targetId: user.seAdminUserId,
      result: 'FAILURE',
      detail: 'パスワード未設定（旧方式アカウント）のためログイン不可',
      ...meta,
    })
    return { status: 401, body: { error: 'メールアドレスまたはパスワードが正しくありません' } }
  }

  // パスワード検証
  const isValid = await bcrypt.compare(password, user.password)
  if (!isValid) {
    const newCount = user.failedLoginCount + 1
    const isLocked = newCount >= MAX_FAILED_LOGIN

    await applyFailedLoginAttempt(user.seAdminUserId, newCount, isLocked)

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
      ...meta,
    })

    if (isLocked) {
      return {
        status: 403,
        body: { error: 'アカウントがロックされました。管理者に連絡してください。' },
      }
    }
    return { status: 401, body: { error: 'メールアドレスまたはパスワードが正しくありません' } }
  }

  // 認証成功。初期パスワードのままのユーザーはパスワード変更画面へ誘導する。
  const cookie = await issueSession(user.seAdminUserId)
  await recordSuccessfulLogin(user.seAdminUserId)

  await recordAuditLog({
    operatorType: 'se_admin',
    seAdminUserId: user.seAdminUserId,
    actionType: 'LOGIN_SUCCESS',
    targetType: 'se_admin_user',
    targetId: user.seAdminUserId,
    result: 'SUCCESS',
    ...(user.mustChangePassword ? { detail: '初期パスワード未変更 - パスワード変更画面へ遷移' } : {}),
    ...meta,
  })

  return {
    status: 200,
    body: {
      redirectTo: user.mustChangePassword ? '/password/setup' : '/dashboard',
      mustChangePassword: user.mustChangePassword,
    },
    cookie,
  }
}

export interface LogoutInput {
  sessionId: string | undefined
  operator: AuthUser
  meta: ClientMeta
}

export async function logoutHandler(input: LogoutInput): Promise<HandlerResult> {
  if (input.sessionId) {
    await deleteSession(input.sessionId)
  }

  await recordAuditLog({
    operatorType: 'se_admin',
    seAdminUserId: input.operator.seAdminUserId,
    actionType: 'LOGOUT_SUCCESS',
    targetType: 'se_admin_user',
    targetId: input.operator.seAdminUserId,
    result: 'SUCCESS',
    ...input.meta,
  })

  return { status: 200, body: { message: 'ログアウトしました' }, cookie: { action: 'clear' } }
}

export interface SetPasswordInput {
  operator: AuthUser
  password?: string
  passwordConfirm?: string
  meta: ClientMeta
}

export async function setPasswordHandler(input: SetPasswordInput): Promise<HandlerResult> {
  const { operator, password, passwordConfirm, meta } = input

  if (!operator.mustChangePassword) {
    return { status: 409, body: { error: 'パスワードは既に変更されています' } }
  }

  if (!password || !passwordConfirm) {
    return { status: 400, body: { error: 'パスワードと確認用パスワードは必須です' } }
  }

  if (password !== passwordConfirm) {
    return { status: 400, body: { error: 'パスワードが一致しません' } }
  }

  // パスワードポリシー: 8文字以上、英字と数字を含む
  if (password.length < 8) {
    return { status: 400, body: { error: 'パスワードは8文字以上で入力してください' } }
  }

  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  if (!hasLetter || !hasNumber) {
    return { status: 400, body: { error: 'パスワードは英字と数字を含めてください' } }
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  await setSeAdminPassword(operator.seAdminUserId, hashedPassword)

  // 認証情報の変更に伴い既存セッションを全て破棄し、セッションを再発行する。
  // 初期パスワードが漏えいしていた場合でも、変更完了時点で他者が作成した可能性のある
  // 古いセッションを無効化できる。
  await deleteSessionsForUser(operator.seAdminUserId)
  const cookie = await issueSession(operator.seAdminUserId)

  await recordAuditLog({
    operatorType: 'se_admin',
    seAdminUserId: operator.seAdminUserId,
    actionType: 'SE_ADMIN_PASSWORD_SET',
    targetType: 'se_admin_user',
    targetId: operator.seAdminUserId,
    result: 'SUCCESS',
    detail: '初期パスワードを変更',
    ...meta,
  })

  return {
    status: 200,
    body: { message: 'パスワードを設定しました', redirectTo: '/dashboard' },
    cookie,
  }
}

// セッションを検証し、有効ならユーザーを返してスライディングウィンドウで延長する。
// authMiddleware から利用する（Cookie 読み取り・401 応答は middleware/route の責務）。
export async function authenticateSession(
  sessionId: string,
  now: Date = new Date(),
): Promise<AuthUser | null> {
  const session = await findValidSession(sessionId, now)
  if (!session) {
    return null
  }

  const user = await findActiveSeAdminById(session.seAdminUserId)
  if (!user) {
    return null
  }

  await extendSession(sessionId, new Date(now.getTime() + SESSION_TTL_MS))

  return {
    seAdminUserId: user.seAdminUserId,
    email: user.email,
    mustChangePassword: user.mustChangePassword,
  }
}
