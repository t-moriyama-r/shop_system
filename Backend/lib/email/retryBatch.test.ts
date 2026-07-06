import { describe, it, expect, vi, beforeEach } from 'vitest'

const findEmailNotificationRetryCandidates = vi.fn()
const markEmailNotificationForRetry = vi.fn()
vi.mock('db/shop-accounts', () => ({
  findEmailNotificationRetryCandidates: (...a: unknown[]) => findEmailNotificationRetryCandidates(...a),
  markEmailNotificationForRetry: (...a: unknown[]) => markEmailNotificationForRetry(...a),
}))

const recordAuditLog = vi.fn()
vi.mock('../audit-log', () => ({ recordAuditLog: (...a: unknown[]) => recordAuditLog(...a) }))

const sendShopAccountIssuedNotification = vi.fn()
vi.mock('./notify', () => ({
  sendShopAccountIssuedNotification: (...a: unknown[]) => sendShopAccountIssuedNotification(...a),
}))

const { retryFailedEmailNotifications } = await import('./retryBatch')

const candidate = {
  emailNotificationLogId: 'log-1',
  shopAccountId: 'shop-1',
  toEmail: 'shop@example.com',
  shopName: 'テストショップ',
  contactName: '山田太郎',
  notificationType: 'SHOP_ACCOUNT_ISSUED',
  retryCount: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('retryFailedEmailNotifications', () => {
  it('does nothing when there are no retry candidates', async () => {
    findEmailNotificationRetryCandidates.mockResolvedValue([])

    const count = await retryFailedEmailNotifications()

    expect(count).toBe(0)
    expect(markEmailNotificationForRetry).not.toHaveBeenCalled()
    expect(sendShopAccountIssuedNotification).not.toHaveBeenCalled()
    expect(recordAuditLog).not.toHaveBeenCalled()
  })

  it('reissues a password, resets the log, resends, and records an audit log per candidate', async () => {
    const now = new Date('2026-01-01T00:00:00Z')
    findEmailNotificationRetryCandidates.mockResolvedValue([candidate])

    const count = await retryFailedEmailNotifications(now)

    expect(count).toBe(1)
    expect(findEmailNotificationRetryCandidates).toHaveBeenCalledWith(now)

    expect(markEmailNotificationForRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        emailNotificationLogId: 'log-1',
        shopAccountId: 'shop-1',
        initialPasswordHash: expect.any(String),
        now,
      }),
    )

    expect(sendShopAccountIssuedNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        emailNotificationLogId: 'log-1',
        shopAccountId: 'shop-1',
        toEmail: 'shop@example.com',
        shopName: 'テストショップ',
        contactName: '山田太郎',
        temporaryPassword: expect.any(String),
      }),
    )

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorType: 'system',
        actionType: 'SHOP_ACCOUNT_NOTIFICATION_RETRY',
        targetType: 'shop_account',
        targetId: 'shop-1',
        result: 'SUCCESS',
      }),
    )
  })

  it('processes multiple candidates independently', async () => {
    const other = { ...candidate, emailNotificationLogId: 'log-2', shopAccountId: 'shop-2' }
    findEmailNotificationRetryCandidates.mockResolvedValue([candidate, other])

    const count = await retryFailedEmailNotifications()

    expect(count).toBe(2)
    expect(markEmailNotificationForRetry).toHaveBeenCalledTimes(2)
    expect(sendShopAccountIssuedNotification).toHaveBeenCalledTimes(2)
    expect(recordAuditLog).toHaveBeenCalledTimes(2)
  })
})
