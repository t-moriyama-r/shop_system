import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    selectResult: [] as unknown[],
    deleteReturning: [] as unknown[],
    insertTables: [] as unknown[],
    insertValues: [] as unknown[],
    updateTables: [] as unknown[],
    updateSets: [] as unknown[],
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
    chain.set = (value: unknown) => {
      state.updateSets.push(value)
      return chain
    }
    chain.values = (value: unknown) => {
      state.insertValues.push(value)
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
    select: () => h.makeChain(() => h.state.selectResult),
    insert: (table: unknown) => {
      h.state.insertTables.push(table)
      return h.makeChain(() => undefined)
    },
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
  findValidSession,
  createSession,
  extendSession,
  deleteSession,
  deleteSessionsForUser,
  deleteExpiredSessions,
} = await import('./sessions')
const { sessions } = await import('./schema')

beforeEach(() => {
  h.state.selectResult = []
  h.state.deleteReturning = []
  h.state.insertTables = []
  h.state.insertValues = []
  h.state.updateTables = []
  h.state.updateSets = []
  h.state.deleteTables = []
  h.state.whereArgs = []
})

describe('findValidSession', () => {
  it('returns the first matching session', async () => {
    h.state.selectResult = [{ sessionId: 's1', seAdminUserId: 'u1' }]
    const session = await findValidSession('s1', new Date())
    expect(session).toEqual({ sessionId: 's1', seAdminUserId: 'u1' })
  })

  it('returns undefined when no session matches', async () => {
    h.state.selectResult = []
    expect(await findValidSession('missing')).toBeUndefined()
  })
})

describe('createSession', () => {
  it('inserts a session with the given id', async () => {
    const expiresAt = new Date('2026-07-04T00:00:00Z')
    await createSession('sid', 'u1', expiresAt)
    expect(h.state.insertTables).toEqual([sessions])
    expect(h.state.insertValues[0]).toEqual({ sessionId: 'sid', seAdminUserId: 'u1', expiresAt })
  })
})

describe('extendSession', () => {
  it('updates the expiry', async () => {
    const expiresAt = new Date('2026-07-04T00:30:00Z')
    await extendSession('sid', expiresAt)
    expect(h.state.updateTables).toEqual([sessions])
    expect(h.state.updateSets[0]).toEqual({ expiresAt })
  })
})

describe('deleteSession', () => {
  it('deletes the single session', async () => {
    await deleteSession('sid')
    expect(h.state.deleteTables).toEqual([sessions])
  })
})

describe('deleteSessionsForUser', () => {
  it('deletes all sessions for the user and returns the count', async () => {
    h.state.deleteReturning = [{ sessionId: 'a' }, { sessionId: 'b' }]
    const count = await deleteSessionsForUser('u1')
    expect(count).toBe(2)
    expect(h.state.deleteTables).toEqual([sessions])
  })
})

describe('deleteExpiredSessions', () => {
  it('deletes expired sessions and returns the number of deleted rows', async () => {
    h.state.deleteReturning = [{ sessionId: 'a' }, { sessionId: 'b' }]
    const count = await deleteExpiredSessions(new Date('2026-07-04T00:00:00Z'))
    expect(count).toBe(2)
    expect(h.state.deleteTables).toEqual([sessions])
  })

  it('returns 0 when no sessions are expired', async () => {
    h.state.deleteReturning = []
    expect(await deleteExpiredSessions()).toBe(0)
  })
})
