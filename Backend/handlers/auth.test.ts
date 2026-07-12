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
  it('returns 400 when email or password is missing', async () => {
    const r = await loginHandler({ email: '', password: '', meta })
    expect(r.status).toBe(400)
    expect(findActiveSeAdminByEmail).not.toHaveBeenCalled()
  })

  it('returns 401 and audits FAILURE when the user is not found', async () => {
    findActiveSeAdminByEmail.mockResolvedValue(undefined)
    const r = await loginHandler({ email: 'a@x.com', password: 'p', meta })
    expect(r.status).toBe(401)
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'LOGIN_FAILURE', result: 'FAILURE' }),
    )
  })

  it('returns 403 when the account is locked', async () => {
    findActiveSeAdminByEmail.mockResolvedValue({
      seAdminUserId: 'u1',
      isLocked: true,
      password: 'hash',
      failedLoginCount: 0,
    })
    const r = await loginHandler({ email: 'a@x.com', password: 'p', meta })
    expect(r.status).toBe(403)
  })

  it('returns 401 without counting a failure when password is NULL (legacy account)', async () => {
    findActiveSeAdminByEmail.mockResolvedValue({
      seAdminUserId: 'u1',
      isLocked: false,
      password: null,
      failedLoginCount: 0,
    })
    const r = await loginHandler({ email: 'a@x.com', password: 'anything', meta })
    expect(r.status).toBe(401)
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'LOGIN_FAILURE', result: 'FAILURE' }),
    )
    expect(applyFailedLoginAttempt).not.toHaveBeenCalled()
    expect(createSession).not.toHaveBeenCalled()
  })

  it('redirects to password setup when the initial password is unchanged', async () => {
    findActiveSeAdminByEmail.mockResolvedValue({
      seAdminUserId: 'u1',
      isLocked: false,
      password: 'hash',
      mustChangePassword: true,
      failedLoginCount: 0,
    })
    bcryptCompare.mockResolvedValue(true)
    const r = await loginHandler({ email: 'a@x.com', password: 'good', meta })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ redirectTo: '/password/setup', mustChangePassword: true })
    expect(r.cookie).toMatchObject({ action: 'set' })
    expect(createSession).toHaveBeenCalled()
    expect(recordSuccessfulLogin).toHaveBeenCalledWith('u1')
  })

  it('increments failure count and returns 401 on wrong password', async () => {
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

  it('locks the account and returns 403 on the 5th consecutive failure', async () => {
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

  it('issues a session and redirects to dashboard on success', async () => {
    findActiveSeAdminByEmail.mockResolvedValue({
      seAdminUserId: 'u1',
      isLocked: false,
      password: 'hash',
      mustChangePassword: false,
      failedLoginCount: 0,
    })
    bcryptCompare.mockResolvedValue(true)
    const r = await loginHandler({ email: 'a@x.com', password: 'good', meta })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ redirectTo: '/dashboard', mustChangePassword: false })
    expect(r.cookie).toMatchObject({ action: 'set' })
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'LOGIN_SUCCESS', result: 'SUCCESS' }),
    )
  })
})

describe('logoutHandler', () => {
  it('deletes the session, clears the cookie, and audits', async () => {
    const r = await logoutHandler({
      sessionId: 'sid',
      operator: { seAdminUserId: 'u1', email: 'e@x.com', mustChangePassword: false },
      meta,
    })
    expect(r.status).toBe(200)
    expect(deleteSession).toHaveBeenCalledWith('sid')
    expect(r.cookie).toEqual({ action: 'clear' })
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'LOGOUT_SUCCESS' }),
    )
  })

  it('still clears the cookie when there is no session id', async () => {
    const r = await logoutHandler({
      sessionId: undefined,
      operator: { seAdminUserId: 'u1', email: 'e@x.com', mustChangePassword: false },
      meta,
    })
    expect(r.cookie).toEqual({ action: 'clear' })
    expect(deleteSession).not.toHaveBeenCalled()
  })
})

describe('setPasswordHandler', () => {
  const operator = { seAdminUserId: 'u1', email: 'e@x.com', mustChangePassword: true }

  it('returns 409 when the password has already been changed', async () => {
    const r = await setPasswordHandler({
      operator: { ...operator, mustChangePassword: false },
      password: 'Abc12345',
      passwordConfirm: 'Abc12345',
      meta,
    })
    expect(r.status).toBe(409)
  })

  it('returns 400 when fields are missing', async () => {
    const r = await setPasswordHandler({ operator, password: '', passwordConfirm: '', meta })
    expect(r.status).toBe(400)
  })

  it('returns 400 when passwords do not match', async () => {
    const r = await setPasswordHandler({
      operator,
      password: 'Abc12345',
      passwordConfirm: 'Different1',
      meta,
    })
    expect(r.status).toBe(400)
  })

  it('returns 400 when the password is too short', async () => {
    const r = await setPasswordHandler({ operator, password: 'Ab1', passwordConfirm: 'Ab1', meta })
    expect(r.status).toBe(400)
  })

  it('returns 400 when the password lacks a letter/number mix', async () => {
    const r = await setPasswordHandler({
      operator,
      password: 'abcdefgh',
      passwordConfirm: 'abcdefgh',
      meta,
    })
    expect(r.status).toBe(400)
  })

  it('sets the password, rotates sessions, and issues a new session', async () => {
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
  it('returns null when the session is invalid', async () => {
    findValidSession.mockResolvedValue(undefined)
    expect(await authenticateSession('sid')).toBeNull()
  })

  it('returns null when the user no longer exists', async () => {
    findValidSession.mockResolvedValue({ sessionId: 'sid', seAdminUserId: 'u1' })
    findActiveSeAdminById.mockResolvedValue(undefined)
    expect(await authenticateSession('sid')).toBeNull()
  })

  it('returns the AuthUser and extends the session (sliding window)', async () => {
    findValidSession.mockResolvedValue({ sessionId: 'sid', seAdminUserId: 'u1' })
    findActiveSeAdminById.mockResolvedValue({
      seAdminUserId: 'u1',
      email: 'e@x.com',
      password: 'hash',
      mustChangePassword: true,
    })
    const u = await authenticateSession('sid', new Date())
    expect(u).toEqual({ seAdminUserId: 'u1', email: 'e@x.com', mustChangePassword: true })
    expect(extendSession).toHaveBeenCalled()
  })
})
