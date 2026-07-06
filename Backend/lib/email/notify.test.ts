import { describe, it, expect, vi, beforeEach } from 'vitest'

const send = vi.fn()
vi.mock('./sender', () => ({
  getEmailSender: () => ({ send: (...a: unknown[]) => send(...a) }),
}))

const recordEmailNotificationResult = vi.fn()
vi.mock('db/shop-accounts', () => ({
  recordEmailNotificationResult: (...a: unknown[]) => recordEmailNotificationResult(...a),
}))

const { sendShopAccountIssuedNotification } = await import('./notify')

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
  it('送信が成功した場合はSUCCESSを記録する', async () => {
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

  it('送信が失敗した場合はエラーメッセージ付きでFAILUREを記録する', async () => {
    send.mockResolvedValue({ success: false, error: 'SES timeout' })
    await sendShopAccountIssuedNotification(baseInput)

    expect(recordEmailNotificationResult).toHaveBeenCalledWith({
      emailNotificationLogId: 'log-1',
      shopAccountId: 'shop-1',
      status: 'FAILURE',
      errorMessage: 'SES timeout',
    })
  })

  it('送信処理が例外をスローした場合もFAILUREを記録する', async () => {
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
