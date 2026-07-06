import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const state = { selectQueue: [] as unknown[] }
  const makeChain = (resolver: () => unknown) => {
    const chain: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset']) {
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

const { getDashboardSummary, listShopAccountActivities } = await import('./dashboard')

beforeEach(() => {
  h.state.selectQueue = []
})

describe('getDashboardSummary', () => {
  it('ショップアカウントのステータス別件数とSE管理者の合計を集計する', async () => {
    h.state.selectQueue = [
      [{ total: 5, active: 2, pending: 2, suspended: 1 }],
      [{ total: 3 }],
    ]
    const summary = await getDashboardSummary()
    expect(summary).toEqual({
      shopAccounts: { total: 5, active: 2, pending: 2, suspended: 1 },
      seAdmins: { total: 3 },
    })
  })
})

describe('listShopAccountActivities', () => {
  it('アカウントごとに最新のメールログを付加する（降順の先頭が採用される）', async () => {
    const accounts = [
      { shopAccountId: 's1', shopName: 'A', email: 'a@x', accountStatus: 'active', issuedBySeAdminUserId: 'op', createdAt: new Date() },
      { shopAccountId: 's2', shopName: 'B', email: 'b@x', accountStatus: 'pending', issuedBySeAdminUserId: 'op', createdAt: new Date() },
    ]
    const logs = [
      { shopAccountId: 's1', notificationType: 'ACCOUNT_ISSUED', sendStatus: 'SENT', sentAt: new Date(), errorMessage: null, createdAt: new Date('2026-02-01') },
      { shopAccountId: 's1', notificationType: 'ACCOUNT_ISSUED', sendStatus: 'PENDING', sentAt: null, errorMessage: null, createdAt: new Date('2026-01-01') },
    ]
    h.state.selectQueue = [accounts, logs]

    const result = await listShopAccountActivities(10)
    expect(result).toHaveLength(2)
    expect(result[0].latestNotification?.sendStatus).toBe('SENT')
    expect(result[1].latestNotification).toBeNull()
  })

  it('アカウントが存在しない場合は2件目のクエリを実行せず空配列を返す', async () => {
    h.state.selectQueue = [[]]
    expect(await listShopAccountActivities(10)).toEqual([])
  })
})
