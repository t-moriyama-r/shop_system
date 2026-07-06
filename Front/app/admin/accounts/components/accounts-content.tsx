'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  deleteSeAdminUser,
  fetchSeAdminUsers,
  unlockSeAdminUser,
  type SeAdminUser,
} from '@/lib/repositories/se-admin-users'
import { fetchCurrentUser } from '@/lib/repositories/session'
import { AccountsToolbar } from './accounts-toolbar'
import { DeleteConfirmDialog } from './delete-confirm-dialog'
import { PaginationControls } from './pagination-controls'
import { SeAdminUserTable } from './se-admin-user-table'

export function AccountsContent() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState<number>(1)
  const [sort, setSort] = useState<string>('createdAt:desc')
  const [keyword, setKeyword] = useState<string>('')
  const [searchInput, setSearchInput] = useState<string>('')
  const [deleteTarget, setDeleteTarget] = useState<SeAdminUser | null>(null)
  const [actionMessage, setActionMessage] = useState<string>('')

  const sessionQuery = useQuery({ queryKey: ['session'], queryFn: fetchCurrentUser })

  const listQuery = useQuery({
    queryKey: ['se-admin-users', { page, sort, keyword }],
    queryFn: () => fetchSeAdminUsers({ page, sort, keyword }),
    placeholderData: (previous) => previous,
  })

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: ['se-admin-users'] })

  const unlockMutation = useMutation({
    mutationFn: (user: SeAdminUser) => unlockSeAdminUser(user.seAdminUserId),
    onMutate: () => setActionMessage(''),
    onSuccess: (_data, user) => {
      setActionMessage(`${user.email} のロックを解除しました`)
      invalidateList()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (user: SeAdminUser) => deleteSeAdminUser(user.seAdminUserId),
    onMutate: () => setActionMessage(''),
    onSuccess: (_data, user) => {
      setActionMessage(`${user.email} を削除しました`)
      setDeleteTarget(null)
      // 削除により現在ページが空になる場合は前ページへ戻す。
      const items = listQuery.data?.data ?? []
      if (items.length === 1 && page > 1) {
        setPage((p) => p - 1)
      } else {
        invalidateList()
      }
    },
  })

  const items = listQuery.data?.data ?? []
  const pagination = listQuery.data?.pagination ?? null
  const currentUserId = sessionQuery.data?.seAdminUserId ?? null
  const actionLoading = unlockMutation.isPending || deleteMutation.isPending

  const errorMessage =
    (listQuery.isError ? '一覧の取得に失敗しました' : '') ||
    unlockMutation.error?.message ||
    deleteMutation.error?.message ||
    ''

  const handleSearch = () => {
    setActionMessage('')
    setPage(1)
    setKeyword(searchInput.trim())
  }

  const handleSortChange = (value: string) => {
    setPage(1)
    setSort(value)
  }

  const handleRequestDelete = (user: SeAdminUser) => {
    setActionMessage('')
    unlockMutation.reset()
    deleteMutation.reset()
    setDeleteTarget(user)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">SE管理者アカウント</h2>

      {errorMessage && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div>
      )}
      {actionMessage && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{actionMessage}</div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <AccountsToolbar
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          onSearch={handleSearch}
          sort={sort}
          onSortChange={handleSortChange}
        />

        <SeAdminUserTable
          items={items}
          loading={listQuery.isLoading}
          currentUserId={currentUserId}
          actionLoading={actionLoading}
          onUnlock={(user) => unlockMutation.mutate(user)}
          onRequestDelete={handleRequestDelete}
        />

        {pagination && pagination.total > 0 && (
          <PaginationControls
            pagination={pagination}
            loading={listQuery.isFetching}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        )}
      </section>

      {deleteTarget && (
        <DeleteConfirmDialog
          email={deleteTarget.email}
          loading={deleteMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget)}
        />
      )}
    </div>
  )
}
