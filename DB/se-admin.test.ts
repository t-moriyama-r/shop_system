import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    selectResult: [] as unknown[],
    insertReturning: [] as unknown[],
    insertTables: [] as unknown[],
    insertValues: [] as unknown[],
    deleteReturning: [] as unknown[],
    updateTables: [] as unknown[],
    updateSets: [] as unknown[],
    deleteTables: [] as unknown[],
  }
  const makeChain = (resolver: () => unknown) => {
    const chain: Record<string, unknown> = {}
    chain.from = () => chain
    chain.where = () => chain
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
      return h.makeChain(() => h.state.insertReturning)
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

const { createSeAdmin, deleteSeAdmin, SeAdminCreateError, SeAdminDeleteError, isValidEmail, isUuid } =
  await import('./se-admin')
const { seAdminUsers, auditLogs, sessions } = await import('./schema')

beforeEach(() => {
  h.state.selectResult = []
  h.state.insertReturning = []
  h.state.insertTables = []
  h.state.insertValues = []
  h.state.deleteReturning = []
  h.state.updateTables = []
  h.state.updateSets = []
  h.state.deleteTables = []
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

describe('isUuid', () => {
  it('accepts a UUID', () => {
    expect(isUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
  })

  it.each(['admin@example.com', '123e4567', 'not-a-uuid', ''])('rejects non-UUID %j', (bad) => {
    expect(isUuid(bad)).toBe(false)
  })
})

describe('deleteSeAdmin', () => {
  it('logically deletes the user, invalidates sessions, and records a SE_ADMIN_DELETE audit log', async () => {
    h.state.selectResult = [{ seAdminUserId: 'u1', email: 'target@example.com' }]
    h.state.deleteReturning = [{ sessionId: 's1' }, { sessionId: 's2' }]

    const deleted = await deleteSeAdmin('target@example.com')

    expect(deleted).toEqual({
      seAdminUserId: 'u1',
      email: 'target@example.com',
      invalidatedSessionCount: 2,
    })
    // 論理削除: is_deleted=true / deleted_at / updated_at を更新（物理削除しない）
    expect(h.state.updateTables).toEqual([seAdminUsers])
    expect(h.state.updateSets[0]).toMatchObject({ isDeleted: true })
    expect(h.state.updateSets[0]).toHaveProperty('deletedAt')
    // 該当ユーザーのセッションを削除
    expect(h.state.deleteTables).toEqual([sessions])
    // audit_logs に SE_ADMIN_DELETE(cli) を記録
    expect(h.state.insertTables).toEqual([auditLogs])
    expect(h.state.insertValues[0]).toMatchObject({
      operatorType: 'cli',
      actionType: 'SE_ADMIN_DELETE',
      targetType: 'se_admin_user',
      targetId: 'u1',
      result: 'SUCCESS',
    })
  })

  it('looks up by email when the identifier is not a UUID (and trims it)', async () => {
    h.state.selectResult = [{ seAdminUserId: 'u2', email: 'by-mail@example.com' }]

    const deleted = await deleteSeAdmin('  by-mail@example.com  ')

    expect(deleted.seAdminUserId).toBe('u2')
    expect(h.state.updateTables).toEqual([seAdminUsers])
  })

  it('accepts a UUID identifier', async () => {
    h.state.selectResult = [
      { seAdminUserId: '123e4567-e89b-12d3-a456-426614174000', email: 'by-id@example.com' },
    ]

    const deleted = await deleteSeAdmin('123e4567-e89b-12d3-a456-426614174000')

    expect(deleted.email).toBe('by-id@example.com')
  })

  it('throws and does not mutate when the identifier is empty', async () => {
    await expect(deleteSeAdmin('   ')).rejects.toBeInstanceOf(SeAdminDeleteError)
    expect(h.state.updateTables).toHaveLength(0)
    expect(h.state.deleteTables).toHaveLength(0)
    expect(h.state.insertTables).toHaveLength(0)
  })

  it('throws and does not mutate when the target is not found', async () => {
    h.state.selectResult = []

    await expect(deleteSeAdmin('missing@example.com')).rejects.toBeInstanceOf(SeAdminDeleteError)
    expect(h.state.updateTables).toHaveLength(0)
    expect(h.state.deleteTables).toHaveLength(0)
    expect(h.state.insertTables).toHaveLength(0)
  })
})
