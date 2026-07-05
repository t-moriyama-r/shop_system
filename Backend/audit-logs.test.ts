import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[],
    whereArgs: [] as unknown[],
  }
  const makeChain = (provider: () => unknown) => {
    const chain: Record<string, unknown> = {}
    chain.from = () => chain
    chain.where = (arg: unknown) => {
      state.whereArgs.push(arg)
      return chain
    }
    for (const method of ['orderBy', 'limit', 'offset']) {
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
  },
}))

vi.mock('db/schema', () => ({
  auditLogs: {
    auditLogId: 'audit_log_id',
    operatorType: 'operator_type',
    seAdminUserId: 'se_admin_user_id',
    actionType: 'action_type',
    targetType: 'target_type',
    targetId: 'target_id',
    result: 'result',
    detail: 'detail',
    createdAt: 'created_at',
  },
  // app.ts / 他ルートが参照するため最低限モックしておく
  menuItems: Symbol('menuItems'),
  seAdminUsers: { seAdminUserId: 'se_admin_user_id', email: 'email', isDeleted: 'is_deleted' },
  sessions: { sessionId: 'session_id', seAdminUserId: 'se_admin_user_id' },
}))

vi.mock('./middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('user', { seAdminUserId: 'operator-1', email: 'operator@example.com', isPasswordSet: true })
    await next()
  },
}))

const { app } = await import('./app')

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'

beforeEach(() => {
  h.state.selectQueue = []
  h.state.whereArgs = []
})

describe('GET /api/audit-logs', () => {
  it('returns rows with pagination metadata (default limit 50)', async () => {
    const rows = [
      { auditLogId: 'a1', actionType: 'SE_ADMIN_CREATE', result: 'SUCCESS', createdAt: new Date() },
    ]
    h.state.selectQueue = [rows, [{ value: 120 }]]

    const res = await app.request('/api/audit-logs')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.pagination).toEqual({ page: 1, limit: 50, total: 120, totalPages: 3 })
    // フィルタなしのときは where(undefined)
    expect(h.state.whereArgs[0]).toBeUndefined()
  })

  it('caps limit at the maximum (100)', async () => {
    h.state.selectQueue = [[], [{ value: 0 }]]
    const res = await app.request('/api/audit-logs?limit=500')
    const body = await res.json()
    expect(body.pagination.limit).toBe(100)
  })

  it('applies a WHERE clause when filters are provided', async () => {
    h.state.selectQueue = [[], [{ value: 0 }]]
    const res = await app.request(
      `/api/audit-logs?actionType=SE_ADMIN_DELETE&result=SUCCESS&targetType=se_admin_user&seAdminUserId=${VALID_UUID}&targetId=${VALID_UUID}&dateFrom=2026-01-01&dateTo=2026-12-31`,
    )
    expect(res.status).toBe(200)
    expect(h.state.whereArgs[0]).toBeDefined()
  })

  it('rejects a non-UUID seAdminUserId with 400', async () => {
    const res = await app.request('/api/audit-logs?seAdminUserId=not-a-uuid')
    expect(res.status).toBe(400)
  })

  it('rejects a non-UUID targetId with 400', async () => {
    const res = await app.request('/api/audit-logs?targetId=not-a-uuid')
    expect(res.status).toBe(400)
  })

  it('rejects an invalid dateFrom with 400', async () => {
    const res = await app.request('/api/audit-logs?dateFrom=not-a-date')
    expect(res.status).toBe(400)
  })

  it('rejects an invalid dateTo with 400', async () => {
    const res = await app.request('/api/audit-logs?dateTo=not-a-date')
    expect(res.status).toBe(400)
  })
})
