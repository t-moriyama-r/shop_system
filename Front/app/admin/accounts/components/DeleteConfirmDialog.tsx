'use client'

type Props = {
  email: string
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteConfirmDialog({ email, loading, onCancel, onConfirm }: Props) {
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
