'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  shopAccountQuery,
  type EmailNotificationLog,
  type ShopAccountDetail,
} from '@/lib/repositories/shop-accounts'

export function CustomerCompleteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const shopAccountId = searchParams.get('shopAccountId') ?? ''

  useEffect(() => {
    if (!shopAccountId) router.replace('/admin/dashboard')
  }, [shopAccountId, router])

  const query = useQuery(shopAccountQuery(shopAccountId))

  if (!shopAccountId) return null

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">顧客アカウント発行完了</h2>

      <section className="max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <CompleteBody
          account={query.data ?? null}
          loading={query.isPending}
          error={query.isError}
        />
      </section>
    </div>
  )
}

type CompleteBodyProps = {
  account: ShopAccountDetail | null
  loading: boolean
  error: boolean
}

function CompleteBody({ account, loading, error }: CompleteBodyProps) {
  if (loading) return <p className="text-sm text-gray-500">読み込み中...</p>
  if (error || !account) {
    return (
      <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
        顧客アカウント情報の取得に失敗しました
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
        顧客アカウントを発行しました。初期ログイン情報は登録されたメールアドレス宛に送信されます。
      </div>

      <SummaryList account={account} />
      <NotificationStatus log={account.emailNotificationLogs[0] ?? null} />

      <div className="flex justify-end">
        <Link
          href="/admin/dashboard"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          ダッシュボードへ戻る
        </Link>
      </div>
    </div>
  )
}

type SummaryListProps = { account: ShopAccountDetail }

function SummaryList({ account }: SummaryListProps) {
  return (
    <dl className="divide-y divide-gray-100 rounded-md border border-gray-200">
      {SUMMARY_ROWS.map((row) => (
        <div key={row.label} className="flex gap-4 px-4 py-3">
          <dt className="w-28 shrink-0 text-sm font-medium text-gray-500">{row.label}</dt>
          <dd className="text-sm text-gray-800">{row.value(account)}</dd>
        </div>
      ))}
    </dl>
  )
}

type NotificationStatusProps = { log: EmailNotificationLog | null }

function NotificationStatus({ log }: NotificationStatusProps) {
  const { label, className } = notificationStatusDisplay(log)
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">通知送信ステータス</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>
    </div>
  )
}

const SUMMARY_ROWS: { label: string; value: (account: ShopAccountDetail) => string }[] = [
  { label: 'ショップ名', value: (a) => a.shopName },
  { label: '担当者名', value: (a) => a.contactName },
  { label: 'メールアドレス', value: (a) => a.email },
  { label: '発行日時', value: (a) => formatDateTime(a.createdAt) },
]

function notificationStatusDisplay(log: EmailNotificationLog | null): {
  label: string
  className: string
} {
  if (!log || log.sendStatus === 'PENDING') {
    return { label: '送信処理中', className: 'bg-amber-100 text-amber-700' }
  }
  if (log.sendStatus === 'SUCCESS') {
    return {
      label: `送信済み（${formatDateTime(log.sentAt)}）`,
      className: 'bg-green-100 text-green-700',
    }
  }
  return { label: '送信失敗', className: 'bg-red-100 text-red-700' }
}

function formatDateTime(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ja-JP')
}
