import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[],
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
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(resolver()).then(resolve, reject)
    return chain
  }
  return { state, makeChain }
})

vi.mock('./client', () => ({
  db: { select: () => h.makeChain(() => h.state.selectQueue.shift() ?? []) },
}))

const { listAuditLogs } = await import('./audit-logs')

beforeEach(() => {
  h.state.selectQueue = []
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
