import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockReturning = vi.fn()
const mockWhere = vi.fn((_condition: unknown) => ({ returning: mockReturning }))
const mockDelete = vi.fn((_table: unknown) => ({ where: mockWhere }))

vi.mock('./client', () => ({
  db: { delete: mockDelete },
}))

const { deleteExpiredSessions } = await import('./sessions')
const { sessions } = await import('./schema')

describe('deleteExpiredSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReturning.mockResolvedValue([])
  })

  it('deletes expired sessions and returns the number of deleted rows', async () => {
    mockReturning.mockResolvedValue([{ sessionId: 'a' }, { sessionId: 'b' }])

    const now = new Date('2026-07-04T00:00:00Z')
    const count = await deleteExpiredSessions(now)

    expect(count).toBe(2)
    expect(mockDelete).toHaveBeenCalledWith(sessions)
    expect(mockWhere).toHaveBeenCalledTimes(1)
    expect(mockReturning).toHaveBeenCalledTimes(1)
  })

  it('returns 0 when no sessions are expired', async () => {
    mockReturning.mockResolvedValue([])

    const count = await deleteExpiredSessions()

    expect(count).toBe(0)
  })
})
