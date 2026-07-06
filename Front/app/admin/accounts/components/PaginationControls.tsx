'use client'

import type { Pagination } from '@/lib/repositories/se-admin-users'

export function PaginationControls({
  pagination,
  loading,
  onPrev,
  onNext,
}: {
  pagination: Pagination
  loading: boolean
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
      <span>
        全 {pagination.total} 件中 {(pagination.page - 1) * pagination.limit + 1}–
        {Math.min(pagination.page * pagination.limit, pagination.total)} 件
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
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
          onClick={onNext}
          disabled={pagination.page >= pagination.totalPages || loading}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
        >
          次へ
        </button>
      </div>
    </div>
  )
}
