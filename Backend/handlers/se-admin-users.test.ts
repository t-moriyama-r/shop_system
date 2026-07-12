import { describe, it, expect, vi, beforeEach } from 'vitest'

const listSeAdminUsers = vi.fn()
const findActiveSeAdminById = vi.fn()
const softDeleteSeAdminUser = vi.fn()
const setSeAdminLock = vi.fn()

vi.mock('db/se-admin', () => ({
  listSeAdminUsers: (...a: unknown[]) => listSeAdminUsers(...a),
  findActiveSeAdminById: (...a: unknown[]) => findActiveSeAdminById(...a),
  softDeleteSeAdminUser: (...a: unknown[]) => softDeleteSeAdminUser(...a),
  setSeAdminLock: (...a: unknown[]) => setSeAdminLock(...a),
}))

const recordAuditLog = vi.fn()
vi.mock('../lib/audit-log', () => ({ recordAuditLog: (...a: unknown[]) => recordAuditLog(...a) }))

const { listSeAdminUsersHandler, deleteSeAdminUserHandler, setSeAdminLockHandler } = await import(
  './se-admin-users'
)

const operator = { seAdminUserId: 'operator-1', email: 'op@example.com', mustChangePassword: false }
const meta = { ipAddress: null, userAgent: null }

beforeEach(() => {
  vi.clearAllMocks()
  softDeleteSeAdminUser.mockResolvedValue(0)
  setSeAdminLock.mockResolvedValue(undefined)
})

describe('listSeAdminUsersHandler', () => {
  it('ページネーション情報付きで200を返す', async () => {
    listSeAdminUsers.mockResolvedValue({ rows: [{ seAdminUserId: 'u1' }], total: 25 })
    const r = await listSeAdminUsersHandler({ page: '1', limit: '20' })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ pagination: { page: 1, limit: 20, total: 25, totalPages: 2 } })
    expect(listSeAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }))
  })

  it('isLockedフィルタを真偽値にパースする', async () => {
    listSeAdminUsers.mockResolvedValue({ rows: [], total: 0 })
    await listSeAdminUsersHandler({ isLocked: 'true' })
    expect(listSeAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ isLocked: true }))
  })

  it('limitを上限値(100)に制限する', async () => {
    listSeAdminUsers.mockResolvedValue({ rows: [], total: 0 })
    const r = await listSeAdminUsersHandler({ limit: '500' })
    expect(r.body).toMatchObject({ pagination: { limit: 100 } })
  })
})

describe('deleteSeAdminUserHandler', () => {
  it('自分自身のアカウント削除は403で拒否する', async () => {
    const r = await deleteSeAdminUserHandler({ targetId: 'operator-1', operator, meta })
    expect(r.status).toBe(403)
    expect(findActiveSeAdminById).not.toHaveBeenCalled()
    expect(recordAuditLog).not.toHaveBeenCalled()
  })

  it('対象が存在しない場合は404を返す', async () => {
    findActiveSeAdminById.mockResolvedValue(undefined)
    const r = await deleteSeAdminUserHandler({ targetId: 'missing', operator, meta })
    expect(r.status).toBe(404)
    expect(softDeleteSeAdminUser).not.toHaveBeenCalled()
  })

  it('対象を論理削除し、監査ログを記録する', async () => {
    findActiveSeAdminById.mockResolvedValue({ seAdminUserId: 'u2', email: 'b@example.com' })
    const r = await deleteSeAdminUserHandler({ targetId: 'u2', operator, meta })
    expect(r.status).toBe(200)
    expect(softDeleteSeAdminUser).toHaveBeenCalledWith('u2')
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'SE_ADMIN_DELETE', targetId: 'u2', result: 'SUCCESS' }),
    )
  })
})

describe('setSeAdminLockHandler', () => {
  it('isLockedが真偽値でない場合は400を返す', async () => {
    const r = await setSeAdminLockHandler({ targetId: 'u2', operator, isLocked: undefined, meta })
    expect(r.status).toBe(400)
    expect(findActiveSeAdminById).not.toHaveBeenCalled()
  })

  it('対象が存在しない場合は404を返す', async () => {
    findActiveSeAdminById.mockResolvedValue(undefined)
    const r = await setSeAdminLockHandler({ targetId: 'missing', operator, isLocked: false, meta })
    expect(r.status).toBe(404)
  })

  it('アカウントのロックを解除し、ACCOUNT_UNLOCKを記録する', async () => {
    findActiveSeAdminById.mockResolvedValue({ seAdminUserId: 'u2', email: 'b@example.com', isLocked: true })
    const r = await setSeAdminLockHandler({ targetId: 'u2', operator, isLocked: false, meta })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ isLocked: false })
    expect(setSeAdminLock).toHaveBeenCalledWith('u2', false)
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'ACCOUNT_UNLOCK', targetId: 'u2' }),
    )
  })

  it('アカウントをロックし、ACCOUNT_LOCKを記録する', async () => {
    findActiveSeAdminById.mockResolvedValue({ seAdminUserId: 'u2', email: 'b@example.com', isLocked: false })
    const r = await setSeAdminLockHandler({ targetId: 'u2', operator, isLocked: true, meta })
    expect(r.status).toBe(200)
    expect(setSeAdminLock).toHaveBeenCalledWith('u2', true)
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'ACCOUNT_LOCK', targetId: 'u2' }),
    )
  })
})
