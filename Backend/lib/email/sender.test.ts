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
  it('always succeeds and logs the message', async () => {
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
  it('fails without throwing when EMAIL_FROM_ADDRESS is not configured', async () => {
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

  it('sends via the SES client when configured', async () => {
    process.env.EMAIL_FROM_ADDRESS = 'noreply@example.com'
    const result = await new SesEmailSender().send({
      to: 'a@example.com',
      subject: 'Subject',
      text: 'Body',
    })
    expect(result).toEqual({ success: true })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('returns a failure result when the SES client throws', async () => {
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
  it('returns a ConsoleEmailSender by default', () => {
    delete process.env.EMAIL_PROVIDER
    expect(getEmailSender()).toBeInstanceOf(ConsoleEmailSender)
  })

  it('returns a SesEmailSender when EMAIL_PROVIDER=ses', () => {
    process.env.EMAIL_PROVIDER = 'ses'
    expect(getEmailSender()).toBeInstanceOf(SesEmailSender)
  })

  it('caches the instance across calls', () => {
    delete process.env.EMAIL_PROVIDER
    expect(getEmailSender()).toBe(getEmailSender())
  })
})
