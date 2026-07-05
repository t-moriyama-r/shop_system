import { eq } from 'drizzle-orm'

import { db } from './client'
import { auditLogs, seAdminUsers } from './schema'

// 一般的なメールアドレス形式の簡易チェック（空白なし・@・ドメインにドット）。
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email)
}

/**
 * SE管理者アカウント追加時の入力・重複エラー。CLI 側で終了コードの出し分けに使う。
 */
export class SeAdminCreateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SeAdminCreateError'
  }
}

export interface CreatedSeAdmin {
  seAdminUserId: string
  email: string
}

/**
 * SE管理者アカウントを追加する（DB への直接書き込み）。
 *
 * 不正アクセスのリスクを抑えるため、追加は Web 画面ではなく CLI からのみ行う運用。
 * `password` は NULL（パスワード未設定 = 初回ログイン時に画面で設定）で作成し、
 * `audit_logs` に `SE_ADMIN_CREATE`（operator_type=cli）を記録する。
 *
 * @throws {SeAdminCreateError} メール形式が不正、または既に同一メールが存在する場合
 */
export async function createSeAdmin(email: string): Promise<CreatedSeAdmin> {
  const normalizedEmail = email.trim()

  if (!isValidEmail(normalizedEmail)) {
    throw new SeAdminCreateError(`メールアドレスの形式が不正です: ${email}`)
  }

  // email はユニーク制約があり論理削除済みレコードも枠を占有するため、is_deleted で絞らず存在確認する。
  const existing = await db
    .select({ seAdminUserId: seAdminUsers.seAdminUserId })
    .from(seAdminUsers)
    .where(eq(seAdminUsers.email, normalizedEmail))

  if (existing.length > 0) {
    throw new SeAdminCreateError(`既に登録済みのメールアドレスです: ${normalizedEmail}`)
  }

  const [created] = await db
    .insert(seAdminUsers)
    .values({ email: normalizedEmail })
    .returning({ seAdminUserId: seAdminUsers.seAdminUserId, email: seAdminUsers.email })

  await db.insert(auditLogs).values({
    operatorType: 'cli',
    actionType: 'SE_ADMIN_CREATE',
    targetType: 'se_admin_user',
    targetId: created.seAdminUserId,
    result: 'SUCCESS',
    detail: `CLI による SE 管理者アカウント追加: ${created.email}`,
  })

  return created
}
