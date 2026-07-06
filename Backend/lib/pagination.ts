// ページネーションのクエリパラメータ（文字列）を検証し、正の整数に変換する。
// 不正・未指定の場合は fallback を、max 指定時はその上限で丸める。
export function parsePositiveInt(value: string | undefined, fallback: number, max?: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }
  return max ? Math.min(parsed, max) : parsed
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function buildPagination(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) }
}
