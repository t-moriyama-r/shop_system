import './load-env'

import { deleteSeAdmin, SeAdminDeleteError } from './se-admin'

const USAGE = 'Usage: pnpm db:delete-se-admin <email|id>'

const identifier = process.argv[2]

if (!identifier) {
  console.error('削除対象のメールアドレスまたはIDを指定してください。')
  console.error(USAGE)
  process.exit(1)
}

try {
  const deleted = await deleteSeAdmin(identifier)
  console.log(`SE管理者アカウントを削除しました（論理削除）: ${deleted.email} (id: ${deleted.seAdminUserId})`)
  console.log(`無効化したセッション数: ${deleted.invalidatedSessionCount}`)
  process.exit(0)
} catch (err) {
  if (err instanceof SeAdminDeleteError) {
    console.error(err.message)
    process.exit(1)
  }
  console.error('SE管理者アカウントの削除に失敗しました:', err)
  process.exit(1)
}
