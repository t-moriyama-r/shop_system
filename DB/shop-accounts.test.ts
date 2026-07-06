import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[],
    updateTables: [] as unknown[],
    updateSets: [] as unknown[],
    insertTables: [] as unknown[],
    insertValues: [] as unknown[],
    returningQueue: [] as unknown[],
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
    chain.values = (value: unknown) => {
      state.insertValues.push(value)
      return chain
    }
    chain.returning = () => chain
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(resolver()).then(resolve, reject)
    return chain
  }
  const makeDb = () => ({
    select: () => makeChain(() => state.selectQueue.shift() ?? []),
    update: (table: unknown) => {
      state.updateTables.push(table)
      return makeChain(() => undefined)
    },
    insert: (table: unknown) => {
      state.insertTables.push(table)
      return makeChain(() => state.returningQueue.shift() ?? [])
    },
  })
  return { state, makeChain, makeDb }
})

vi.mock('./client', () => {
  const db = { ...h.makeDb(), transaction: (fn: (tx: unknown) => unknown) => fn(db) }
  return { db }
})

const {
  listShopAccounts,
  findShopAccountById,
  findShopAccountByEmail,
  createShopAccount,
  listEmailLogsByShopAccount,
  updateShopAccountStatus,
  isShopAccountStatus,
  SHOP_ACCOUNT_STATUSES,
} = await import('./shop-accounts')
const { shopAccounts, emailNotificationLogs } = await import('./schema')

beforeEach(() => {
  h.state.selectQueue = []
  h.state.updateTables = []
  h.state.updateSets = []
  h.state.insertTables = []
  h.state.insertValues = []
  h.state.returningQueue = []
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

describe('findShopAccountByEmail', () => {
  it('returns the matching row (including logically deleted)', async () => {
    h.state.selectQueue = [[{ shopAccountId: 's1' }]]
    expect(await findShopAccountByEmail('a@example.com')).toMatchObject({ shopAccountId: 's1' })
  })

  it('returns undefined when the email is not registered', async () => {
    h.state.selectQueue = [[]]
    expect(await findShopAccountByEmail('none@example.com')).toBeUndefined()
  })
})

describe('createShopAccount', () => {
  it('inserts the account and a PENDING email log in one transaction', async () => {
    h.state.returningQueue = [[{ shopAccountId: 's1', email: 'a@example.com' }]]

    const result = await createShopAccount({
      shopName: 'Shop',
      contactName: 'Taro',
      email: 'a@example.com',
      initialPasswordHash: 'hashed',
      issuedBySeAdminUserId: 'op-1',
    })

    expect(result).toMatchObject({ shopAccountId: 's1' })
    expect(h.state.insertTables).toEqual([shopAccounts, emailNotificationLogs])

    const accountValues = h.state.insertValues[0] as Record<string, unknown>
    expect(accountValues).toMatchObject({
      shopName: 'Shop',
      email: 'a@example.com',
      initialPasswordHash: 'hashed',
      accountStatus: 'pending',
      issuedBySeAdminUserId: 'op-1',
    })

    const logValues = h.state.insertValues[1] as Record<string, unknown>
    expect(logValues).toMatchObject({
      shopAccountId: 's1',
      toEmail: 'a@example.com',
      notificationType: 'SHOP_ACCOUNT_ISSUED',
      sendStatus: 'PENDING',
    })
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
