'use client'

import { AuthenticatedLayout } from '../components/AuthenticatedLayout'

export default function DashboardPage() {
  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">ダッシュボード</h2>

        {/* システム稼働サマリーエリア */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-700">
            システム稼働サマリー
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="登録顧客数" value="--" />
            <SummaryCard label="本日の発行数" value="--" />
            <SummaryCard label="システム状態" value="正常" variant="success" />
          </div>
          <p className="mt-4 text-xs text-gray-400">
            ※ 詳細なメトリクスは二次開発にて実装予定
          </p>
        </section>

        {/* 顧客アカウント発行状況一覧 */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-700">
              顧客アカウント発行状況
            </h3>
            <a
              href="/admin/customers/new"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              顧客アカウント新規発行
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">会社名</th>
                  <th className="px-4 py-3 font-medium">メールアドレス</th>
                  <th className="px-4 py-3 font-medium">発行日時</th>
                  <th className="px-4 py-3 font-medium">ステータス</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    まだ顧客アカウントは発行されていません
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            ※ 顧客アカウント管理機能は Phase 2 にて実装予定
          </p>
        </section>
      </div>
    </AuthenticatedLayout>
  )
}

function SummaryCard({
  label,
  value,
  variant = 'default',
}: {
  label: string
  value: string
  variant?: 'default' | 'success'
}) {
  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          variant === 'success' ? 'text-green-600' : 'text-gray-800'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
