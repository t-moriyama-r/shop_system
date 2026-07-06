// メール送信アダプタの抽象化（BP-005/BP-011）。
// EMAIL_PROVIDER=ses のときのみ AWS SES を使い、それ以外（未設定/開発/テスト環境）は
// コンソール出力のみを行う ConsoleEmailSender を使う。差し替え可能にすることで、
// 実際のメール送信サービスが未確定でも送信基盤自体は実装・テストできるようにする。

export interface EmailMessage {
  to: string
  subject: string
  text: string
}

export interface EmailSendResult {
  success: boolean
  error?: string
}

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>
}

export class ConsoleEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<EmailSendResult> {
    console.log(`[email] to=${message.to} subject=${message.subject}\n${message.text}`)
    return { success: true }
  }
}

export class SesEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<EmailSendResult> {
    const fromAddress = process.env.EMAIL_FROM_ADDRESS
    if (!fromAddress) {
      return { success: false, error: 'EMAIL_FROM_ADDRESS が設定されていません' }
    }

    try {
      const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses')
      const client = new SESClient({ region: process.env.AWS_REGION })
      await client.send(
        new SendEmailCommand({
          Source: fromAddress,
          Destination: { ToAddresses: [message.to] },
          Message: {
            Subject: { Data: message.subject, Charset: 'UTF-8' },
            Body: { Text: { Data: message.text, Charset: 'UTF-8' } },
          },
        }),
      )
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'メール送信に失敗しました' }
    }
  }
}

let cachedSender: EmailSender | undefined

export function getEmailSender(): EmailSender {
  if (!cachedSender) {
    cachedSender = process.env.EMAIL_PROVIDER === 'ses' ? new SesEmailSender() : new ConsoleEmailSender()
  }
  return cachedSender
}

// テストでプロバイダ切り替え・キャッシュをリセットするために使う。
export function resetEmailSenderForTesting(): void {
  cachedSender = undefined
}
