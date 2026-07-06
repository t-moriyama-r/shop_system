import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[],
    updateTables: [] as unknown[],
    updateSets: [] as unknown[],
  }
  const makeChain = (resolver: () => unknown) => {
    const chain: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset']) {
      chain[m] = () => chain
    }
    chain.set = (value: unknown) => {
      state.updateSets.push(value)
      return chain
    }
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(resolver()).then(resolve, reject)
    return chain
  }
  return { state, makeChain }
})

vi.mock('./client', () => ({
  db: {
    select: () => h.makeChain(() => h.state.selectQueue.shift() ?? []),
    update: (table: unknown) => {
      h.state.updateTables.push(table)
      return h.makeChain(() => undefined)
    },
  },
}))

const {
  listShopAccounts,
  findShopAccountById,
  listEmailLogsByShopAccount,
  updateShopAccountStatus,
  isShopAccountStatus,
  SHOP_ACCOUNT_STATUSES,
} = await import('./shop-accounts')
const { shopAccounts } = await import('./schema')

beforeEach(() => {
  h.state.selectQueue = []
  h.state.updateTables = []
  h.state.updateSets = []
})

describe('SHOP_ACCOUNT_STATUSES / isShopAccountStatus', () => {
  it('accepts known statuses and rejects unknown ones', () => {
    expect(SHOP_ACCOUNT_STATUSES).toEqual(['active', 'pending', 'suspended'])
    expect(isShopAccountStatus('active')).toBe(true)
    expect(isShopAccountStatus('deleted')).toBe(false)
  })
})

describe('listShopAccounts', () => {
  it('returns rows and total from two queries', async () => {
    const rows = [{ shopAccountId: 's1', shopName: 'Shop', email: 'a@example.com' }]
    h.state.selectQueue = [rows, [{ value: 7 }]]
    const result = await listShopAccounts({ page: 1, limit: 20 })
    expect(result.rows).toEqual(rows)
    expect(result.total).toBe(7)
  })
})

describe('findShopAccountById', () => {
  it('returns the first matching row', async () => {
    h.state.selectQueue = [[{ shopAccountId: 's1', email: 'a@example.com' }]]
    expect(await findShopAccountById('s1')).toMatchObject({ shopAccountId: 's1' })
  })

  it('returns undefined when nothing matches', async () => {
    h.state.selectQueue = [[]]
    expect(await findShopAccountById('missing')).toBeUndefined()
  })
})

describe('listEmailLogsByShopAccount', () => {
  it('returns the email notification log rows', async () => {
    const logs = [{ emailNotificationLogId: 'e1', sendStatus: 'SENT' }]
    h.state.selectQueue = [logs]
    expect(await listEmailLogsByShopAccount('s1')).toEqual(logs)
  })
})

describe('updateShopAccountStatus', () => {
  it('updates the account status and updatedAt', async () => {
    await updateShopAccountStatus('s1', 'suspended')
    expect(h.state.updateTables).toEqual([shopAccounts])
    expect(h.state.updateSets[0]).toMatchObject({ accountStatus: 'suspended' })
    expect(h.state.updateSets[0]).toHaveProperty('updatedAt')
  })
})
