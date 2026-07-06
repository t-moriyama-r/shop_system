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

const h2 = vi.hoisted(() => ({ executedSql: [] as unknown[] }))

vi.mock('./client', () => {
  const tx = {
    execute: (query: unknown) => {
      h2.executedSql.push(query)
      return Promise.resolve()
    },
    delete: (table: unknown) => {
      h.state.deleteTables.push(table)
      return h.makeChain(() => h.state.deleteReturning)
    },
  }
  return {
    db: {
      select: () => h.makeChain(() => h.state.selectQueue.shift() ?? []),
      transaction: (fn: (tx: unknown) => unknown) => fn(tx),
    },
  }
})

const { listAuditLogs, deleteExpiredAuditLogs, auditLogRetentionCutoff, AUDIT_LOG_RETENTION_MONTHS } =
  await import('./audit-logs')
const { auditLogs } = await import('./schema')

beforeEach(() => {
  h.state.selectQueue = []
  h.state.deleteReturning = []
  h.state.deleteTables = []
  h.state.whereArgs = []
  h2.executedSql = []
})

describe('listAuditLogs', () => {
  it('行データと総件数を返す', async () => {
    const rows = [{ auditLogId: 'a1', actionType: 'SE_ADMIN_CREATE' }]
    h.state.selectQueue = [rows, [{ value: 120 }]]

    const result = await listAuditLogs({ page: 1, limit: 50 })
    expect(result.rows).toEqual(rows)
    expect(result.total).toBe(120)
  })

  it('フィルタが指定されない場合はWHERE句を省略する', async () => {
    h.state.selectQueue = [[], [{ value: 0 }]]
    await listAuditLogs({ page: 1, limit: 50 })
    // 行取得・件数取得の両方で where(undefined)
    expect(h.state.whereArgs[0]).toBeUndefined()
  })

  it('フィルタが指定された場合はWHERE句を組み立てる', async () => {
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
  it('指定日時から保持期間を差し引く', () => {
    const cutoff = auditLogRetentionCutoff(new Date('2026-07-06T00:00:00Z'))
    expect(cutoff.toISOString()).toBe('2026-06-06T00:00:00.000Z')
  })

  it('保持期間として1か月を使用する', () => {
    expect(AUDIT_LOG_RETENTION_MONTHS).toBe(1)
  })
})

describe('deleteExpiredAuditLogs', () => {
  it('カットオフより古い監査ログを削除し、削除件数を返す', async () => {
    h.state.deleteReturning = [{ auditLogId: 'a' }, { auditLogId: 'b' }]
    const count = await deleteExpiredAuditLogs(new Date('2026-06-06T00:00:00Z'))
    expect(count).toBe(2)
    expect(h.state.deleteTables).toEqual([auditLogs])
    // カットオフ条件で WHERE 句を組み立てている
    expect(h.state.whereArgs[0]).toBeDefined()
    // DB トリガーの改ざん防止を回避するため、削除許可フラグをトランザクション内で有効化している
    expect(h2.executedSql).toHaveLength(1)
  })

  it('期限切れの監査ログがない場合は0を返す', async () => {
    h.state.deleteReturning = []
    expect(await deleteExpiredAuditLogs(new Date('2026-06-06T00:00:00Z'))).toBe(0)
  })
})
