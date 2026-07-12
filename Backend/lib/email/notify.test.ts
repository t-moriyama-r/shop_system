import { describe, it, expect, vi, beforeEach } from 'vitest'

const send = vi.fn()
vi.mock('./sender', () => ({
  getEmailSender: () => ({ send: (...a: unknown[]) => send(...a) }),
}))

const recordEmailNotificationResult = vi.fn()
vi.mock('db/shop-accounts', () => ({
  recordEmailNotificationResult: (...a: unknown[]) => recordEmailNotificationResult(...a),
}))

const { sendShopAccountIssuedNotification, sendSeAdminAccountIssuedEmail } = await import('./notify')

const baseInput = {
  emailNotificationLogId: 'log-1',
  shopAccountId: 'shop-1',
  toEmail: 'shop@example.com',
  shopName: 'テストショップ',
  contactName: '山田太郎',
  temporaryPassword: 'temp-pass-123',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sendShopAccountIssuedNotification', () => {
  it('records SUCCESS when the sender succeeds', async () => {
    send.mockResolvedValue({ success: true })
    await sendShopAccountIssuedNotification(baseInput)

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'shop@example.com',
        subject: expect.any(String),
        text: expect.stringContaining('temp-pass-123'),
      }),
    )
    expect(recordEmailNotificationResult).toHaveBeenCalledWith({
      emailNotificationLogId: 'log-1',
      shopAccountId: 'shop-1',
      status: 'SUCCESS',
      errorMessage: null,
    })
  })

  it('records FAILURE with the error message when the sender fails', async () => {
    send.mockResolvedValue({ success: false, error: 'SES timeout' })
    await sendShopAccountIssuedNotification(baseInput)

    expect(recordEmailNotificationResult).toHaveBeenCalledWith({
      emailNotificationLogId: 'log-1',
      shopAccountId: 'shop-1',
      status: 'FAILURE',
      errorMessage: 'SES timeout',
    })
  })

  it('records FAILURE when the sender throws instead of rejecting gracefully', async () => {
    send.mockRejectedValue(new Error('network down'))
    await sendShopAccountIssuedNotification(baseInput)

    expect(recordEmailNotificationResult).toHaveBeenCalledWith({
      emailNotificationLogId: 'log-1',
      shopAccountId: 'shop-1',
      status: 'FAILURE',
      errorMessage: 'network down',
    })
  })
})

describe('sendSeAdminAccountIssuedEmail', () => {
  const input = { toEmail: 'admin@example.com', temporaryPassword: 'initial-pass-123' }

  it('sends the initial password mail to the SE admin', async () => {
    send.mockResolvedValue({ success: true })
    await sendSeAdminAccountIssuedEmail(input)

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        text: expect.stringContaining('initial-pass-123'),
      }),
    )
    // ショップ向けと異なり、送信結果の記録は呼び出し側（createSeAdmin の tx）が担う
    expect(recordEmailNotificationResult).not.toHaveBeenCalled()
  })

  it('throws when the sender reports a failure (caller rolls back the account)', async () => {
    send.mockResolvedValue({ success: false, error: 'SES timeout' })
    await expect(sendSeAdminAccountIssuedEmail(input)).rejects.toThrow('SES timeout')
  })
})
