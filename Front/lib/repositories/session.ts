import { API_BASE_URL } from '@/lib/config'

export interface SessionUser {
  seAdminUserId: string
  email: string
}

export async function fetchCurrentUser(): Promise<SessionUser | null> {
  const res = await fetch(`${API_BASE_URL}/api/auth/session`, { credentials: 'include' })
  if (!res.ok) return null
  return res.json()
}
