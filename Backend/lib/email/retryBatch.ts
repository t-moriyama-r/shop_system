// メール送信失敗レコードの再送バッチ（BP-005/BP-011 BATCH）。
// email_notification_logs のうち送信失敗（FAILURE）かつ再試行回数上限未満、
// バックオフ経過済みのレコードを検出し、一時パスワードを再発行した上で再送する。

import { findEmailNotificationRetryCandidates, markEmailNotificationForRetry } from 'db/shop-accounts'
import { recordAuditLog } from '../audit-log'
import { generateInitialPassword, hashPassword } from '../password'
import { sendShopAccountIssuedNotification } from './notify'

/**
 * 送信失敗レコードを検出し、再送信をトリガーする。
 * 対象件数を返す（送信結果の成否はログ・監査ログに記録される）。
 */
export async function retryFailedEmailNotifications(now: Date = new Date()): Promise<number> {
  const candidates = await findEmailNotificationRetryCandidates(now)

  for (const candidate of candidates) {
    // 一時パスワードは平文を保持しない設計のため、再送のたびに新しいものを発行する
    // （手動再送信 API と同じ方式。設計 BP-003/BP-005 備考）。
    const temporaryPassword = generateInitialPassword()
    const initialPasswordHash = await hashPassword(temporaryPassword)

    await markEmailNotificationForRetry({
      emailNotificationLogId: candidate.emailNotificationLogId,
      shopAccountId: candidate.shopAccountId,
      initialPasswordHash,
      now,
    })

    await sendShopAccountIssuedNotification({
      emailNotificationLogId: candidate.emailNotificationLogId,
      shopAccountId: candidate.shopAccountId,
      toEmail: candidate.toEmail,
      shopName: candidate.shopName,
      contactName: candidate.contactName,
      temporaryPassword,
    })

    await recordAuditLog({
      operatorType: 'system',
      actionType: 'SHOP_ACCOUNT_NOTIFICATION_RETRY',
      targetType: 'shop_account',
      targetId: candidate.shopAccountId,
      result: 'SUCCESS',
      detail: `ショップアカウント(${candidate.toEmail})の通知メール再送をバッチで実行`,
    })
  }

  return candidates.length
}
