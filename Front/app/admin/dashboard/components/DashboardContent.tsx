import { fetchDashboardSummaryOnServer } from '@/lib/repositories/dashboard.server'
import { ActivitiesSection } from './ActivitiesSection'
import { SummaryPanel } from './SummaryPanel'

export async function DashboardContent() {
  const { data: summary, error } = await fetchDashboardSummaryOnServer()

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">ダッシュボード</h2>

      <SummaryPanel summary={summary ?? undefined} loading={false} error={error} />

      <ActivitiesSection />
    </div>
  )
}
