'use client'

import { useEffect, useState } from 'react'
import { AuthenticatedLayout } from '../components/authenticated-layout'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

const PAGE_SIZE = 20

interface SeAdminUser {
  seAdminUserId: string
  email: string
  isLocked: boolean
  failedLoginCount: number
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: '作成日時（新しい順）' },
  { value: 'createdAt:asc', label: '作成日時（古い順）' },
  { value: 'email:asc', label: 'メールアドレス（昇順）' },
  { value: 'email:desc', label: 'メールアドレス（降順）' },
  { value: 'lastLoginAt:desc', label: '最終ログイン（新しい順）' },
]

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('ja-JP', { hour12: false })
}

export default function AccountsPage() {
  return (
    <AuthenticatedLayout>
      <AccountsContent />
    </AuthenticatedLayout>
  )
}

function AccountsContent() {
  const [items, setItems] = useState<SeAdminUser[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('createdAt:desc')
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<SeAdminUser | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/session`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCurrentUserId(data?.seAdminUserId ?? null))
      .catch(() => setCurrentUserId(null))
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
          sort,
        })
        if (keyword) params.set('keyword', keyword)

        const res = await fetch(`${API_BASE}/api/se-admin-users?${params.toString()}`, {
          credentials: 'include',
        })
        if (cancelled) return
        if (!res.ok) {
          setError('一覧の取得に失敗しました')
          return
        }
        const data: { data: SeAdminUser[]; pagination: Pagination } = await res.json()
        if (cancelled) return
        setError('')
        setItems(data.data)
        setPagination(data.pagination)
      } catch {
        if (!cancelled) setError('通信エラーが発生しました')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [page, sort, keyword, refreshKey])

  const refetch = () => setRefreshKey((k) => k + 1)

  const handleSearch = () => {
    setActionMessage('')
    setLoading(true)
    setPage(1)
    setKeyword(searchInput.trim())
  }

  const handleUnlock = async (user: SeAdminUser) => {
    setActionLoading(true)
    setActionMessage('')
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/se-admin-users/${user.seAdminUserId}/lock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isLocked: false }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'ロック解除に失敗しました')
        return
      }
      setActionMessage(`${user.email} のロックを解除しました`)
      setLoading(true)
      refetch()
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setActionLoading(true)
    setActionMessage('')
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/se-admin-users/${deleteTarget.seAdminUserId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? '削除に失敗しました')
        return
      }
      setActionMessage(`${deleteTarget.email} を削除しました`)
      setDeleteTarget(null)
      // 削除により現在ページが空になる場合は前ページへ戻す。
      setLoading(true)
      if (items.length === 1 && page > 1) {
        setPage((p) => p - 1)
      } else {
        refetch()
      }
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">SE管理者アカウント</h2>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {actionMessage && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{actionMessage}</div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch()
              }}
              placeholder="メールアドレスで検索"
              className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              検索
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            並び順
            <select
              value={sort}
              onChange={(e) => {
                setLoading(true)
                setPage(1)
                setSort(e.target.value)
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">メールアドレス</th>
                <th className="px-4 py-3 font-medium">状態</th>
                <th className="px-4 py-3 font-medium">連続失敗</th>
                <th className="px-4 py-3 font-medium">最終ログイン</th>
                <th className="px-4 py-3 font-medium">作成日時</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    読み込み中...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    該当するSE管理者アカウントはありません
                  </td>
                </tr>
              ) : (
                items.map((user) => {
                  const isSelf = user.seAdminUserId === currentUserId
                  return (
                    <tr key={user.seAdminUserId} className="border-b border-gray-100">
                      <td className="px-4 py-3 text-gray-800">
                        {user.email}
                        {isSelf && (
                          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                            自分
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {user.isLocked ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            ロック中
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            有効
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{user.failedLoginCount}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDateTime(user.lastLoginAt)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDateTime(user.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {user.isLocked && (
                            <button
                              type="button"
                              onClick={() => handleUnlock(user)}
                              disabled={actionLoading}
                              className="rounded-md border border-blue-600 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              ロック解除
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setActionMessage('')
                              setError('')
                              setDeleteTarget(user)
                            }}
                            disabled={isSelf || actionLoading}
                            title={isSelf ? '自分自身のアカウントは削除できません' : undefined}
                            className="rounded-md border border-red-600 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.total > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              全 {pagination.total} 件中 {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} 件
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLoading(true)
                  setPage((p) => Math.max(1, p - 1))
                }}
                disabled={pagination.page <= 1 || loading}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
              >
                前へ
              </button>
              <span>
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => {
                  setLoading(true)
                  setPage((p) => p + 1)
                }}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </section>

      {deleteTarget && (
        <DeleteConfirmDialog
          email={deleteTarget.email}
          loading={actionLoading}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

function DeleteConfirmDialog({
  email,
  loading,
  onCancel,
  onConfirm,
}: {
  email: string
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-800">SE管理者アカウントの削除</h3>
        <p className="mt-3 text-sm text-gray-600">
          以下のアカウントを削除します。この操作は取り消せません。
        </p>
        <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
          {email}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '削除中...' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  )
}
