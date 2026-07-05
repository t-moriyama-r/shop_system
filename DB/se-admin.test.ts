import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    selectResult: [] as unknown[],
    insertReturning: [] as unknown[],
    insertTables: [] as unknown[],
    insertValues: [] as unknown[],
  }
  const makeChain = (resolver: () => unknown) => {
    const chain: Record<string, unknown> = {}
    chain.from = () => chain
    chain.where = () => chain
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
      return h.makeChain(() => h.state.insertReturning)
    },
  },
}))

const { createSeAdmin, SeAdminCreateError, isValidEmail } = await import('./se-admin')
const { seAdminUsers, auditLogs } = await import('./schema')

beforeEach(() => {
  h.state.selectResult = []
  h.state.insertReturning = []
  h.state.insertTables = []
  h.state.insertValues = []
})

describe('isValidEmail', () => {
  it('accepts a well-formed address', () => {
    expect(isValidEmail('admin@example.com')).toBe(true)
  })

  it.each(['admin', 'admin@', 'admin@example', 'a b@example.com', ''])(
    'rejects malformed address %j',
    (bad) => {
      expect(isValidEmail(bad)).toBe(false)
    },
  )
})

describe('createSeAdmin', () => {
  it('creates a user with a NULL password and records a SE_ADMIN_CREATE audit log', async () => {
    h.state.selectResult = []
    h.state.insertReturning = [{ seAdminUserId: 'u1', email: 'new@example.com' }]

    const created = await createSeAdmin('new@example.com')

    expect(created).toEqual({ seAdminUserId: 'u1', email: 'new@example.com' })
    // password は指定しない（= NULL / パスワード未設定）
    expect(h.state.insertValues[0]).toEqual({ email: 'new@example.com' })
    expect(Object.keys(h.state.insertValues[0] as object)).not.toContain('password')
    // se_admin_users と audit_logs の 2 回 insert される
    expect(h.state.insertTables).toEqual([seAdminUsers, auditLogs])
    expect(h.state.insertValues[1]).toMatchObject({
      operatorType: 'cli',
      actionType: 'SE_ADMIN_CREATE',
      targetType: 'se_admin_user',
      targetId: 'u1',
      result: 'SUCCESS',
    })
  })

  it('trims surrounding whitespace before persisting', async () => {
    h.state.insertReturning = [{ seAdminUserId: 'u2', email: 'trim@example.com' }]

    await createSeAdmin('  trim@example.com  ')

    expect(h.state.insertValues[0]).toEqual({ email: 'trim@example.com' })
  })

  it('throws and does not insert when the email format is invalid', async () => {
    await expect(createSeAdmin('not-an-email')).rejects.toBeInstanceOf(SeAdminCreateError)
    expect(h.state.insertTables).toHaveLength(0)
  })

  it('throws and does not insert when the email already exists', async () => {
    h.state.selectResult = [{ seAdminUserId: 'existing' }]

    await expect(createSeAdmin('dup@example.com')).rejects.toBeInstanceOf(SeAdminCreateError)
    expect(h.state.insertTables).toHaveLength(0)
  })
})
