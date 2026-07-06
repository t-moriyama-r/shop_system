// 顧客アカウント発行完了通知メールの送信処理（BP-005/BP-011）。
// email_notification_logs に PENDING レコードが作成されたことをトリガーに、
// handler 側から非同期（fire-and-forget）で呼び出される想定。
// 送信結果（成功/失敗）は必ず recordEmailNotificationResult で記録する。

import { recordEmailNotificationResult } from 'db/shop-accounts'
import { buildShopAccountIssuedEmail } from './templates'
import { getEmailSender } from './sender'

export interface NotifyShopAccountIssuedInput {
  emailNotificationLogId: string
  shopAccountId: string
  toEmail: string
  shopName: string
  contactName: string
  temporaryPassword: string
}

function loginUrl(): string {
  const origin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000'
  return `${origin}/`
}

export async function sendShopAccountIssuedNotification(
  input: NotifyShopAccountIssuedInput,
): Promise<void> {
  const { subject, text } = buildShopAccountIssuedEmail({
    shopName: input.shopName,
    contactName: input.contactName,
    email: input.toEmail,
    temporaryPassword: input.temporaryPassword,
    loginUrl: loginUrl(),
  })

  let result: { success: boolean; error?: string }
  try {
    result = await getEmailSender().send({ to: input.toEmail, subject, text })
  } catch (err) {
    result = { success: false, error: err instanceof Error ? err.message : 'メール送信に失敗しました' }
  }

  await recordEmailNotificationResult({
    emailNotificationLogId: input.emailNotificationLogId,
    shopAccountId: input.shopAccountId,
    status: result.success ? 'SUCCESS' : 'FAILURE',
    errorMessage: result.success ? null : (result.error ?? '不明なエラー'),
  })
}
