import { listAuditLogs } from 'db/audit-logs'
import type { HandlerResult } from './types'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parsePositiveInt(value: string | undefined, fallback: number, max?: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }
  return max ? Math.min(parsed, max) : parsed
}

export interface ListAuditLogsInput {
  page?: string
  limit?: string
  actionType?: string
  result?: string
  targetType?: string
  seAdminUserId?: string
  targetId?: string
  dateFrom?: string
  dateTo?: string
  sort?: string
}

// 監査ログ参照。入力のパース/バリデーション（UUID・日時）を行い、検証済みの値で
// db/audit-logs のデータアクセス関数へ委譲する。改ざん防止のため参照のみ。
export async function listAuditLogsHandler(input: ListAuditLogsInput): Promise<HandlerResult> {
  const page = parsePositiveInt(input.page, DEFAULT_PAGE)
  const limit = parsePositiveInt(input.limit, DEFAULT_LIMIT, MAX_LIMIT)

  const seAdminUserId = input.seAdminUserId?.trim()
  const targetId = input.targetId?.trim()
  const dateFromRaw = input.dateFrom?.trim()
  const dateToRaw = input.dateTo?.trim()

  if (seAdminUserId && !UUID_PATTERN.test(seAdminUserId)) {
    return { status: 400, body: { error: 'seAdminUserId はUUID形式で指定してください' } }
  }
  if (targetId && !UUID_PATTERN.test(targetId)) {
    return { status: 400, body: { error: 'targetId はUUID形式で指定してください' } }
  }

  let dateFrom: Date | undefined
  if (dateFromRaw) {
    dateFrom = new Date(dateFromRaw)
    if (Number.isNaN(dateFrom.getTime())) {
      return { status: 400, body: { error: 'dateFrom は日時形式で指定してください' } }
    }
  }
  let dateTo: Date | undefined
  if (dateToRaw) {
    dateTo = new Date(dateToRaw)
    if (Number.isNaN(dateTo.getTime())) {
      return { status: 400, body: { error: 'dateTo は日時形式で指定してください' } }
    }
  }

  const { rows, total } = await listAuditLogs({
    actionType: input.actionType?.trim() || undefined,
    result: input.result?.trim() || undefined,
    targetType: input.targetType?.trim() || undefined,
    seAdminUserId: seAdminUserId || undefined,
    targetId: targetId || undefined,
    dateFrom,
    dateTo,
    sort: input.sort,
    page,
    limit,
  })

  return {
    status: 200,
    body: {
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  }
}
