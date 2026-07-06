import { describe, it, expect, vi, beforeEach } from 'vitest'

const getDashboardSummary = vi.fn()
const listShopAccountActivities = vi.fn()

vi.mock('db/dashboard', () => ({
  getDashboardSummary: (...a: unknown[]) => getDashboardSummary(...a),
  listShopAccountActivities: (...a: unknown[]) => listShopAccountActivities(...a),
}))

const { getDashboardSummaryHandler, listShopAccountActivitiesHandler } = await import('./dashboard')

beforeEach(() => {
  vi.clearAllMocks()
  getDashboardSummary.mockResolvedValue({
    shopAccounts: { total: 0, active: 0, pending: 0, suspended: 0 },
    seAdmins: { total: 0 },
  })
  listShopAccountActivities.mockResolvedValue([])
})

describe('getDashboardSummaryHandler', () => {
  it('returns systemStatus, the summary, and generatedAt', async () => {
    getDashboardSummary.mockResolvedValue({
      shopAccounts: { total: 4, active: 2, pending: 1, suspended: 1 },
      seAdmins: { total: 2 },
    })
    const r = await getDashboardSummaryHandler()
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({
      systemStatus: 'ok',
      shopAccounts: { total: 4, active: 2, pending: 1, suspended: 1 },
      seAdmins: { total: 2 },
    })
    expect(typeof r.body.generatedAt).toBe('string')
  })
})

describe('listShopAccountActivitiesHandler', () => {
  it('defaults the limit to 10', async () => {
    const r = await listShopAccountActivitiesHandler({})
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ limit: 10 })
    expect(listShopAccountActivities).toHaveBeenCalledWith(10)
  })

  it('honors a valid limit and caps it at 100', async () => {
    await listShopAccountActivitiesHandler({ limit: '25' })
    expect(listShopAccountActivities).toHaveBeenLastCalledWith(25)
    await listShopAccountActivitiesHandler({ limit: '999' })
    expect(listShopAccountActivities).toHaveBeenLastCalledWith(100)
  })

  it('falls back to the default for invalid limits', async () => {
    await listShopAccountActivitiesHandler({ limit: 'abc' })
    expect(listShopAccountActivities).toHaveBeenLastCalledWith(10)
  })

  it('returns the activity rows', async () => {
    listShopAccountActivities.mockResolvedValue([{ shopAccountId: 's1', latestNotification: null }])
    const r = await listShopAccountActivitiesHandler({ limit: '10' })
    expect(r.body).toMatchObject({ data: [{ shopAccountId: 's1' }] })
  })
})
