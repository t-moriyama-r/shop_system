import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('db', () => ({
  db: {
    select: () => {
      mockSelect()
      return { from: mockFrom }
    },
  },
}))

vi.mock('db/schema', () => ({
  menuItems: Symbol('menuItems'),
  seAdminUsers: {
    seAdminUserId: 'se_admin_user_id',
    email: 'email',
    isLocked: 'is_locked',
    failedLoginCount: 'failed_login_count',
    lastLoginAt: 'last_login_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    isDeleted: 'is_deleted',
  },
  sessions: { sessionId: 'session_id', seAdminUserId: 'se_admin_user_id' },
  auditLogs: {},
  shopAccounts: {},
  emailNotificationLogs: {},
}))

// 認証系ルート/ミドルウェアが実 DB クライアントを読み込まないようスタブする。
vi.mock('db/se-admin', () => ({}))
vi.mock('db/sessions', () => ({}))
vi.mock('db/audit-logs', () => ({}))

const { app } = await import('./app')

describe('GET /api/health', () => {
  it('{ status: "ok" } を返す', async () => {
    const res = await app.request('/api/health')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

describe('GET /api/menu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('DBから取得したメニュー項目をマッピングして返す', async () => {
    const dbRows = [
      { menuItemId: 'uuid-1', name: 'コーヒー', price: 400, createdAt: new Date(), updatedAt: new Date() },
      { menuItemId: 'uuid-2', name: 'カフェラテ', price: 480, createdAt: new Date(), updatedAt: new Date() },
    ]
    mockFrom.mockResolvedValue(dbRows)

    const res = await app.request('/api/menu')

    expect(res.status).toBe(200)
    expect(mockSelect).toHaveBeenCalled()
    expect(await res.json()).toEqual([
      { id: 'uuid-1', name: 'コーヒー', price: 400 },
      { id: 'uuid-2', name: 'カフェラテ', price: 480 },
    ])
  })

  it('メニュー項目が存在しない場合は空配列を返す', async () => {
    mockFrom.mockResolvedValue([])

    const res = await app.request('/api/menu')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('DBの行から余分なフィールドを除去する（id, name, priceのみ）', async () => {
    const dbRows = [
      { menuItemId: 'uuid-3', name: 'チーズケーキ', price: 550, createdAt: new Date(), updatedAt: new Date() },
    ]
    mockFrom.mockResolvedValue(dbRows)

    const res = await app.request('/api/menu')
    const body = await res.json()

    expect(body).toHaveLength(1)
    expect(Object.keys(body[0])).toEqual(['id', 'name', 'price'])
  })
})

describe('unknown routes', () => {
  it('未登録のパスの場合は404を返す', async () => {
    const res = await app.request('/api/unknown')

    expect(res.status).toBe(404)
  })
})
