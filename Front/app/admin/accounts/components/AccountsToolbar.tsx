'use client'

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: '作成日時（新しい順）' },
  { value: 'createdAt:asc', label: '作成日時（古い順）' },
  { value: 'email:asc', label: 'メールアドレス（昇順）' },
  { value: 'email:desc', label: 'メールアドレス（降順）' },
  { value: 'lastLoginAt:desc', label: '最終ログイン（新しい順）' },
]

export function AccountsToolbar({
  searchInput,
  onSearchInputChange,
  onSearch,
  sort,
  onSortChange,
}: {
  searchInput: string
  onSearchInputChange: (value: string) => void
  onSearch: () => void
  sort: string
  onSortChange: (value: string) => void
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="flex flex-1 items-center gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearch()
          }}
          placeholder="メールアドレスで検索"
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={onSearch}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          検索
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600">
        並び順
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
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
  )
}
