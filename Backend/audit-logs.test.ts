import { describe, it, expect, vi, beforeEach } from 'vitest'

const listAuditLogs = vi.fn()
vi.mock('db/audit-logs', () => ({
  listAuditLogs: (...args: unknown[]) => listAuditLogs(...args),
}))

// app.ts が読み込む他ルート/ミドルウェアが実 DB クライアントを読み込まないようスタブする。
vi.mock('db', () => ({ db: {} }))
vi.mock('db/schema', () => ({
  menuItems: Symbol('menuItems'),
  auditLogs: {},
  seAdminUsers: {},
  sessions: {},
}))
vi.mock('db/se-admin', () => ({}))
vi.mock('db/sessions', () => ({}))

vi.mock('./middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('user', { seAdminUserId: 'operator-1', email: 'operator@example.com', isPasswordSet: true })
    await next()
  },
}))

const { app } = await import('./app')

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'

beforeEach(() => {
  listAuditLogs.mockReset()
  listAuditLogs.mockResolvedValue({ rows: [], total: 0 })
})

describe('GET /api/audit-logs', () => {
  it('returns rows with pagination metadata (default limit 50)', async () => {
    const rows = [
      { auditLogId: 'a1', actionType: 'SE_ADMIN_CREATE', result: 'SUCCESS', createdAt: new Date() },
    ]
    listAuditLogs.mockResolvedValue({ rows, total: 120 })

    const res = await app.request('/api/audit-logs')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.pagination).toEqual({ page: 1, limit: 50, total: 120, totalPages: 3 })
    expect(listAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 50 }))
  })

  it('caps limit at the maximum (100)', async () => {
    const res = await app.request('/api/audit-logs?limit=500')
    const body = await res.json()
    expect(body.pagination.limit).toBe(100)
    expect(listAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }))
  })

  it('forwards filters to the data-access layer', async () => {
    const res = await app.request(
      `/api/audit-logs?actionType=SE_ADMIN_DELETE&result=SUCCESS&targetType=se_admin_user&seAdminUserId=${VALID_UUID}&targetId=${VALID_UUID}&dateFrom=2026-01-01&dateTo=2026-12-31`,
    )
    expect(res.status).toBe(200)
    expect(listAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'SE_ADMIN_DELETE',
        result: 'SUCCESS',
        targetType: 'se_admin_user',
        seAdminUserId: VALID_UUID,
        targetId: VALID_UUID,
        dateFrom: expect.any(Date),
        dateTo: expect.any(Date),
      }),
    )
  })

  it('rejects a non-UUID seAdminUserId with 400 (does not query)', async () => {
    const res = await app.request('/api/audit-logs?seAdminUserId=not-a-uuid')
    expect(res.status).toBe(400)
    expect(listAuditLogs).not.toHaveBeenCalled()
  })

  it('rejects a non-UUID targetId with 400', async () => {
    const res = await app.request('/api/audit-logs?targetId=not-a-uuid')
    expect(res.status).toBe(400)
    expect(listAuditLogs).not.toHaveBeenCalled()
  })

  it('rejects an invalid dateFrom with 400', async () => {
    const res = await app.request('/api/audit-logs?dateFrom=not-a-date')
    expect(res.status).toBe(400)
    expect(listAuditLogs).not.toHaveBeenCalled()
  })

  it('rejects an invalid dateTo with 400', async () => {
    const res = await app.request('/api/audit-logs?dateTo=not-a-date')
    expect(res.status).toBe(400)
    expect(listAuditLogs).not.toHaveBeenCalled()
  })
})
