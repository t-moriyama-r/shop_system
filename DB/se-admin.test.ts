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
  it('正しい形式のアドレスを受け入れる', () => {
    expect(isValidEmail('admin@example.com')).toBe(true)
  })

  it.each(['admin', 'admin@', 'admin@example', 'a b@example.com', ''])(
    '不正な形式のアドレス %j を拒否する',
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

  it('初期パスワードのハッシュ付きでユーザーを作成し、通知ログとSE_ADMIN_CREATE監査ログを記録する', async () => {
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

  it('保存前に前後の空白をトリムする', async () => {
    h.state.insertReturning = [{ seAdminUserId: 'u2', email: 'trim@example.com' }]

    await createSeAdmin({ ...baseInput, email: '  trim@example.com  ' })

    expect(h.state.insertValues[0]).toMatchObject({ email: 'trim@example.com' })
  })

  it('メール形式が不正な場合はエラーを投げ、挿入も通知もしない', async () => {
    const sendNotification = vi.fn()
    await expect(
      createSeAdmin({ ...baseInput, email: 'not-an-email', sendNotification }),
    ).rejects.toBeInstanceOf(SeAdminCreateError)
    expect(h.state.insertTables).toHaveLength(0)
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it('メールが既に存在する場合はエラーを投げ、挿入しない', async () => {
    h.state.selectResult = [{ seAdminUserId: 'existing' }]

    await expect(createSeAdmin({ ...baseInput, email: 'dup@example.com' })).rejects.toBeInstanceOf(
      SeAdminCreateError,
    )
    expect(h.state.insertTables).toHaveLength(0)
  })

  it('通知メールの送信に失敗した場合はSeAdminNotificationErrorを投げる（トランザクションはロールバック）', async () => {
    h.state.insertReturning = [{ seAdminUserId: 'u1', email: 'new@example.com' }]
    const sendNotification = vi.fn().mockRejectedValue(new Error('SES unavailable'))

    // トランザクション内で throw されるため、実 DB では全 INSERT がロールバックされる
    await expect(createSeAdmin({ ...baseInput, sendNotification })).rejects.toBeInstanceOf(
      SeAdminNotificationError,
    )
  })
})

describe('isUuid', () => {
  it('UUIDを受け入れる', () => {
    expect(isUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
  })

  it.each(['admin@example.com', '123e4567', 'not-a-uuid', ''])('UUID以外 %j を拒否する', (bad) => {
    expect(isUuid(bad)).toBe(false)
  })
})

describe('deleteSeAdmin', () => {
  it('ユーザーを論理削除し、セッションを無効化し、SE_ADMIN_DELETE監査ログを記録する', async () => {
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

  it('識別子がUUIDでない場合はメールで検索する（前後の空白はトリムする）', async () => {
    h.state.selectResult = [{ seAdminUserId: 'u2', email: 'by-mail@example.com' }]

    const deleted = await deleteSeAdmin('  by-mail@example.com  ')

    expect(deleted.seAdminUserId).toBe('u2')
    expect(h.state.updateTables).toEqual([seAdminUsers])
  })

  it('UUID識別子を受け入れる', async () => {
    h.state.selectResult = [
      { seAdminUserId: '123e4567-e89b-12d3-a456-426614174000', email: 'by-id@example.com' },
    ]

    const deleted = await deleteSeAdmin('123e4567-e89b-12d3-a456-426614174000')

    expect(deleted.email).toBe('by-id@example.com')
  })

  it('識別子が空の場合はエラーを投げ、何も変更しない', async () => {
    await expect(deleteSeAdmin('   ')).rejects.toBeInstanceOf(SeAdminDeleteError)
    expect(h.state.updateTables).toHaveLength(0)
    expect(h.state.deleteTables).toHaveLength(0)
    expect(h.state.insertTables).toHaveLength(0)
  })

  it('対象が見つからない場合はエラーを投げ、何も変更しない', async () => {
    h.state.selectResult = []

    await expect(deleteSeAdmin('missing@example.com')).rejects.toBeInstanceOf(SeAdminDeleteError)
    expect(h.state.updateTables).toHaveLength(0)
    expect(h.state.deleteTables).toHaveLength(0)
    expect(h.state.insertTables).toHaveLength(0)
  })
})
