'use client'

import type { ActivityNotification, ShopAccountActivity } from '@/lib/repositories/dashboard'
import { LoadingIndicator } from '../../components/LoadingIndicator'

type Props = {
  activities: ShopAccountActivity[]
  loading: boolean
  error: string | null
  refreshing: boolean
  onRefresh: () => void
}

export function ActivitiesPanel({ activities, loading, error, refreshing, onRefresh }: Props) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-700">顧客アカウント発行状況</h3>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? '更新中...' : '更新'}
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">会社名</th>
              <th className="px-4 py-3 font-medium">メールアドレス</th>
              <th className="px-4 py-3 font-medium">発行日時</th>
              <th className="px-4 py-3 font-medium">ステータス</th>
              <th className="px-4 py-3 font-medium">メール送信</th>
            </tr>
          </thead>
          <tbody>
            <ActivitiesTableBody activities={activities} loading={loading} />
          </tbody>
        </table>
      </div>
    </section>
  )
}

type ActivitiesTableBodyProps = {
  activities: ShopAccountActivity[]
  loading: boolean
}

function ActivitiesTableBody({ activities, loading }: ActivitiesTableBodyProps) {
  if (loading) return <EmptyRow message={<LoadingIndicator />} />
  if (activities.length === 0) return <EmptyRow message="まだ顧客アカウントは発行されていません" />
  return (
    <>
      {activities.map((activity) => (
        <ActivityRow key={activity.shopAccountId} activity={activity} />
      ))}
    </>
  )
}

type ActivityRowProps = {
  activity: ShopAccountActivity
}

function ActivityRow({ activity }: ActivityRowProps) {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-4 py-3">{activity.shopName}</td>
      <td className="px-4 py-3">{activity.email}</td>
      <td className="px-4 py-3">{formatDateTime(activity.createdAt)}</td>
      <td className="px-4 py-3">
        <AccountStatusBadge status={activity.accountStatus} />
      </td>
      <td className="px-4 py-3">
        <NotificationCell notification={activity.latestNotification} />
      </td>
    </tr>
  )
}

type EmptyRowProps = {
  message: React.ReactNode
}

function EmptyRow({ message }: EmptyRowProps) {
  return (
    <tr>
      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
        {message}
      </td>
    </tr>
  )
}

type AccountStatusBadgeProps = {
  status: string
}

function AccountStatusBadge({ status }: AccountStatusBadgeProps) {
  const meta = ACCOUNT_STATUS[status] ?? { label: status, className: 'bg-gray-100 text-gray-700' }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

type NotificationCellProps = {
  notification: ActivityNotification | null
}

function NotificationCell({ notification }: NotificationCellProps) {
  if (!notification) {
    return <span className="text-gray-400">未送信</span>
  }

  if (!isFailedNotification(notification)) {
    return <span className="text-green-600">送信済み（{formatDateTime(notification.sentAt)}）</span>
  }

  return (
    <details className="text-red-600">
      <summary className="cursor-pointer select-none font-medium">送信失敗（詳細）</summary>
      <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600">
        {notification.errorMessage ?? 'エラー詳細は記録されていません'}
      </p>
    </details>
  )
}

const ACCOUNT_STATUS: Record<string, { label: string; className: string }> = {
  active: { label: '有効', className: 'bg-green-100 text-green-700' },
  pending: { label: '保留', className: 'bg-amber-100 text-amber-700' },
  suspended: { label: '停止', className: 'bg-red-100 text-red-700' },
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('ja-JP', { hour12: false })
}

function isFailedNotification(notification: ActivityNotification): boolean {
  return notification.sendStatus === 'failed' || notification.errorMessage !== null
}
