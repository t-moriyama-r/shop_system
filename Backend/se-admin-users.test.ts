import { describe, it, expect, vi, beforeEach } from 'vitest'

const listSeAdminUsers = vi.fn()
const findActiveSeAdminById = vi.fn()
const softDeleteSeAdminUser = vi.fn()
const setSeAdminLock = vi.fn()

vi.mock('db/se-admin', () => ({
  listSeAdminUsers: (...a: unknown[]) => listSeAdminUsers(...a),
  findActiveSeAdminById: (...a: unknown[]) => findActiveSeAdminById(...a),
  softDeleteSeAdminUser: (...a: unknown[]) => softDeleteSeAdminUser(...a),
  setSeAdminLock: (...a: unknown[]) => setSeAdminLock(...a),
}))

// app.ts が読み込む他ルート/ミドルウェアが実 DB クライアントを読み込まないようスタブする。
vi.mock('db', () => ({ db: {} }))
vi.mock('db/schema', () => ({
  menuItems: Symbol('menuItems'),
  auditLogs: {},
  seAdminUsers: {},
  sessions: {},
}))
vi.mock('db/sessions', () => ({}))
vi.mock('db/audit-logs', () => ({}))

vi.mock('./middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('user', { seAdminUserId: 'operator-1', email: 'operator@example.com', isPasswordSet: true })
    await next()
  },
}))

const recordAuditLog = vi.fn()
vi.mock('./lib/audit-log', () => ({ recordAuditLog: (...args: unknown[]) => recordAuditLog(...args) }))

const { app } = await import('./app')

beforeEach(() => {
  vi.clearAllMocks()
  softDeleteSeAdminUser.mockResolvedValue(0)
  setSeAdminLock.mockResolvedValue(undefined)
})

describe('GET /api/se-admin-users', () => {
  it('returns list with pagination metadata', async () => {
    const rows = [
      { seAdminUserId: 'u1', email: 'a@example.com', isLocked: false, failedLoginCount: 0, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date() },
      { seAdminUserId: 'u2', email: 'b@example.com', isLocked: true, failedLoginCount: 5, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date() },
    ]
    listSeAdminUsers.mockResolvedValue({ rows, total: 25 })

    const res = await app.request('/api/se-admin-users?page=1&limit=20')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.pagination).toEqual({ page: 1, limit: 20, total: 25, totalPages: 2 })
    expect(listSeAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }))
  })

  it('parses the isLocked filter into a boolean', async () => {
    listSeAdminUsers.mockResolvedValue({ rows: [], total: 0 })
    await app.request('/api/se-admin-users?isLocked=true')
    expect(listSeAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ isLocked: true }))
  })
})

describe('DELETE /api/se-admin-users/:id', () => {
  it('rejects deleting own account with 403', async () => {
    const res = await app.request('/api/se-admin-users/operator-1', { method: 'DELETE' })
    expect(res.status).toBe(403)
    expect(findActiveSeAdminById).not.toHaveBeenCalled()
    expect(recordAuditLog).not.toHaveBeenCalled()
  })

  it('returns 404 when target does not exist', async () => {
    findActiveSeAdminById.mockResolvedValue(undefined)
    const res = await app.request('/api/se-admin-users/missing-id', { method: 'DELETE' })
    expect(res.status).toBe(404)
    expect(softDeleteSeAdminUser).not.toHaveBeenCalled()
  })

  it('logically deletes target and records audit log', async () => {
    findActiveSeAdminById.mockResolvedValue({ seAdminUserId: 'u2', email: 'b@example.com' })
    const res = await app.request('/api/se-admin-users/u2', { method: 'DELETE' })
    expect(res.status).toBe(200)
    expect(softDeleteSeAdminUser).toHaveBeenCalledWith('u2')
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'SE_ADMIN_DELETE', targetId: 'u2', result: 'SUCCESS' }),
    )
  })
})

describe('PATCH /api/se-admin-users/:id/lock', () => {
  it('returns 400 when isLocked is missing', async () => {
    const res = await app.request('/api/se-admin-users/u2/lock', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    expect(findActiveSeAdminById).not.toHaveBeenCalled()
  })

  it('returns 404 when target does not exist', async () => {
    findActiveSeAdminById.mockResolvedValue(undefined)
    const res = await app.request('/api/se-admin-users/missing/lock', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isLocked: false }),
    })
    expect(res.status).toBe(404)
  })

  it('unlocks account and records ACCOUNT_UNLOCK', async () => {
    findActiveSeAdminById.mockResolvedValue({ seAdminUserId: 'u2', email: 'b@example.com', isLocked: true })
    const res = await app.request('/api/se-admin-users/u2/lock', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isLocked: false }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isLocked).toBe(false)
    expect(setSeAdminLock).toHaveBeenCalledWith('u2', false)
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'ACCOUNT_UNLOCK', targetId: 'u2' }),
    )
  })
})
