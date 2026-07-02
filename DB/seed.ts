import './load-env'

import { db, menuItems } from './client'

await db.insert(menuItems).values([
  { name: 'コーヒー', price: 400 },
  { name: 'カフェラテ', price: 480 },
  { name: 'チーズケーキ', price: 550 },
])

console.log('Seed data inserted')
process.exit(0)
