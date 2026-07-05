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
}))

const { app } = await import('./app')

describe('GET /api/health', () => {
  it('returns { status: "ok" }', async () => {
    const res = await app.request('/api/health')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

describe('GET /api/menu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns mapped menu items from the database', async () => {
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

  it('returns an empty array when there are no menu items', async () => {
    mockFrom.mockResolvedValue([])

    const res = await app.request('/api/menu')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('strips extra fields from DB rows (only id, name, price)', async () => {
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
  it('returns 404 for unregistered paths', async () => {
    const res = await app.request('/api/unknown')

    expect(res.status).toBe(404)
  })
})
