import './load-env'

import { deleteExpiredSessions } from './sessions'

try {
  const now = new Date()
  const count = await deleteExpiredSessions(now)
  console.log(`Deleted ${count} expired session(s) (expired before ${now.toISOString()})`)
  process.exit(0)
} catch (err) {
  console.error('Session cleanup failed:', err)
  process.exit(1)
}
