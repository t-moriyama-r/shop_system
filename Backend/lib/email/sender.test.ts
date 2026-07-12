import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const send = vi.fn()
const sesClientCtor = vi.fn()
const sendEmailCommandCtor = vi.fn()

class MockSESClient {
  constructor(...args: unknown[]) {
    sesClientCtor(...args)
  }
  send(...args: unknown[]) {
    return send(...args)
  }
}

class MockSendEmailCommand {
  constructor(...args: unknown[]) {
    sendEmailCommandCtor(...args)
  }
}

vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: MockSESClient,
  SendEmailCommand: MockSendEmailCommand,
}))

const { ConsoleEmailSender, SesEmailSender, getEmailSender, resetEmailSenderForTesting } =
  await import('./sender')

const originalEnv = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  send.mockResolvedValue({})
  resetEmailSenderForTesting()
})

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('ConsoleEmailSender', () => {
  it('常に成功し、メッセージをログ出力する', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const result = await new ConsoleEmailSender().send({
      to: 'a@example.com',
      subject: 'Subject',
      text: 'Body',
    })
    expect(result).toEqual({ success: true })
    expect(logSpy).toHaveBeenCalled()
    logSpy.mockRestore()
  })
})

describe('SesEmailSender', () => {
  it('EMAIL_FROM_ADDRESS が未設定の場合、例外を投げずに失敗を返す', async () => {
    delete process.env.EMAIL_FROM_ADDRESS
    const result = await new SesEmailSender().send({
      to: 'a@example.com',
      subject: 'Subject',
      text: 'Body',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('EMAIL_FROM_ADDRESS')
    expect(send).not.toHaveBeenCalled()
  })

  it('設定済みの場合はSESクライアント経由で送信する', async () => {
    process.env.EMAIL_FROM_ADDRESS = 'noreply@example.com'
    const result = await new SesEmailSender().send({
      to: 'a@example.com',
      subject: 'Subject',
      text: 'Body',
    })
    expect(result).toEqual({ success: true })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('SESクライアントが例外を投げた場合は失敗結果を返す', async () => {
    process.env.EMAIL_FROM_ADDRESS = 'noreply@example.com'
    send.mockRejectedValue(new Error('SES timeout'))
    const result = await new SesEmailSender().send({
      to: 'a@example.com',
      subject: 'Subject',
      text: 'Body',
    })
    expect(result).toEqual({ success: false, error: 'SES timeout' })
  })
})

describe('getEmailSender', () => {
  it('デフォルトではConsoleEmailSenderを返す', () => {
    delete process.env.EMAIL_PROVIDER
    expect(getEmailSender()).toBeInstanceOf(ConsoleEmailSender)
  })

  it('EMAIL_PROVIDER=sesの場合はSesEmailSenderを返す', () => {
    process.env.EMAIL_PROVIDER = 'ses'
    expect(getEmailSender()).toBeInstanceOf(SesEmailSender)
  })

  it('呼び出しをまたいでインスタンスをキャッシュする', () => {
    delete process.env.EMAIL_PROVIDER
    expect(getEmailSender()).toBe(getEmailSender())
  })
})
