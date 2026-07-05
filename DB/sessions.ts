import { and, eq, gt, lt } from 'drizzle-orm'

import { db } from './client'
import { sessions } from './schema'

export type Session = typeof sessions.$inferSelect

/**
 * 有効な（期限切れでない）セッションを取得する。認証ミドルウェアで使用する。
 *
 * @param sessionId 対象のセッションID
 * @param now 基準時刻（この時刻より後に期限切れになるセッションのみ有効とみなす）
 */
export async function findValidSession(
  sessionId: string,
  now: Date = new Date(),
): Promise<Session | undefined> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.sessionId, sessionId), gt(sessions.expiresAt, now)))
  return session
}

/**
 * セッションを新規作成する。セッションIDは呼び出し側で採番して渡す
 * （Cookie 設定に同じ値を使うため、生成は route 側の責務とする）。
 */
export async function createSession(
  sessionId: string,
  seAdminUserId: string,
  expiresAt: Date,
): Promise<void> {
  await db.insert(sessions).values({ sessionId, seAdminUserId, expiresAt })
}

/**
 * セッションの有効期限を更新する（スライディングウィンドウ用）。
 */
export async function extendSession(sessionId: string, expiresAt: Date): Promise<void> {
  await db.update(sessions).set({ expiresAt }).where(eq(sessions.sessionId, sessionId))
}

/**
 * 単一のセッションを削除する（ログアウト用）。
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.sessionId, sessionId))
}

/**
 * 指定ユーザーの全セッションを削除し、削除件数を返す（アカウント削除・パスワード設定時の無効化用）。
 */
export async function deleteSessionsForUser(seAdminUserId: string): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(eq(sessions.seAdminUserId, seAdminUserId))
    .returning({ sessionId: sessions.sessionId })
  return deleted.length
}

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
