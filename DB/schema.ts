import { integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const menuItems = pgTable('menu_items', {
  menuItemId: uuid('menu_item_id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  price: integer('price').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
