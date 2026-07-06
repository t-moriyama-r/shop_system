import { count, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from './client'
import { emailNotificationLogs, seAdminUsers, shopAccounts } from './schema'

export interface DashboardSummary {
  shopAccounts: {
    total: number
    active: number
    pending: number
    suspended: number
  }
  seAdmins: {
    total: number
  }
}

/**
 * ダッシュボード用の最小集計サマリを返す。
 * 論理削除済み（is_deleted=true）は各件数から除外する。
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [shop] = await db
    .select({
      total: count(),
      active: count(sql`CASE WHEN ${shopAccounts.accountStatus} = 'active' THEN 1 END`),
      pending: count(sql`CASE WHEN ${shopAccounts.accountStatus} = 'pending' THEN 1 END`),
      suspended: count(sql`CASE WHEN ${shopAccounts.accountStatus} = 'suspended' THEN 1 END`),
    })
    .from(shopAccounts)
    .where(eq(shopAccounts.isDeleted, false))

  const [admin] = await db
    .select({ total: count() })
    .from(seAdminUsers)
    .where(eq(seAdminUsers.isDeleted, false))

  return {
    shopAccounts: {
      total: Number(shop.total),
      active: Number(shop.active),
      pending: Number(shop.pending),
      suspended: Number(shop.suspended),
    },
    seAdmins: { total: Number(admin.total) },
  }
}

export interface ShopAccountActivity {
  shopAccountId: string
  shopName: string
  email: string
  accountStatus: string
  issuedBySeAdminUserId: string
  createdAt: Date
  latestNotification: {
    notificationType: string
    sendStatus: string
    sentAt: Date | null
    errorMessage: string | null
    createdAt: Date
  } | null
}

/**
 * 直近の顧客アカウント発行状況一覧を返す（新しい順・論理削除除外）。
 * 各アカウントに最新のメール送信ログ 1 件を付与する。
 *
 * N+1 を避けるため、対象アカウントを1クエリで取得したうえで、その ID 群の
 * メール送信ログをまとめて取得し、アプリ側で最新1件を割り当てる。
 */
export async function listShopAccountActivities(limit: number): Promise<ShopAccountActivity[]> {
  const accounts = await db
    .select({
      shopAccountId: shopAccounts.shopAccountId,
      shopName: shopAccounts.shopName,
      email: shopAccounts.email,
      accountStatus: shopAccounts.accountStatus,
      issuedBySeAdminUserId: shopAccounts.issuedBySeAdminUserId,
      createdAt: shopAccounts.createdAt,
    })
    .from(shopAccounts)
    .where(eq(shopAccounts.isDeleted, false))
    .orderBy(desc(shopAccounts.createdAt))
    .limit(limit)

  if (accounts.length === 0) {
    return []
  }

  const logs = await db
    .select({
      shopAccountId: emailNotificationLogs.shopAccountId,
      notificationType: emailNotificationLogs.notificationType,
      sendStatus: emailNotificationLogs.sendStatus,
      sentAt: emailNotificationLogs.sentAt,
      errorMessage: emailNotificationLogs.errorMessage,
      createdAt: emailNotificationLogs.createdAt,
    })
    .from(emailNotificationLogs)
    .where(
      inArray(
        emailNotificationLogs.shopAccountId,
        accounts.map((a) => a.shopAccountId),
      ),
    )
    .orderBy(desc(emailNotificationLogs.createdAt))

  // shopAccountId ごとに最初に現れたログ（= createdAt 降順の先頭 = 最新）を採用する。
  const latestByAccount = new Map<string, (typeof logs)[number]>()
  for (const log of logs) {
    if (!latestByAccount.has(log.shopAccountId)) {
      latestByAccount.set(log.shopAccountId, log)
    }
  }

  return accounts.map((account) => {
    const log = latestByAccount.get(account.shopAccountId)
    return {
      ...account,
      latestNotification: log
        ? {
            notificationType: log.notificationType,
            sendStatus: log.sendStatus,
            sentAt: log.sentAt,
            errorMessage: log.errorMessage,
            createdAt: log.createdAt,
          }
        : null,
    }
  })
}
