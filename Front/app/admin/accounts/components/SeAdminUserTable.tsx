'use client'

import type { SeAdminUser } from '@/lib/repositories/se-admin-users'
import { LoadingIndicator } from '../../components/LoadingIndicator'

type Props = {
  items: SeAdminUser[]
  loading: boolean
  currentUserId: string | null
  actionLoading: boolean
  onUnlock: (user: SeAdminUser) => void
  onRequestDelete: (user: SeAdminUser) => void
}

export function SeAdminUserTable({
  items,
  loading,
  currentUserId,
  actionLoading,
  onUnlock,
  onRequestDelete,
}: Props) {
  return (
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
          <TableBody
            items={items}
            loading={loading}
            currentUserId={currentUserId}
            actionLoading={actionLoading}
            onUnlock={onUnlock}
            onRequestDelete={onRequestDelete}
          />
        </tbody>
      </table>
    </div>
  )
}

function TableBody({ items, loading, currentUserId, actionLoading, onUnlock, onRequestDelete }: Props) {
  if (loading) return <EmptyRow message={<LoadingIndicator />} />
  if (items.length === 0) return <EmptyRow message="該当するSE管理者アカウントはありません" />
  return (
    <>
      {items.map((user) => (
        <SeAdminUserRow
          key={user.seAdminUserId}
          user={user}
          isSelf={user.seAdminUserId === currentUserId}
          actionLoading={actionLoading}
          onUnlock={onUnlock}
          onRequestDelete={onRequestDelete}
        />
      ))}
    </>
  )
}

type EmptyRowProps = {
  message: React.ReactNode
}

function EmptyRow({ message }: EmptyRowProps) {
  return (
    <tr>
      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
        {message}
      </td>
    </tr>
  )
}

type SeAdminUserRowProps = {
  user: SeAdminUser
  isSelf: boolean
  actionLoading: boolean
  onUnlock: (user: SeAdminUser) => void
  onRequestDelete: (user: SeAdminUser) => void
}

function SeAdminUserRow({ user, isSelf, actionLoading, onUnlock, onRequestDelete }: SeAdminUserRowProps) {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-4 py-3 text-gray-800">
        {user.email}
        {isSelf && (
          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">自分</span>
        )}
      </td>
      <td className="px-4 py-3">
        <LockStatusBadge locked={user.isLocked} />
      </td>
      <td className="px-4 py-3 text-gray-600">{user.failedLoginCount}</td>
      <td className="px-4 py-3 text-gray-600">{formatDateTime(user.lastLoginAt)}</td>
      <td className="px-4 py-3 text-gray-600">{formatDateTime(user.createdAt)}</td>
      <td className="px-4 py-3">
        <RowActions
          user={user}
          isSelf={isSelf}
          actionLoading={actionLoading}
          onUnlock={onUnlock}
          onRequestDelete={onRequestDelete}
        />
      </td>
    </tr>
  )
}

type LockStatusBadgeProps = {
  locked: boolean
}

function LockStatusBadge({ locked }: LockStatusBadgeProps) {
  if (locked) {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        ロック中
      </span>
    )
  }
  return (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
      有効
    </span>
  )
}

type RowActionsProps = {
  user: SeAdminUser
  isSelf: boolean
  actionLoading: boolean
  onUnlock: (user: SeAdminUser) => void
  onRequestDelete: (user: SeAdminUser) => void
}

function RowActions({ user, isSelf, actionLoading, onUnlock, onRequestDelete }: RowActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      {user.isLocked && (
        <button
          type="button"
          onClick={() => onUnlock(user)}
          disabled={actionLoading}
          className="rounded-md border border-blue-600 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ロック解除
        </button>
      )}
      <button
        type="button"
        onClick={() => onRequestDelete(user)}
        disabled={isSelf || actionLoading}
        title={isSelf ? '自分自身のアカウントは削除できません' : undefined}
        className="rounded-md border border-red-600 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        削除
      </button>
    </div>
  )
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('ja-JP', { hour12: false })
}
