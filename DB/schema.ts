import { boolean, integer, pgTable, smallint, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

// ========== 既存テーブル ==========

export const menuItems = pgTable('menu_items', {
  menuItemId: uuid('menu_item_id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  price: integer('price').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ========== SE管理画面テーブル ==========

export const seAdminUsers = pgTable('se_admin_users', {
  seAdminUserId: uuid('se_admin_user_id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }),
  isLocked: boolean('is_locked').notNull().default(false),
  failedLoginCount: smallint('failed_login_count').notNull().default(0),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sessions = pgTable('sessions', {
  sessionId: varchar('session_id', { length: 255 }).primaryKey(),
  seAdminUserId: uuid('se_admin_user_id').notNull().references(() => seAdminUsers.seAdminUserId),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const shopAccounts = pgTable('shop_accounts', {
  shopAccountId: uuid('shop_account_id').primaryKey().defaultRandom(),
  shopName: varchar('shop_name', { length: 255 }).notNull(),
  contactName: varchar('contact_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  initialPasswordHash: varchar('initial_password_hash', { length: 255 }),
  accountStatus: varchar('account_status', { length: 50 }).notNull().default('pending'),
  issuedBySeAdminUserId: uuid('issued_by_se_admin_user_id').notNull().references(() => seAdminUsers.seAdminUserId),
  notificationSentAt: timestamp('notification_sent_at', { withTimezone: true }),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const auditLogs = pgTable('audit_logs', {
  auditLogId: uuid('audit_log_id').primaryKey().defaultRandom(),
  operatorType: varchar('operator_type', { length: 50 }).notNull(),
  seAdminUserId: uuid('se_admin_user_id'),
  actionType: varchar('action_type', { length: 100 }).notNull(),
  targetType: varchar('target_type', { length: 100 }),
  targetId: uuid('target_id'),
  result: varchar('result', { length: 50 }).notNull(),
  detail: text('detail'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const emailNotificationLogs = pgTable('email_notification_logs', {
  emailNotificationLogId: uuid('email_notification_log_id').primaryKey().defaultRandom(),
  shopAccountId: uuid('shop_account_id').notNull().references(() => shopAccounts.shopAccountId),
  toEmail: varchar('to_email', { length: 255 }).notNull(),
  notificationType: varchar('notification_type', { length: 100 }).notNull(),
  sendStatus: varchar('send_status', { length: 50 }).notNull().default('PENDING'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  retryCount: smallint('retry_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
