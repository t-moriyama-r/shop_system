import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const state = { selectQueue: [] as unknown[] }
  const makeChain = (provider: () => unknown) => {
    const chain: Record<string, unknown> = {}
    for (const method of ['from', 'where', 'orderBy', 'limit', 'offset', 'set', 'values']) {
      chain[method] = () => chain
    }
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(provider()).then(resolve, reject)
    return chain
  }
  return { state, makeChain }
})

vi.mock('db', () => ({
  db: {
    select: () => h.makeChain(() => h.state.selectQueue.shift() ?? []),
    update: () => h.makeChain(() => undefined),
    delete: () => h.makeChain(() => undefined),
    insert: () => h.makeChain(() => undefined),
  },
  seAdminUsers: {
    seAdminUserId: 'se_admin_user_id',
    email: 'email',
    isLocked: 'is_locked',
    failedLoginCount: 'failed_login_count',
    lastLoginAt: 'last_login_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    isDeleted: 'is_deleted',
  },
  sessions: { sessionId: 'session_id', seAdminUserId: 'se_admin_user_id' },
  menuItems: Symbol('menuItems'),
}))

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
  h.state.selectQueue = []
  recordAuditLog.mockClear()
})

describe('GET /api/se-admin-users', () => {
  it('returns list with pagination metadata', async () => {
    const rows = [
      { seAdminUserId: 'u1', email: 'a@example.com', isLocked: false, failedLoginCount: 0, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date() },
      { seAdminUserId: 'u2', email: 'b@example.com', isLocked: true, failedLoginCount: 5, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date() },
    ]
    h.state.selectQueue = [rows, [{ value: 25 }]]

    const res = await app.request('/api/se-admin-users?page=1&limit=20')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.pagination).toEqual({ page: 1, limit: 20, total: 25, totalPages: 2 })
  })

  it('does not expose password field', async () => {
    const rows = [
      { seAdminUserId: 'u1', email: 'a@example.com', isLocked: false, failedLoginCount: 0, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date() },
    ]
    h.state.selectQueue = [rows, [{ value: 1 }]]

    const res = await app.request('/api/se-admin-users')
    const body = await res.json()
    expect(Object.keys(body.data[0])).not.toContain('password')
  })
})

describe('DELETE /api/se-admin-users/:id', () => {
  it('rejects deleting own account with 403', async () => {
    const res = await app.request('/api/se-admin-users/operator-1', { method: 'DELETE' })
    expect(res.status).toBe(403)
    expect(recordAuditLog).not.toHaveBeenCalled()
  })

  it('returns 404 when target does not exist', async () => {
    h.state.selectQueue = [[]]
    const res = await app.request('/api/se-admin-users/missing-id', { method: 'DELETE' })
    expect(res.status).toBe(404)
  })

  it('logically deletes target and records audit log', async () => {
    h.state.selectQueue = [[{ seAdminUserId: 'u2', email: 'b@example.com', isDeleted: false }]]
    const res = await app.request('/api/se-admin-users/u2', { method: 'DELETE' })
    expect(res.status).toBe(200)
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
  })

  it('returns 404 when target does not exist', async () => {
    h.state.selectQueue = [[]]
    const res = await app.request('/api/se-admin-users/missing/lock', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isLocked: false }),
    })
    expect(res.status).toBe(404)
  })

  it('unlocks account and records ACCOUNT_UNLOCK', async () => {
    h.state.selectQueue = [[{ seAdminUserId: 'u2', email: 'b@example.com', isDeleted: false, isLocked: true }]]
    const res = await app.request('/api/se-admin-users/u2/lock', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isLocked: false }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isLocked).toBe(false)
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'ACCOUNT_UNLOCK', targetId: 'u2' }),
    )
  })
})
