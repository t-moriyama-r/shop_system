import { API_BASE_URL } from '@/lib/config'

export const ACTIVITIES_LIMIT = 10

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

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/summary`, { credentials: 'include' })
  if (!res.ok) throw new Error('サマリーの取得に失敗しました')
  return res.json()
}

export async function fetchShopAccountActivities(
  limit: number = ACTIVITIES_LIMIT,
): Promise<ShopAccountActivitiesResponse> {
  const params = new URLSearchParams({ limit: String(limit) })
  const res = await fetch(
    `${API_BASE_URL}/api/dashboard/shop-account-activities?${params.toString()}`,
    { credentials: 'include' },
  )
  if (!res.ok) throw new Error('発行状況の取得に失敗しました')
  return res.json()
}
