import { API_BASE_URL } from '@/lib/config'

export const PAGE_SIZE = 20

export interface SeAdminUser {
  seAdminUserId: string
  email: string
  isLocked: boolean
  failedLoginCount: number
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface SeAdminUsersResponse {
  data: SeAdminUser[]
  pagination: Pagination
}

export interface ListParams {
  page: number
  sort: string
  keyword: string
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const data: { error?: string } = await res.json().catch(() => ({}))
  return data.error ?? fallback
}

export async function fetchSeAdminUsers({
  page,
  sort,
  keyword,
}: ListParams): Promise<SeAdminUsersResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort })
  if (keyword) params.set('keyword', keyword)

  const res = await fetch(`${API_BASE_URL}/api/se-admin-users?${params.toString()}`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error('一覧の取得に失敗しました')
  return res.json()
}

export async function unlockSeAdminUser(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/se-admin-users/${id}/lock`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ isLocked: false }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, 'ロック解除に失敗しました'))
}

export async function deleteSeAdminUser(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/se-admin-users/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, '削除に失敗しました'))
}
