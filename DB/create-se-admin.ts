import './load-env'

import { createSeAdmin, SeAdminCreateError } from './se-admin'

const USAGE = 'Usage: pnpm db:create-se-admin <email>'

const email = process.argv[2]

if (!email) {
  console.error('メールアドレスを指定してください。')
  console.error(USAGE)
  process.exit(1)
}

try {
  const created = await createSeAdmin(email)
  console.log(`SE管理者アカウントを追加しました: ${created.email} (id: ${created.seAdminUserId})`)
  console.log('パスワード未設定の状態です。初回ログイン時に画面でパスワードを設定してください。')
  process.exit(0)
} catch (err) {
  if (err instanceof SeAdminCreateError) {
    console.error(err.message)
    process.exit(1)
  }
  console.error('SE管理者アカウントの追加に失敗しました:', err)
  process.exit(1)
}
