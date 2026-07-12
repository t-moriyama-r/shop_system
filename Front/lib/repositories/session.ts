import { queryOptions } from '@tanstack/react-query'
import { API_BASE_URL } from '@/lib/config'

export const sessionKeys = {
  all: ['session'] as const,
}

export interface SessionUser {
  seAdminUserId: string
  email: string
  mustChangePassword: boolean
}

export async function fetchCurrentUser(): Promise<SessionUser | null> {
  const res = await fetch(`${API_BASE_URL}/api/auth/session`, { credentials: 'include' })
  if (!res.ok) return null
  return res.json()
}

export function currentUserQuery() {
  return queryOptions({
    queryKey: sessionKeys.all,
    queryFn: fetchCurrentUser,
  })
}
