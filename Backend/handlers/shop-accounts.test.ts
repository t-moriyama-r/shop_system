import { describe, it, expect, vi, beforeEach } from 'vitest'

const listShopAccounts = vi.fn()
const findShopAccountById = vi.fn()
const listEmailLogsByShopAccount = vi.fn()
const updateShopAccountStatus = vi.fn()

vi.mock('db/shop-accounts', async () => {
  const statuses = ['active', 'pending', 'suspended'] as const
  return {
    SHOP_ACCOUNT_STATUSES: statuses,
    isShopAccountStatus: (v: string) => (statuses as readonly string[]).includes(v),
    listShopAccounts: (...a: unknown[]) => listShopAccounts(...a),
    findShopAccountById: (...a: unknown[]) => findShopAccountById(...a),
    listEmailLogsByShopAccount: (...a: unknown[]) => listEmailLogsByShopAccount(...a),
    updateShopAccountStatus: (...a: unknown[]) => updateShopAccountStatus(...a),
  }
})

const recordAuditLog = vi.fn()
vi.mock('../lib/audit-log', () => ({ recordAuditLog: (...a: unknown[]) => recordAuditLog(...a) }))

const { listShopAccountsHandler, getShopAccountHandler, updateShopAccountStatusHandler } =
  await import('./shop-accounts')

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'
const operator = { seAdminUserId: 'op-1', email: 'op@example.com', isPasswordSet: true }
const meta = { ipAddress: null, userAgent: null }

beforeEach(() => {
  vi.clearAllMocks()
  listShopAccounts.mockResolvedValue({ rows: [], total: 0 })
  listEmailLogsByShopAccount.mockResolvedValue([])
  updateShopAccountStatus.mockResolvedValue(undefined)
})

describe('listShopAccountsHandler', () => {
  it('returns rows with pagination metadata (default limit 20)', async () => {
    listShopAccounts.mockResolvedValue({ rows: [{ shopAccountId: 's1' }], total: 45 })
    const r = await listShopAccountsHandler({})
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } })
  })

  it('excludes deleted by default and includes them when includeDeleted=true', async () => {
    await listShopAccountsHandler({})
    expect(listShopAccounts).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeDeleted: false }),
    )
    await listShopAccountsHandler({ includeDeleted: 'true' })
    expect(listShopAccounts).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    )
  })

  it('forwards a valid status filter', async () => {
    await listShopAccountsHandler({ status: 'active' })
    expect(listShopAccounts).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }))
  })

  it('rejects an invalid status with 400 (does not query)', async () => {
    const r = await listShopAccountsHandler({ status: 'archived' })
    expect(r.status).toBe(400)
    expect(listShopAccounts).not.toHaveBeenCalled()
  })

  it('caps limit at the maximum (100)', async () => {
    const r = await listShopAccountsHandler({ limit: '500' })
    expect(r.body).toMatchObject({ pagination: { limit: 100 } })
  })
})

describe('getShopAccountHandler', () => {
  it('rejects a non-UUID id with 400', async () => {
    const r = await getShopAccountHandler({ shopAccountId: 'not-a-uuid' })
    expect(r.status).toBe(400)
    expect(findShopAccountById).not.toHaveBeenCalled()
  })

  it('returns 404 when not found (or logically deleted)', async () => {
    findShopAccountById.mockResolvedValue(undefined)
    const r = await getShopAccountHandler({ shopAccountId: VALID_UUID })
    expect(r.status).toBe(404)
  })

  it('returns the account with its email notification logs', async () => {
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
  it('rejects a non-UUID id with 400', async () => {
    const r = await updateShopAccountStatusHandler({
      shopAccountId: 'bad',
      operator,
      status: 'active',
      meta,
    })
    expect(r.status).toBe(400)
  })

  it('rejects an invalid status with 400 (does not query)', async () => {
    const r = await updateShopAccountStatusHandler({
      shopAccountId: VALID_UUID,
      operator,
      status: 'archived',
      meta,
    })
    expect(r.status).toBe(400)
    expect(findShopAccountById).not.toHaveBeenCalled()
  })

  it('returns 404 when the account does not exist', async () => {
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

  it('updates status and records an audit log', async () => {
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
