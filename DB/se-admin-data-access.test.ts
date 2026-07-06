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
  it('2つのクエリから行データと総件数を返す', async () => {
    const rows = [{ seAdminUserId: 'u1', email: 'a@example.com' }]
    h.state.selectQueue = [rows, [{ value: 42 }]]

    const result = await listSeAdminUsers({ page: 1, limit: 20 })
    expect(result.rows).toEqual(rows)
    expect(result.total).toBe(42)
  })
})

describe('findActiveSeAdminById / findActiveSeAdminByEmail', () => {
  it('最初に一致した行を返す', async () => {
    h.state.selectQueue = [[{ seAdminUserId: 'u1', email: 'a@example.com' }]]
    expect(await findActiveSeAdminById('u1')).toMatchObject({ seAdminUserId: 'u1' })
  })

  it('一致するものがない場合はundefinedを返す', async () => {
    h.state.selectQueue = [[]]
    expect(await findActiveSeAdminByEmail('missing@example.com')).toBeUndefined()
  })
})

describe('softDeleteSeAdminUser', () => {
  it('ユーザーを論理削除し、セッションを無効化して件数を返す', async () => {
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
  it('失敗回数をリセットせずにisLocked=trueを設定する', async () => {
    await setSeAdminLock('u1', true)
    expect(h.state.updateSets[0]).toMatchObject({ isLocked: true })
    expect(h.state.updateSets[0]).not.toHaveProperty('failedLoginCount')
  })

  it('ロック解除時に失敗回数をリセットする', async () => {
    await setSeAdminLock('u1', false)
    expect(h.state.updateSets[0]).toMatchObject({ isLocked: false, failedLoginCount: 0 })
  })
})

describe('login state updates', () => {
  it('recordSuccessfulLoginは失敗回数をリセットし、lastLoginAtを記録する', async () => {
    await recordSuccessfulLogin('u1')
    expect(h.state.updateSets[0]).toMatchObject({ failedLoginCount: 0 })
    expect(h.state.updateSets[0]).toHaveProperty('lastLoginAt')
  })

  it('applyFailedLoginAttemptは新しい失敗回数とロック状態を永続化する', async () => {
    await applyFailedLoginAttempt('u1', 5, true)
    expect(h.state.updateSets[0]).toMatchObject({ failedLoginCount: 5, isLocked: true })
  })

  it('setSeAdminPasswordはハッシュ化されたパスワードを保存する', async () => {
    await setSeAdminPassword('u1', 'hashed')
    expect(h.state.updateSets[0]).toMatchObject({ password: 'hashed' })
  })
})
