import { cookies } from 'next/headers'
import { API_BASE_URL } from '@/lib/config'
import type { DashboardSummary } from '@/lib/repositories/dashboard'

export type DashboardSummaryResult = {
  data: DashboardSummary | null
  error: string | null
}

export async function fetchDashboardSummaryOnServer(): Promise<DashboardSummaryResult> {
  try {
    const cookieStore = await cookies()
    const res = await fetch(`${API_BASE_URL}/api/dashboard/summary`, {
      headers: { Cookie: cookieStore.toString() },
      cache: 'no-store',
    })
    if (!res.ok) {
      return { data: null, error: 'サマリーの取得に失敗しました' }
    }
    const data: DashboardSummary = await res.json()
    return { data, error: null }
  } catch {
    return { data: null, error: 'サマリーの取得に失敗しました' }
  }
}
