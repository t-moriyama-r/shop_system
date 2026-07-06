import { describe, it, expect, vi, beforeEach } from 'vitest'

const listAuditLogs = vi.fn()
vi.mock('db/audit-logs', () => ({ listAuditLogs: (...a: unknown[]) => listAuditLogs(...a) }))

const { listAuditLogsHandler } = await import('./audit-logs')

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'

beforeEach(() => {
  listAuditLogs.mockReset()
  listAuditLogs.mockResolvedValue({ rows: [], total: 0 })
})

describe('listAuditLogsHandler', () => {
  it('returns rows with pagination metadata (default limit 50)', async () => {
    listAuditLogs.mockResolvedValue({ rows: [{ auditLogId: 'a1' }], total: 120 })
    const r = await listAuditLogsHandler({})
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ pagination: { page: 1, limit: 50, total: 120, totalPages: 3 } })
    expect(listAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 50 }))
  })

  it('caps limit at the maximum (100)', async () => {
    const r = await listAuditLogsHandler({ limit: '500' })
    expect(r.body).toMatchObject({ pagination: { limit: 100 } })
    expect(listAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }))
  })

  it('forwards filters to the data-access layer', async () => {
    const r = await listAuditLogsHandler({
      actionType: 'SE_ADMIN_DELETE',
      result: 'SUCCESS',
      targetType: 'se_admin_user',
      seAdminUserId: VALID_UUID,
      targetId: VALID_UUID,
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    })
    expect(r.status).toBe(200)
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
    const r = await listAuditLogsHandler({ seAdminUserId: 'not-a-uuid' })
    expect(r.status).toBe(400)
    expect(listAuditLogs).not.toHaveBeenCalled()
  })

  it('rejects a non-UUID targetId with 400', async () => {
    const r = await listAuditLogsHandler({ targetId: 'not-a-uuid' })
    expect(r.status).toBe(400)
    expect(listAuditLogs).not.toHaveBeenCalled()
  })

  it('rejects an invalid dateFrom with 400', async () => {
    const r = await listAuditLogsHandler({ dateFrom: 'not-a-date' })
    expect(r.status).toBe(400)
    expect(listAuditLogs).not.toHaveBeenCalled()
  })

  it('rejects an invalid dateTo with 400', async () => {
    const r = await listAuditLogsHandler({ dateTo: 'not-a-date' })
    expect(r.status).toBe(400)
    expect(listAuditLogs).not.toHaveBeenCalled()
  })
})
