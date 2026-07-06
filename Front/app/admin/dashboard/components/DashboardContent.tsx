'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchDashboardSummary, fetchShopAccountActivities } from '@/lib/repositories/dashboard'
import { ActivitiesPanel } from './ActivitiesPanel'
import { SummaryPanel } from './SummaryPanel'

export function DashboardContent() {
  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: fetchDashboardSummary,
  })

  const activitiesQuery = useQuery({
    queryKey: ['dashboard', 'shop-account-activities'],
    queryFn: () => fetchShopAccountActivities(),
  })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">ダッシュボード</h2>

      <SummaryPanel
        summary={summaryQuery.data}
        loading={summaryQuery.isPending}
        error={summaryQuery.isError ? 'サマリーの取得に失敗しました' : null}
      />

      <ActivitiesPanel
        activities={activitiesQuery.data?.data ?? []}
        loading={activitiesQuery.isPending}
        error={activitiesQuery.isError ? '発行状況の取得に失敗しました' : null}
        refreshing={activitiesQuery.isFetching}
        onRefresh={() => activitiesQuery.refetch()}
      />
    </div>
  )
}
