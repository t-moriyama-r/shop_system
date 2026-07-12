import './load-env'

import bcrypt from 'bcrypt'
import { sql } from 'drizzle-orm'

import { db } from './client'
import { menuItems, seAdminUsers } from './schema'

try {
  await db.insert(menuItems).values([
    { name: 'コーヒー', price: 400 },
    { name: 'カフェラテ', price: 480 },
    { name: 'チーズケーキ', price: 550 },
  ]).onConflictDoNothing()

  // SE管理者の初期アカウント。ローカル環境ではメール送信ができないため、ランダム生成の
  // 代わりに既知の固定パスワードをハッシュ保存し、must_change_password=true で
  // 本番同等の「初回ログイン後にパスワード変更を強制」フローを踏めるようにする。
  const passwordHash = await bcrypt.hash('Admin1234', 10)
  await db.insert(seAdminUsers)
    .values([{ email: 'admin@example.com', password: passwordHash, mustChangePassword: true }])
    .onConflictDoUpdate({
      target: seAdminUsers.email,
      set: { password: passwordHash, mustChangePassword: true, updatedAt: new Date() },
      // 旧方式（password NULL）で作成された開発 DB のアカウントだけ救済する。
      // パスワード変更済みのアカウントは上書きしない（冪等性の維持）。
      setWhere: sql`${seAdminUsers.password} is null`,
    })

  console.log('Seed data inserted')
  process.exit(0)
} catch (err) {
  console.error('Seed failed:', err)
  process.exit(1)
}
