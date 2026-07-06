import { queryOptions } from '@tanstack/react-query'
import { API_BASE_URL } from '@/lib/config'

export interface ShopAccount {
  shopAccountId: string
  shopName: string
  contactName: string
  email: string
  accountStatus: string
  issuedBySeAdminUserId: string
  notificationSentAt: string | null
  isDeleted: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface EmailNotificationLog {
  emailNotificationLogId: string
  shopAccountId: string
  toEmail: string
  notificationType: string
  sendStatus: string
  sentAt: string | null
  errorMessage: string | null
  retryCount: number
  createdAt: string
  updatedAt: string
}

export interface ShopAccountDetail extends ShopAccount {
  emailNotificationLogs: EmailNotificationLog[]
}

export interface CreateShopAccountInput {
  shopName: string
  contactName: string
  email: string
}

export interface CreateShopAccountResponse {
  message: string
  shopAccount: ShopAccount
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const data: { error?: string } = await res.json().catch(() => ({}))
  return data.error ?? fallback
}

export async function createShopAccount(
  input: CreateShopAccountInput,
): Promise<CreateShopAccountResponse> {
  const res = await fetch(`${API_BASE_URL}/api/shop-accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, '顧客アカウントの発行に失敗しました'))
  return res.json()
}

export async function fetchShopAccount(shopAccountId: string): Promise<ShopAccountDetail> {
  const res = await fetch(`${API_BASE_URL}/api/shop-accounts/${shopAccountId}`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, '顧客アカウント情報の取得に失敗しました'))
  return res.json()
}

const NOTIFICATION_POLL_INTERVAL_MS = 3000

export const shopAccountKeys = {
  all: ['shop-accounts'] as const,
  detail: (shopAccountId: string) => [...shopAccountKeys.all, shopAccountId] as const,
}

export function shopAccountQuery(shopAccountId: string) {
  return queryOptions({
    queryKey: shopAccountKeys.detail(shopAccountId),
    queryFn: () => fetchShopAccount(shopAccountId),
    enabled: shopAccountId.length > 0,
    refetchInterval: (query) => {
      const latestLog = query.state.data?.emailNotificationLogs[0]
      return latestLog?.sendStatus === 'PENDING' ? NOTIFICATION_POLL_INTERVAL_MS : false
    },
  })
}
