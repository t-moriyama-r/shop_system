'use client'

interface AdminHeaderProps {
  email?: string
  onLogout?: () => void
  showNav?: boolean
}

export function AdminHeader({ email, onLogout, showNav = true }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-gray-800">SE管理画面</h1>
      </div>
      {showNav && email && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{email}</span>
          <button
            onClick={onLogout}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            ログアウト
          </button>
        </div>
      )}
    </header>
  )
}
