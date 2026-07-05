import './load-env'

import { db } from './client'
import { menuItems, seAdminUsers } from './schema'

try {
  await db.insert(menuItems).values([
    { name: 'コーヒー', price: 400 },
    { name: 'カフェラテ', price: 480 },
    { name: 'チーズケーキ', price: 550 },
  ]).onConflictDoNothing()

  // SE管理者の初期アカウント（パスワード未設定状態 = 初回ログイン時にPW設定が必要）
  await db.insert(seAdminUsers).values([
    { email: 'admin@example.com' },
  ]).onConflictDoNothing()

  console.log('Seed data inserted')
  process.exit(0)
} catch (err) {
  console.error('Seed failed:', err)
  process.exit(1)
}
