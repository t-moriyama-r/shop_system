'use client'

import Link from 'next/link'
import type { ShopAccount } from '@/lib/repositories/shop-accounts'

type Props = {
  account: ShopAccount
  onIssueAnother: () => void
}

export function IssueCompletePanel({ account, onIssueAnother }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
        顧客アカウントを発行しました。初期ログイン情報は登録されたメールアドレス宛に送信されます。
      </div>

      <SummaryList account={account} />
      <NotificationStatus sentAt={account.notificationSentAt} />

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onIssueAnother}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          続けて発行する
        </button>
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

type SummaryListProps = { account: ShopAccount }

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

type NotificationStatusProps = { sentAt: string | null }

function NotificationStatus({ sentAt }: NotificationStatusProps) {
  const sent = sentAt !== null
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">通知送信ステータス</span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          sent ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}
      >
        {sent ? `送信済み（${formatDateTime(sentAt)}）` : '送信処理中'}
      </span>
    </div>
  )
}

const SUMMARY_ROWS: { label: string; value: (account: ShopAccount) => string }[] = [
  { label: 'ショップ名', value: (a) => a.shopName },
  { label: '担当者名', value: (a) => a.contactName },
  { label: 'メールアドレス', value: (a) => a.email },
  { label: '発行日時', value: (a) => formatDateTime(a.createdAt) },
]

function formatDateTime(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ja-JP')
}
