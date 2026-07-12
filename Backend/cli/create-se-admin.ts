// SE管理者アカウント追加 CLI（ルートから `pnpm db:create-se-admin <email>` で実行）。
// ランダム生成した初期パスワードをハッシュ保存し、平文をメールで本人に送信する。
// 実運用でメールを送るには EMAIL_PROVIDER=ses / EMAIL_FROM_ADDRESS / AWS_REGION の
// 設定が必要（未設定時は ConsoleEmailSender がメール内容をコンソールに出力する）。
// 環境変数は db パッケージの import 時にルートの .env から読み込まれる。

import { createSeAdmin, SeAdminCreateError, SeAdminNotificationError } from 'db/se-admin'
import { recordAuditLog } from '../lib/audit-log'
import { sendSeAdminAccountIssuedEmail } from '../lib/email/notify'
import { generateInitialPassword, hashPassword } from '../lib/password'

const USAGE = 'Usage: pnpm db:create-se-admin <email>'

const email = process.argv[2]

if (!email) {
  console.error('メールアドレスを指定してください。')
  console.error(USAGE)
  process.exit(1)
}

// 平文パスワードはメール本文でのみ通知し、コンソールには出力しない。
const temporaryPassword = generateInitialPassword()
const passwordHash = await hashPassword(temporaryPassword)

try {
  const created = await createSeAdmin({
    email,
    passwordHash,
    sendNotification: (c) =>
      sendSeAdminAccountIssuedEmail({ toEmail: c.email, temporaryPassword }),
  })
  console.log(`SE管理者アカウントを追加しました: ${created.email} (id: ${created.seAdminUserId})`)
  console.log('初期パスワードを記載した通知メールを送信しました。初回ログイン後にパスワードの変更が必要です。')
  process.exit(0)
} catch (err) {
  if (err instanceof SeAdminNotificationError) {
    // アカウント作成はロールバック済み。失敗の証跡だけを監査ログに残す。
    await recordAuditLog({
      operatorType: 'cli',
      actionType: 'SE_ADMIN_CREATE',
      targetType: 'se_admin_user',
      result: 'FAILURE',
      detail: `SE 管理者アカウント追加をメール送信失敗により取り消し: ${email} / ${err.message}`,
    })
    console.error(err.message)
    console.error('メール送信設定（EMAIL_PROVIDER / EMAIL_FROM_ADDRESS / AWS_REGION）を確認のうえ再実行してください。')
    process.exit(1)
  }
  if (err instanceof SeAdminCreateError) {
    console.error(err.message)
    process.exit(1)
  }
  console.error('SE管理者アカウントの追加に失敗しました:', err)
  process.exit(1)
}
