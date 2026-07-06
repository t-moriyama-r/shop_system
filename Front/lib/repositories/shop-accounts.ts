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
