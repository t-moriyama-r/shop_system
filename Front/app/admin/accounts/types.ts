export interface SeAdminUser {
  seAdminUserId: string
  email: string
  isLocked: boolean
  failedLoginCount: number
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}
