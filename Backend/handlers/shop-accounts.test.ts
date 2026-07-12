import { describe, it, expect, vi, beforeEach } from 'vitest'

const listShopAccounts = vi.fn()
const findShopAccountById = vi.fn()
const findShopAccountByEmail = vi.fn()
const createShopAccount = vi.fn()
const listEmailLogsByShopAccount = vi.fn()
const listEmailNotificationLogsPage = vi.fn()
const createResendEmailNotificationLog = vi.fn()
const updateShopAccountStatus = vi.fn()

vi.mock('db/shop-accounts', async () => {
  const statuses = ['active', 'pending', 'suspended'] as const
  return {
    SHOP_ACCOUNT_STATUSES: statuses,
    SHOP_ACCOUNT_ISSUED_NOTIFICATION: 'SHOP_ACCOUNT_ISSUED',
    isShopAccountStatus: (v: string) => (statuses as readonly string[]).includes(v),
    listShopAccounts: (...a: unknown[]) => listShopAccounts(...a),
    findShopAccountById: (...a: unknown[]) => findShopAccountById(...a),
    findShopAccountByEmail: (...a: unknown[]) => findShopAccountByEmail(...a),
    createShopAccount: (...a: unknown[]) => createShopAccount(...a),
    listEmailLogsByShopAccount: (...a: unknown[]) => listEmailLogsByShopAccount(...a),
    listEmailNotificationLogsPage: (...a: unknown[]) => listEmailNotificationLogsPage(...a),
    createResendEmailNotificationLog: (...a: unknown[]) => createResendEmailNotificationLog(...a),
    updateShopAccountStatus: (...a: unknown[]) => updateShopAccountStatus(...a),
  }
})

const recordAuditLog = vi.fn()
vi.mock('../lib/audit-log', () => ({ recordAuditLog: (...a: unknown[]) => recordAuditLog(...a) }))

const sendShopAccountIssuedNotification = vi.fn()
vi.mock('../lib/email/notify', () => ({
  sendShopAccountIssuedNotification: (...a: unknown[]) => sendShopAccountIssuedNotification(...a),
}))

const {
  listShopAccountsHandler,
  getShopAccountHandler,
  updateShopAccountStatusHandler,
  createShopAccountHandler,
  listNotificationLogsHandler,
  resendNotificationHandler,
} = await import('./shop-accounts')

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'
const operator = { seAdminUserId: 'op-1', email: 'op@example.com', mustChangePassword: false }
const meta = { ipAddress: null, userAgent: null }

beforeEach(() => {
  vi.clearAllMocks()
  listShopAccounts.mockResolvedValue({ rows: [], total: 0 })
  listEmailLogsByShopAccount.mockResolvedValue([])
  listEmailNotificationLogsPage.mockResolvedValue({ rows: [], total: 0 })
  createResendEmailNotificationLog.mockResolvedValue({
    emailNotificationLogId: 'log-1',
    sendStatus: 'PENDING',
  })
  updateShopAccountStatus.mockResolvedValue(undefined)
  findShopAccountByEmail.mockResolvedValue(undefined)
  createShopAccount.mockResolvedValue({
    account: { shopAccountId: VALID_UUID, email: 'shop@example.com', shopName: 'テストショップ', contactName: '山田太郎' },
    emailNotificationLogId: 'log-0',
  })
  sendShopAccountIssuedNotification.mockResolvedValue(undefined)
})

describe('createShopAccountHandler', () => {
  const validInput = {
    shopName: 'テストショップ',
    contactName: '山田太郎',
    email: 'shop@example.com',
    operator,
    meta,
  }

  it('必須フィールドが欠けている場合は400を返す（クエリは実行しない）', async () => {
    for (const missing of ['shopName', 'contactName', 'email'] as const) {
      const r = await createShopAccountHandler({ ...validInput, [missing]: '  ' })
      expect(r.status).toBe(400)
    }
    expect(findShopAccountByEmail).not.toHaveBeenCalled()
    expect(createShopAccount).not.toHaveBeenCalled()
  })

  it('不正な形式のメールアドレスの場合は400を返す', async () => {
    const r = await createShopAccountHandler({ ...validInput, email: 'not-an-email' })
    expect(r.status).toBe(400)
    expect(createShopAccount).not.toHaveBeenCalled()
  })

  it('文字数上限を超えるフィールドの場合は400を返す', async () => {
    const r = await createShopAccountHandler({ ...validInput, shopName: 'a'.repeat(256) })
    expect(r.status).toBe(400)
  })

  it('メールアドレスが既に存在する場合は409を返す（作成しない）', async () => {
    findShopAccountByEmail.mockResolvedValue({ shopAccountId: 'existing' })
    const r = await createShopAccountHandler(validInput)
    expect(r.status).toBe(409)
    expect(createShopAccount).not.toHaveBeenCalled()
  })

  it('アカウントを作成し、ハッシュのみを保存し、監査ログを記録する', async () => {
    const r = await createShopAccountHandler(validInput)
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ shopAccount: { shopAccountId: VALID_UUID } })

    const createArg = createShopAccount.mock.calls[0][0]
    expect(createArg).toMatchObject({
      shopName: 'テストショップ',
      contactName: '山田太郎',
      email: 'shop@example.com',
      issuedBySeAdminUserId: 'op-1',
    })
    expect(typeof createArg.initialPasswordHash).toBe('string')
    expect(createArg.initialPasswordHash.length).toBeGreaterThan(0)
    expect(createArg.initialPasswordHash).not.toBe('shop@example.com')

    // 平文パスワード/ハッシュはレスポンスに含めない（設計 BP-003 備考）。
    const bodyJson = JSON.stringify(r.body)
    expect(bodyJson).not.toContain(createArg.initialPasswordHash)
    expect(bodyJson.toLowerCase()).not.toContain('password')

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'SHOP_ACCOUNT_CREATE',
        targetType: 'shop_account',
        targetId: VALID_UUID,
        result: 'SUCCESS',
      }),
    )

    expect(sendShopAccountIssuedNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        emailNotificationLogId: 'log-0',
        shopAccountId: VALID_UUID,
        toEmail: 'shop@example.com',
        shopName: 'テストショップ',
        contactName: '山田太郎',
      }),
    )
    const sendArg = sendShopAccountIssuedNotification.mock.calls[0][0]
    expect(typeof sendArg.temporaryPassword).toBe('string')
    expect(sendArg.temporaryPassword.length).toBeGreaterThan(0)
    // 平文パスワードはレスポンスに含めない。
    expect(bodyJson).not.toContain(sendArg.temporaryPassword)
  })

  it('保存前にフィールドの前後の空白をトリムする', async () => {
    await createShopAccountHandler({
      ...validInput,
      shopName: '  Shop  ',
      email: '  shop@example.com  ',
    })
    expect(createShopAccount).toHaveBeenCalledWith(
      expect.objectContaining({ shopName: 'Shop', email: 'shop@example.com' }),
    )
  })

  it('通知送信が失敗しても201を返す（fire-and-forget）', async () => {
    sendShopAccountIssuedNotification.mockRejectedValue(new Error('smtp down'))
    const r = await createShopAccountHandler(validInput)
    expect(r.status).toBe(201)
  })
})

describe('listShopAccountsHandler', () => {
  it('行データとページネーション情報を返す（デフォルトlimit 20）', async () => {
    listShopAccounts.mockResolvedValue({ rows: [{ shopAccountId: 's1' }], total: 45 })
    const r = await listShopAccountsHandler({})
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } })
  })

  it('デフォルトでは削除済みを除外し、includeDeleted=trueの場合は含める', async () => {
    await listShopAccountsHandler({})
    expect(listShopAccounts).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeDeleted: false }),
    )
    await listShopAccountsHandler({ includeDeleted: 'true' })
    expect(listShopAccounts).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    )
  })

  it('有効なステータスフィルタをそのまま渡す', async () => {
    await listShopAccountsHandler({ status: 'active' })
    expect(listShopAccounts).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }))
  })

  it('不正なステータスの場合は400を返す（クエリは実行しない）', async () => {
    const r = await listShopAccountsHandler({ status: 'archived' })
    expect(r.status).toBe(400)
    expect(listShopAccounts).not.toHaveBeenCalled()
  })

  it('limitを上限（100）に丸める', async () => {
    const r = await listShopAccountsHandler({ limit: '500' })
    expect(r.body).toMatchObject({ pagination: { limit: 100 } })
  })
})

describe('getShopAccountHandler', () => {
  it('UUID形式でないidの場合は400を返す', async () => {
    const r = await getShopAccountHandler({ shopAccountId: 'not-a-uuid' })
    expect(r.status).toBe(400)
    expect(findShopAccountById).not.toHaveBeenCalled()
  })

  it('見つからない場合（または論理削除済みの場合）は404を返す', async () => {
    findShopAccountById.mockResolvedValue(undefined)
    const r = await getShopAccountHandler({ shopAccountId: VALID_UUID })
    expect(r.status).toBe(404)
  })

  it('アカウントとそのメール通知ログを返す', async () => {
    findShopAccountById.mockResolvedValue({ shopAccountId: VALID_UUID, email: 'a@example.com' })
    listEmailLogsByShopAccount.mockResolvedValue([{ emailNotificationLogId: 'e1' }])
    const r = await getShopAccountHandler({ shopAccountId: VALID_UUID })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({
      shopAccountId: VALID_UUID,
      emailNotificationLogs: [{ emailNotificationLogId: 'e1' }],
    })
  })
})

describe('updateShopAccountStatusHandler', () => {
  it('UUID形式でないidの場合は400を返す', async () => {
    const r = await updateShopAccountStatusHandler({
      shopAccountId: 'bad',
      operator,
      status: 'active',
      meta,
    })
    expect(r.status).toBe(400)
  })

  it('不正なステータスの場合は400を返す（クエリは実行しない）', async () => {
    const r = await updateShopAccountStatusHandler({
      shopAccountId: VALID_UUID,
      operator,
      status: 'archived',
      meta,
    })
    expect(r.status).toBe(400)
    expect(findShopAccountById).not.toHaveBeenCalled()
  })

  it('アカウントが存在しない場合は404を返す', async () => {
    findShopAccountById.mockResolvedValue(undefined)
    const r = await updateShopAccountStatusHandler({
      shopAccountId: VALID_UUID,
      operator,
      status: 'suspended',
      meta,
    })
    expect(r.status).toBe(404)
    expect(updateShopAccountStatus).not.toHaveBeenCalled()
  })

  it('ステータスを更新し、監査ログを記録する', async () => {
    findShopAccountById.mockResolvedValue({
      shopAccountId: VALID_UUID,
      email: 'a@example.com',
      accountStatus: 'pending',
    })
    const r = await updateShopAccountStatusHandler({
      shopAccountId: VALID_UUID,
      operator,
      status: 'active',
      meta,
    })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ accountStatus: 'active' })
    expect(updateShopAccountStatus).toHaveBeenCalledWith(VALID_UUID, 'active')
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'SHOP_ACCOUNT_STATUS_UPDATE',
        targetType: 'shop_account',
        targetId: VALID_UUID,
        result: 'SUCCESS',
      }),
    )
  })
})

describe('listNotificationLogsHandler', () => {
  it('UUID形式でないidの場合は400を返す', async () => {
    const r = await listNotificationLogsHandler({ shopAccountId: 'not-a-uuid' })
    expect(r.status).toBe(400)
    expect(findShopAccountById).not.toHaveBeenCalled()
  })

  it('アカウントが存在しない場合は404を返す', async () => {
    findShopAccountById.mockResolvedValue(undefined)
    const r = await listNotificationLogsHandler({ shopAccountId: VALID_UUID })
    expect(r.status).toBe(404)
    expect(listEmailNotificationLogsPage).not.toHaveBeenCalled()
  })

  it('行データとページネーション情報を返す（デフォルトlimit 20）', async () => {
    findShopAccountById.mockResolvedValue({ shopAccountId: VALID_UUID, email: 'a@example.com' })
    listEmailNotificationLogsPage.mockResolvedValue({
      rows: [{ emailNotificationLogId: 'e1' }],
      total: 45,
    })
    const r = await listNotificationLogsHandler({ shopAccountId: VALID_UUID })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({
      data: [{ emailNotificationLogId: 'e1' }],
      pagination: { page: 1, limit: 20, total: 45, totalPages: 3 },
    })
    expect(listEmailNotificationLogsPage).toHaveBeenCalledWith(
      expect.objectContaining({ shopAccountId: VALID_UUID, page: 1, limit: 20 }),
    )
  })

  it('limitを上限（100）に丸める', async () => {
    findShopAccountById.mockResolvedValue({ shopAccountId: VALID_UUID, email: 'a@example.com' })
    const r = await listNotificationLogsHandler({ shopAccountId: VALID_UUID, limit: '500' })
    expect(r.body).toMatchObject({ pagination: { limit: 100 } })
  })
})

describe('resendNotificationHandler', () => {
  it('UUID形式でないidの場合は400を返す', async () => {
    const r = await resendNotificationHandler({ shopAccountId: 'bad', operator, meta })
    expect(r.status).toBe(400)
    expect(findShopAccountById).not.toHaveBeenCalled()
  })

  it('アカウントが存在しない場合は404を返す', async () => {
    findShopAccountById.mockResolvedValue(undefined)
    const r = await resendNotificationHandler({ shopAccountId: VALID_UUID, operator, meta })
    expect(r.status).toBe(404)
    expect(createResendEmailNotificationLog).not.toHaveBeenCalled()
  })

  it('新しく発行したパスワードハッシュでPENDINGログを作成し、監査ログを記録し、送信をトリガーする', async () => {
    findShopAccountById.mockResolvedValue({
      shopAccountId: VALID_UUID,
      email: 'a@example.com',
      shopName: 'テストショップ',
      contactName: '山田太郎',
    })
    const r = await resendNotificationHandler({ shopAccountId: VALID_UUID, operator, meta })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ emailNotificationLog: { emailNotificationLogId: 'log-1' } })

    const resendArg = createResendEmailNotificationLog.mock.calls[0][0]
    expect(resendArg).toMatchObject({
      shopAccountId: VALID_UUID,
      toEmail: 'a@example.com',
      notificationType: 'SHOP_ACCOUNT_ISSUED',
    })
    expect(typeof resendArg.initialPasswordHash).toBe('string')
    expect(resendArg.initialPasswordHash.length).toBeGreaterThan(0)

    expect(sendShopAccountIssuedNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        emailNotificationLogId: 'log-1',
        shopAccountId: VALID_UUID,
        toEmail: 'a@example.com',
        shopName: 'テストショップ',
        contactName: '山田太郎',
      }),
    )
    const sendArg = sendShopAccountIssuedNotification.mock.calls[0][0]
    expect(typeof sendArg.temporaryPassword).toBe('string')
    expect(sendArg.temporaryPassword.length).toBeGreaterThan(0)

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'SHOP_ACCOUNT_NOTIFICATION_RESEND',
        targetType: 'shop_account',
        targetId: VALID_UUID,
        result: 'SUCCESS',
      }),
    )
  })
})
