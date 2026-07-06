'use client'

import type { DashboardSummary } from '@/lib/repositories/dashboard'
import { SummaryCard } from './SummaryCard'

function systemStatusLabel(status: string): { label: string; variant: 'success' | 'danger' } {
  return status === 'ok'
    ? { label: '正常', variant: 'success' }
    : { label: status, variant: 'danger' }
}

export function SummaryPanel({
  summary,
  loading,
  error,
}: {
  summary: DashboardSummary | undefined
  loading: boolean
  error: string | null
}) {
  const status = summary ? systemStatusLabel(summary.systemStatus) : null

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-700">システム稼働サマリー</h3>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : loading || !summary || !status ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="登録顧客数" value={summary.shopAccounts.total} />
          <SummaryCard label="有効" value={summary.shopAccounts.active} variant="success" />
          <SummaryCard label="SE管理者数" value={summary.seAdmins.total} />
          <SummaryCard label="システム状態" value={status.label} variant={status.variant} />
        </div>
      )}

      {summary ? (
        <p className="mt-4 text-xs text-gray-400">
          保留 {summary.shopAccounts.pending} 件 / 停止 {summary.shopAccounts.suspended} 件 ・
          最終更新 {new Date(summary.generatedAt).toLocaleString('ja-JP', { hour12: false })}
        </p>
      ) : null}
    </section>
  )
}
