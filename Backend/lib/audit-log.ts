import { db, auditLogs } from 'db'

interface AuditLogParams {
  operatorType: 'se_admin' | 'cli' | 'system'
  seAdminUserId?: string | null
  actionType: string
  targetType?: string | null
  targetId?: string | null
  result: 'SUCCESS' | 'FAILURE' | 'ERROR'
  detail?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export async function recordAuditLog(params: AuditLogParams): Promise<void> {
  await db.insert(auditLogs).values({
    operatorType: params.operatorType,
    seAdminUserId: params.seAdminUserId ?? null,
    actionType: params.actionType,
    targetType: params.targetType ?? null,
    targetId: params.targetId ?? null,
    result: params.result,
    detail: params.detail ?? null,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
  })
}
