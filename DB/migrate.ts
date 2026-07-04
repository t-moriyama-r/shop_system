import './load-env'

import { migrate } from 'drizzle-orm/node-postgres/migrator'

import { db } from './client'

try {
  await migrate(db, { migrationsFolder: './migrations' })
  console.log('Migrations applied')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err)
  process.exit(1)
}
