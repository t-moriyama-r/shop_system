import { lt } from 'drizzle-orm'

import { db } from './client'
import { sessions } from './schema'

/**
 * 有効期限が切れたセッションレコードを削除する。
 *
 * 認証時 (Backend/middleware/auth.ts) は期限切れセッションを認証に使わないが、
 * レコード自体はテーブルに残り続ける。長期運用でのテーブル肥大化を防ぐため、
 * 定期的にこの関数（または cleanup-sessions バッチ）を実行する。
 *
 * @param now 基準時刻（この時刻より前に期限切れになったセッションを削除）
 * @returns 削除したセッション数
 */
export async function deleteExpiredSessions(now: Date = new Date()): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, now))
    .returning({ sessionId: sessions.sessionId })

  return deleted.length
}
