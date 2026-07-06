import { and, asc, count, desc, eq, gte, lt, lte, type SQL } from 'drizzle-orm'

import { db } from './client'
import { auditLogs } from './schema'

export type AuditLog = typeof auditLogs.$inferSelect

export interface AuditLogFilters {
  actionType?: string
  result?: string
  seAdminUserId?: string
  targetType?: string
  targetId?: string
  dateFrom?: Date
  dateTo?: Date
  /** 'createdAt:asc' で昇順、それ以外（未指定含む）は降順。 */
  sort?: string
  page: number
  limit: number
}

/**
 * 監査ログを検索する（フィルタ・ページネーション・createdAt ソート）。
 *
 * 改ざん防止のため参照専用。フィルタ値の妥当性検証（UUID/日時形式など）は
 * HTTP の関心事として呼び出し側（route）で行い、ここには検証済みの値を渡す。
 */
export async function listAuditLogs(
  filters: AuditLogFilters,
): Promise<{ rows: AuditLog[]; total: number }> {
  const conditions: SQL[] = []

  if (filters.actionType) {
    conditions.push(eq(auditLogs.actionType, filters.actionType))
  }
  if (filters.result) {
    conditions.push(eq(auditLogs.result, filters.result))
  }
  if (filters.targetType) {
    conditions.push(eq(auditLogs.targetType, filters.targetType))
  }
  if (filters.seAdminUserId) {
    conditions.push(eq(auditLogs.seAdminUserId, filters.seAdminUserId))
  }
  if (filters.targetId) {
    conditions.push(eq(auditLogs.targetId, filters.targetId))
  }
  if (filters.dateFrom) {
    conditions.push(gte(auditLogs.createdAt, filters.dateFrom))
  }
  if (filters.dateTo) {
    conditions.push(lte(auditLogs.createdAt, filters.dateTo))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  const orderBy =
    filters.sort === 'createdAt:asc' ? asc(auditLogs.createdAt) : desc(auditLogs.createdAt)

  const rows = await db
    .select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(filters.limit)
    .offset((filters.page - 1) * filters.limit)

  const [{ value: total }] = await db.select({ value: count() }).from(auditLogs).where(whereClause)

  return { rows, total }
}

/**
 * 監査ログの保持期間（月数）。この期間を超過した（＝カットオフより前に作成された）
 * レコードは日次バッチで物理削除する（BP-006/BP-012）。
 */
export const AUDIT_LOG_RETENTION_MONTHS = 1

/**
 * 監査ログ削除のカットオフ日時を返す。この日時より前に作成されたログが削除対象となる。
 *
 * @param now 基準時刻（この時刻から保持期間分だけ遡った日時をカットオフとする）
 */
export function auditLogRetentionCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - AUDIT_LOG_RETENTION_MONTHS)
  return cutoff
}

/**
 * 保持期間を超過した監査ログを物理削除する。
 *
 * 改ざん防止のため audit_logs はアプリケーション層からの UPDATE/DELETE を不可とするが
 * （BP-012 備考）、保持期間超過レコードの削除はこの日次バッチのみ例外的に許可する。
 * 運用では日次 cron 等で `deleteExpiredAuditLogs(auditLogRetentionCutoff())` を実行する。
 *
 * @param cutoff この日時より前に作成された（createdAt < cutoff）ログを削除する
 * @returns 削除した監査ログ件数
 */
export async function deleteExpiredAuditLogs(cutoff: Date): Promise<number> {
  const deleted = await db
    .delete(auditLogs)
    .where(lt(auditLogs.createdAt, cutoff))
    .returning({ auditLogId: auditLogs.auditLogId })

  return deleted.length
}
