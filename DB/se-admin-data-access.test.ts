import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[],
    deleteReturning: [] as unknown[],
    updateTables: [] as unknown[],
    updateSets: [] as unknown[],
    deleteTables: [] as unknown[],
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
    update: (table: unknown) => {
      h.state.updateTables.push(table)
      return h.makeChain(() => undefined)
    },
    delete: (table: unknown) => {
      h.state.deleteTables.push(table)
      return h.makeChain(() => h.state.deleteReturning)
    },
  },
}))

const {
  listSeAdminUsers,
  findActiveSeAdminById,
  findActiveSeAdminByEmail,
  softDeleteSeAdminUser,
  setSeAdminLock,
  recordSuccessfulLogin,
  applyFailedLoginAttempt,
  setSeAdminPassword,
} = await import('./se-admin')
const { seAdminUsers, sessions } = await import('./schema')

beforeEach(() => {
  h.state.selectQueue = []
  h.state.deleteReturning = []
  h.state.updateTables = []
  h.state.updateSets = []
  h.state.deleteTables = []
})

describe('listSeAdminUsers', () => {
  it('returns rows and total from two queries', async () => {
    const rows = [{ seAdminUserId: 'u1', email: 'a@example.com' }]
    h.state.selectQueue = [rows, [{ value: 42 }]]

    const result = await listSeAdminUsers({ page: 1, limit: 20 })
    expect(result.rows).toEqual(rows)
    expect(result.total).toBe(42)
  })
})

describe('findActiveSeAdminById / findActiveSeAdminByEmail', () => {
  it('returns the first matching row', async () => {
    h.state.selectQueue = [[{ seAdminUserId: 'u1', email: 'a@example.com' }]]
    expect(await findActiveSeAdminById('u1')).toMatchObject({ seAdminUserId: 'u1' })
  })

  it('returns undefined when nothing matches', async () => {
    h.state.selectQueue = [[]]
    expect(await findActiveSeAdminByEmail('missing@example.com')).toBeUndefined()
  })
})

describe('softDeleteSeAdminUser', () => {
  it('logically deletes the user and invalidates sessions, returning the count', async () => {
    h.state.deleteReturning = [{ sessionId: 's1' }, { sessionId: 's2' }]
    const count = await softDeleteSeAdminUser('u1')
    expect(count).toBe(2)
    expect(h.state.updateTables).toEqual([seAdminUsers])
    expect(h.state.updateSets[0]).toMatchObject({ isDeleted: true })
    expect(h.state.updateSets[0]).toHaveProperty('deletedAt')
    expect(h.state.deleteTables).toEqual([sessions])
  })
})

describe('setSeAdminLock', () => {
  it('sets isLocked=true without resetting the failure count', async () => {
    await setSeAdminLock('u1', true)
    expect(h.state.updateSets[0]).toMatchObject({ isLocked: true })
    expect(h.state.updateSets[0]).not.toHaveProperty('failedLoginCount')
  })

  it('resets the failure count when unlocking', async () => {
    await setSeAdminLock('u1', false)
    expect(h.state.updateSets[0]).toMatchObject({ isLocked: false, failedLoginCount: 0 })
  })
})

describe('login state updates', () => {
  it('recordSuccessfulLogin resets the failure count and records lastLoginAt', async () => {
    await recordSuccessfulLogin('u1')
    expect(h.state.updateSets[0]).toMatchObject({ failedLoginCount: 0 })
    expect(h.state.updateSets[0]).toHaveProperty('lastLoginAt')
  })

  it('applyFailedLoginAttempt persists the new count and lock state', async () => {
    await applyFailedLoginAttempt('u1', 5, true)
    expect(h.state.updateSets[0]).toMatchObject({ failedLoginCount: 5, isLocked: true })
  })

  it('setSeAdminPassword stores the hashed password', async () => {
    await setSeAdminPassword('u1', 'hashed')
    expect(h.state.updateSets[0]).toMatchObject({ password: 'hashed' })
  })
})
