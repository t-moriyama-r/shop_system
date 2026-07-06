import { retryFailedEmailNotifications } from './lib/email/retryBatch'

try {
  const count = await retryFailedEmailNotifications()
  console.log(`Retried ${count} failed email notification(s)`)
  process.exit(0)
} catch (err) {
  console.error('Email notification retry batch failed:', err)
  process.exit(1)
}
