'use client'

import type { DashboardSummary } from '@/lib/repositories/dashboard'
import { SummaryCard } from './SummaryCard'

export function SummaryPanel({ summary, loading, error }: SummaryPanelProps) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-700">システム稼働サマリー</h3>
      <SummaryBody summary={summary} loading={loading} error={error} />
    </section>
  )
}

function SummaryBody({ summary, loading, error }: SummaryPanelProps) {
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (loading || !summary) return <p className="text-sm text-gray-400">読み込み中...</p>
  return (
    <>
      <SummaryCards summary={summary} />
      <SummaryFooter summary={summary} />
    </>
  )
}

function SummaryCards({ summary }: SummaryDataProps) {
  const status = systemStatusLabel(summary.systemStatus)
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard label="登録顧客数" value={summary.shopAccounts.total} />
      <SummaryCard label="有効" value={summary.shopAccounts.active} variant="success" />
      <SummaryCard label="SE管理者数" value={summary.seAdmins.total} />
      <SummaryCard label="システム状態" value={status.label} variant={status.variant} />
    </div>
  )
}

function SummaryFooter({ summary }: SummaryDataProps) {
  return (
    <p className="mt-4 text-xs text-gray-400">
      保留 {summary.shopAccounts.pending} 件 / 停止 {summary.shopAccounts.suspended} 件 ・ 最終更新{' '}
      {new Date(summary.generatedAt).toLocaleString('ja-JP', { hour12: false })}
    </p>
  )
}

// 以下、コンポーネント以外の定義（型・ヘルパー）

interface SystemStatus {
  label: string
  variant: 'success' | 'danger'
}

type SummaryPanelProps = {
  summary: DashboardSummary | undefined
  loading: boolean
  error: string | null
}

type SummaryDataProps = {
  summary: DashboardSummary
}

function systemStatusLabel(status: string): SystemStatus {
  return status === 'ok'
    ? { label: '正常', variant: 'success' }
    : { label: status, variant: 'danger' }
}
