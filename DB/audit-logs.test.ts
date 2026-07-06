import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[],
    deleteReturning: [] as unknown[],
    deleteTables: [] as unknown[],
    whereArgs: [] as unknown[],
  }
  const makeChain = (resolver: () => unknown) => {
    const chain: Record<string, unknown> = {}
    chain.from = () => chain
    chain.where = (arg: unknown) => {
      state.whereArgs.push(arg)
      return chain
    }
    for (const m of ['orderBy', 'limit', 'offset']) {
      chain[m] = () => chain
    }
    chain.returning = () => Promise.resolve(resolver())
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(resolver()).then(resolve, reject)
    return chain
  }
  return { state, makeChain }
})

vi.mock('./client', () => ({
  db: {
    select: () => h.makeChain(() => h.state.selectQueue.shift() ?? []),
    delete: (table: unknown) => {
      h.state.deleteTables.push(table)
      return h.makeChain(() => h.state.deleteReturning)
    },
  },
}))

const { listAuditLogs, deleteExpiredAuditLogs, auditLogRetentionCutoff, AUDIT_LOG_RETENTION_MONTHS } =
  await import('./audit-logs')
const { auditLogs } = await import('./schema')

beforeEach(() => {
  h.state.selectQueue = []
  h.state.deleteReturning = []
  h.state.deleteTables = []
  h.state.whereArgs = []
})

describe('listAuditLogs', () => {
  it('returns rows and total', async () => {
    const rows = [{ auditLogId: 'a1', actionType: 'SE_ADMIN_CREATE' }]
    h.state.selectQueue = [rows, [{ value: 120 }]]

    const result = await listAuditLogs({ page: 1, limit: 50 })
    expect(result.rows).toEqual(rows)
    expect(result.total).toBe(120)
  })

  it('omits the WHERE clause when no filters are provided', async () => {
    h.state.selectQueue = [[], [{ value: 0 }]]
    await listAuditLogs({ page: 1, limit: 50 })
    // 行取得・件数取得の両方で where(undefined)
    expect(h.state.whereArgs[0]).toBeUndefined()
  })

  it('builds a WHERE clause when filters are provided', async () => {
    h.state.selectQueue = [[], [{ value: 0 }]]
    await listAuditLogs({
      page: 1,
      limit: 50,
      actionType: 'SE_ADMIN_DELETE',
      result: 'SUCCESS',
      dateFrom: new Date('2026-01-01'),
    })
    expect(h.state.whereArgs[0]).toBeDefined()
  })
})

describe('auditLogRetentionCutoff', () => {
  it('subtracts the retention period from the given time', () => {
    const cutoff = auditLogRetentionCutoff(new Date('2026-07-06T00:00:00Z'))
    expect(cutoff.toISOString()).toBe('2026-06-06T00:00:00.000Z')
  })

  it('uses a one-month retention period', () => {
    expect(AUDIT_LOG_RETENTION_MONTHS).toBe(1)
  })
})

describe('deleteExpiredAuditLogs', () => {
  it('deletes audit logs older than the cutoff and returns the number of deleted rows', async () => {
    h.state.deleteReturning = [{ auditLogId: 'a' }, { auditLogId: 'b' }]
    const count = await deleteExpiredAuditLogs(new Date('2026-06-06T00:00:00Z'))
    expect(count).toBe(2)
    expect(h.state.deleteTables).toEqual([auditLogs])
    // カットオフ条件で WHERE 句を組み立てている
    expect(h.state.whereArgs[0]).toBeDefined()
  })

  it('returns 0 when no audit logs are expired', async () => {
    h.state.deleteReturning = []
    expect(await deleteExpiredAuditLogs(new Date('2026-06-06T00:00:00Z'))).toBe(0)
  })
})
