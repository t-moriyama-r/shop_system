import './load-env'

import { migrate } from 'drizzle-orm/node-postgres/migrator'

import { db } from './client'

await migrate(db, { migrationsFolder: './migrations' })

console.log('Migrations applied')
process.exit(0)
