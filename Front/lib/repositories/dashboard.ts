import { queryOptions } from '@tanstack/react-query'
import { API_BASE_URL } from '@/lib/config'

export const DEFAULT_ACTIVITIES_LIMIT = 10

// クエリキーは複数ページ・キャッシュ無効化で共有するため repository 層に集約する。
export const dashboardKeys = {
  all: ['dashboard'] as const,
  activities: (limit: number) => [...dashboardKeys.all, 'shop-account-activities', limit] as const,
}

export interface DashboardSummary {
  systemStatus: string
  shopAccounts: {
    total: number
    active: number
    pending: number
    suspended: number
  }
  seAdmins: {
    total: number
  }
  generatedAt: string
}

export interface ActivityNotification {
  notificationType: string
  sendStatus: string
  sentAt: string | null
  errorMessage: string | null
  createdAt: string
}

export interface ShopAccountActivity {
  shopAccountId: string
  shopName: string
  email: string
  accountStatus: string
  issuedBySeAdminUserId: string
  createdAt: string
  latestNotification: ActivityNotification | null
}

export interface ShopAccountActivitiesResponse {
  data: ShopAccountActivity[]
  limit: number
}

export async function fetchShopAccountActivities(
  limit: number = DEFAULT_ACTIVITIES_LIMIT,
): Promise<ShopAccountActivitiesResponse> {
  const params = new URLSearchParams({ limit: String(limit) })
  const res = await fetch(
    `${API_BASE_URL}/api/dashboard/shop-account-activities?${params.toString()}`,
    { credentials: 'include' },
  )
  if (!res.ok) throw new Error('発行状況の取得に失敗しました')
  return res.json()
}

export function shopAccountActivitiesQuery(limit: number = DEFAULT_ACTIVITIES_LIMIT) {
  return queryOptions({
    queryKey: dashboardKeys.activities(limit),
    queryFn: () => fetchShopAccountActivities(limit),
  })
}
