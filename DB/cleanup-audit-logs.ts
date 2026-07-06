import './load-env'

import { auditLogRetentionCutoff, deleteExpiredAuditLogs } from './audit-logs'

try {
  const cutoff = auditLogRetentionCutoff()
  const count = await deleteExpiredAuditLogs(cutoff)
  console.log(`Deleted ${count} expired audit log(s) (created before ${cutoff.toISOString()})`)
  process.exit(0)
} catch (err) {
  console.error('Audit log cleanup failed:', err)
  process.exit(1)
}
