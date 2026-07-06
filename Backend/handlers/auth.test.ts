import { describe, it, expect, vi, beforeEach } from 'vitest'

const findActiveSeAdminByEmail = vi.fn()
const findActiveSeAdminById = vi.fn()
const recordSuccessfulLogin = vi.fn()
const applyFailedLoginAttempt = vi.fn()
const setSeAdminPassword = vi.fn()
vi.mock('db/se-admin', () => ({
  findActiveSeAdminByEmail: (...a: unknown[]) => findActiveSeAdminByEmail(...a),
  findActiveSeAdminById: (...a: unknown[]) => findActiveSeAdminById(...a),
  recordSuccessfulLogin: (...a: unknown[]) => recordSuccessfulLogin(...a),
  applyFailedLoginAttempt: (...a: unknown[]) => applyFailedLoginAttempt(...a),
  setSeAdminPassword: (...a: unknown[]) => setSeAdminPassword(...a),
}))

const createSession = vi.fn()
const deleteSession = vi.fn()
const deleteSessionsForUser = vi.fn()
const extendSession = vi.fn()
const findValidSession = vi.fn()
vi.mock('db/sessions', () => ({
  createSession: (...a: unknown[]) => createSession(...a),
  deleteSession: (...a: unknown[]) => deleteSession(...a),
  deleteSessionsForUser: (...a: unknown[]) => deleteSessionsForUser(...a),
  extendSession: (...a: unknown[]) => extendSession(...a),
  findValidSession: (...a: unknown[]) => findValidSession(...a),
}))

const recordAuditLog = vi.fn()
vi.mock('../lib/audit-log', () => ({ recordAuditLog: (...a: unknown[]) => recordAuditLog(...a) }))

const bcryptCompare = vi.fn()
const bcryptHash = vi.fn()
vi.mock('bcrypt', () => ({
  default: {
    compare: (...a: unknown[]) => bcryptCompare(...a),
    hash: (...a: unknown[]) => bcryptHash(...a),
  },
}))

const { loginHandler, logoutHandler, setPasswordHandler, authenticateSession } = await import(
  './auth'
)

const meta = { ipAddress: null, userAgent: null }

beforeEach(() => {
  vi.clearAllMocks()
  createSession.mockResolvedValue(undefined)
  recordSuccessfulLogin.mockResolvedValue(undefined)
  applyFailedLoginAttempt.mockResolvedValue(undefined)
  setSeAdminPassword.mockResolvedValue(undefined)
  deleteSession.mockResolvedValue(undefined)
  deleteSessionsForUser.mockResolvedValue(0)
  extendSession.mockResolvedValue(undefined)
})

describe('loginHandler', () => {
  it('メールまたはパスワードが未指定の場合は400を返す', async () => {
    const r = await loginHandler({ email: '', password: '', meta })
    expect(r.status).toBe(400)
    expect(findActiveSeAdminByEmail).not.toHaveBeenCalled()
  })

  it('ユーザーが見つからない場合は401を返し、FAILUREを監査ログに記録する', async () => {
    findActiveSeAdminByEmail.mockResolvedValue(undefined)
    const r = await loginHandler({ email: 'a@x.com', password: 'p', meta })
    expect(r.status).toBe(401)
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'LOGIN_FAILURE', result: 'FAILURE' }),
    )
  })

  it('アカウントがロックされている場合は403を返す', async () => {
    findActiveSeAdminByEmail.mockResolvedValue({
      seAdminUserId: 'u1',
      isLocked: true,
      password: 'hash',
      failedLoginCount: 0,
    })
    const r = await loginHandler({ email: 'a@x.com', password: 'p', meta })
    expect(r.status).toBe(403)
  })

  it('パスワード未設定の場合はセッションを発行し、設定画面へリダイレクトする', async () => {
    findActiveSeAdminByEmail.mockResolvedValue({
      seAdminUserId: 'u1',
      isLocked: false,
      password: null,
      failedLoginCount: 0,
    })
    const r = await loginHandler({ email: 'a@x.com', password: 'anything', meta })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ redirectTo: '/password/setup', isPasswordSet: false })
    expect(r.cookie).toMatchObject({ action: 'set' })
    expect(createSession).toHaveBeenCalled()
    expect(recordSuccessfulLogin).toHaveBeenCalledWith('u1')
  })

  it('パスワードが誤っている場合は失敗回数を加算し、401を返す', async () => {
    findActiveSeAdminByEmail.mockResolvedValue({
      seAdminUserId: 'u1',
      isLocked: false,
      password: 'hash',
      failedLoginCount: 0,
    })
    bcryptCompare.mockResolvedValue(false)
    const r = await loginHandler({ email: 'a@x.com', password: 'bad', meta })
    expect(r.status).toBe(401)
    expect(applyFailedLoginAttempt).toHaveBeenCalledWith('u1', 1, false)
  })

  it('5回連続で失敗した場合はアカウントをロックし、403を返す', async () => {
    findActiveSeAdminByEmail.mockResolvedValue({
      seAdminUserId: 'u1',
      isLocked: false,
      password: 'hash',
      failedLoginCount: 4,
    })
    bcryptCompare.mockResolvedValue(false)
    const r = await loginHandler({ email: 'a@x.com', password: 'bad', meta })
    expect(r.status).toBe(403)
    expect(applyFailedLoginAttempt).toHaveBeenCalledWith('u1', 5, true)
  })

  it('成功時はセッションを発行し、ダッシュボードへリダイレクトする', async () => {
    findActiveSeAdminByEmail.mockResolvedValue({
      seAdminUserId: 'u1',
      isLocked: false,
      password: 'hash',
      failedLoginCount: 0,
    })
    bcryptCompare.mockResolvedValue(true)
    const r = await loginHandler({ email: 'a@x.com', password: 'good', meta })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ redirectTo: '/dashboard', isPasswordSet: true })
    expect(r.cookie).toMatchObject({ action: 'set' })
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'LOGIN_SUCCESS', result: 'SUCCESS' }),
    )
  })
})

describe('logoutHandler', () => {
  it('セッションを削除し、クッキーをクリアして監査ログに記録する', async () => {
    const r = await logoutHandler({
      sessionId: 'sid',
      operator: { seAdminUserId: 'u1', email: 'e@x.com', isPasswordSet: true },
      meta,
    })
    expect(r.status).toBe(200)
    expect(deleteSession).toHaveBeenCalledWith('sid')
    expect(r.cookie).toEqual({ action: 'clear' })
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'LOGOUT_SUCCESS' }),
    )
  })

  it('セッションIDがない場合でもクッキーをクリアする', async () => {
    const r = await logoutHandler({
      sessionId: undefined,
      operator: { seAdminUserId: 'u1', email: 'e@x.com', isPasswordSet: true },
      meta,
    })
    expect(r.cookie).toEqual({ action: 'clear' })
    expect(deleteSession).not.toHaveBeenCalled()
  })
})

describe('setPasswordHandler', () => {
  const operator = { seAdminUserId: 'u1', email: 'e@x.com', isPasswordSet: false }

  it('パスワードが既に設定済みの場合は409を返す', async () => {
    const r = await setPasswordHandler({
      operator: { ...operator, isPasswordSet: true },
      password: 'Abc12345',
      passwordConfirm: 'Abc12345',
      meta,
    })
    expect(r.status).toBe(409)
  })

  it('必須項目が未指定の場合は400を返す', async () => {
    const r = await setPasswordHandler({ operator, password: '', passwordConfirm: '', meta })
    expect(r.status).toBe(400)
  })

  it('パスワードが一致しない場合は400を返す', async () => {
    const r = await setPasswordHandler({
      operator,
      password: 'Abc12345',
      passwordConfirm: 'Different1',
      meta,
    })
    expect(r.status).toBe(400)
  })

  it('パスワードが短すぎる場合は400を返す', async () => {
    const r = await setPasswordHandler({ operator, password: 'Ab1', passwordConfirm: 'Ab1', meta })
    expect(r.status).toBe(400)
  })

  it('パスワードが英数字混在でない場合は400を返す', async () => {
    const r = await setPasswordHandler({
      operator,
      password: 'abcdefgh',
      passwordConfirm: 'abcdefgh',
      meta,
    })
    expect(r.status).toBe(400)
  })

  it('パスワードを設定し、セッションを入れ替えて新しいセッションを発行する', async () => {
    bcryptHash.mockResolvedValue('hashed')
    const r = await setPasswordHandler({
      operator,
      password: 'Abc12345',
      passwordConfirm: 'Abc12345',
      meta,
    })
    expect(r.status).toBe(200)
    expect(setSeAdminPassword).toHaveBeenCalledWith('u1', 'hashed')
    expect(deleteSessionsForUser).toHaveBeenCalledWith('u1')
    expect(createSession).toHaveBeenCalled()
    expect(r.cookie).toMatchObject({ action: 'set' })
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'SE_ADMIN_PASSWORD_SET' }),
    )
  })
})

describe('authenticateSession', () => {
  it('セッションが無効な場合はnullを返す', async () => {
    findValidSession.mockResolvedValue(undefined)
    expect(await authenticateSession('sid')).toBeNull()
  })

  it('ユーザーが既に存在しない場合はnullを返す', async () => {
    findValidSession.mockResolvedValue({ sessionId: 'sid', seAdminUserId: 'u1' })
    findActiveSeAdminById.mockResolvedValue(undefined)
    expect(await authenticateSession('sid')).toBeNull()
  })

  it('AuthUserを返し、セッションを延長する（スライディングウィンドウ）', async () => {
    findValidSession.mockResolvedValue({ sessionId: 'sid', seAdminUserId: 'u1' })
    findActiveSeAdminById.mockResolvedValue({ seAdminUserId: 'u1', email: 'e@x.com', password: 'hash' })
    const u = await authenticateSession('sid', new Date())
    expect(u).toEqual({ seAdminUserId: 'u1', email: 'e@x.com', isPasswordSet: true })
    expect(extendSession).toHaveBeenCalled()
  })
})
