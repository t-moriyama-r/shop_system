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

vi.mock('./client', () => {
  const db: Record<string, unknown> = {
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
  }
  // トランザクションは同じモックを tx として渡す（ロールバックは throw の伝播で表現される）
  db.transaction = (fn: (tx: unknown) => Promise<unknown>) => fn(db)
  return { db }
})

const {
  createSeAdmin,
  deleteSeAdmin,
  SeAdminCreateError,
  SeAdminDeleteError,
  SeAdminNotificationError,
  isValidEmail,
  isUuid,
} = await import('./se-admin')
const { seAdminUsers, seAdminEmailNotificationLogs, auditLogs, sessions } = await import('./schema')

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
  const baseInput = {
    email: 'new@example.com',
    passwordHash: 'hashed-initial',
    sendNotification: vi.fn().mockResolvedValue(undefined),
  }

  it('creates a user with the initial password hash, logs the notification, and records an audit log', async () => {
    h.state.selectResult = []
    h.state.insertReturning = [{ seAdminUserId: 'u1', email: 'new@example.com' }]
    const sendNotification = vi.fn().mockResolvedValue(undefined)

    const created = await createSeAdmin({ ...baseInput, sendNotification })

    expect(created).toEqual({ seAdminUserId: 'u1', email: 'new@example.com' })
    // 初期パスワードのハッシュと変更強制フラグ付きで作成される
    expect(h.state.insertValues[0]).toEqual({
      email: 'new@example.com',
      password: 'hashed-initial',
      mustChangePassword: true,
    })
    // se_admin_users・通知ログ・audit_logs の 3 回 insert される
    expect(h.state.insertTables).toEqual([seAdminUsers, seAdminEmailNotificationLogs, auditLogs])
    expect(h.state.insertValues[1]).toMatchObject({
      seAdminUserId: 'u1',
      toEmail: 'new@example.com',
      notificationType: 'SE_ADMIN_ACCOUNT_ISSUED',
      sendStatus: 'SUCCESS',
    })
    expect(h.state.insertValues[2]).toMatchObject({
      operatorType: 'cli',
      actionType: 'SE_ADMIN_CREATE',
      targetType: 'se_admin_user',
      targetId: 'u1',
      result: 'SUCCESS',
    })
    expect(sendNotification).toHaveBeenCalledWith({ seAdminUserId: 'u1', email: 'new@example.com' })
  })

  it('trims surrounding whitespace before persisting', async () => {
    h.state.insertReturning = [{ seAdminUserId: 'u2', email: 'trim@example.com' }]

    await createSeAdmin({ ...baseInput, email: '  trim@example.com  ' })

    expect(h.state.insertValues[0]).toMatchObject({ email: 'trim@example.com' })
  })

  it('throws and does not insert when the email format is invalid', async () => {
    const sendNotification = vi.fn()
    await expect(
      createSeAdmin({ ...baseInput, email: 'not-an-email', sendNotification }),
    ).rejects.toBeInstanceOf(SeAdminCreateError)
    expect(h.state.insertTables).toHaveLength(0)
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it('throws and does not insert when the email already exists', async () => {
    h.state.selectResult = [{ seAdminUserId: 'existing' }]

    await expect(createSeAdmin({ ...baseInput, email: 'dup@example.com' })).rejects.toBeInstanceOf(
      SeAdminCreateError,
    )
    expect(h.state.insertTables).toHaveLength(0)
  })

  it('throws SeAdminNotificationError when the notification fails (transaction rolls back)', async () => {
    h.state.insertReturning = [{ seAdminUserId: 'u1', email: 'new@example.com' }]
    const sendNotification = vi.fn().mockRejectedValue(new Error('SES unavailable'))

    // トランザクション内で throw されるため、実 DB では全 INSERT がロールバックされる
    await expect(createSeAdmin({ ...baseInput, sendNotification })).rejects.toBeInstanceOf(
      SeAdminNotificationError,
    )
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
