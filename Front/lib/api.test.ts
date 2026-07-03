import { describe, it, expect, vi } from 'vitest'

vi.mock('hono/client', () => ({
  hc: vi.fn((url: string) => {
    void url
    return { api: { menu: {} } }
  }),
}))

const { apiClient } = await import('./api')

describe('apiClient', () => {
  it('is defined and has the expected structure', () => {
    expect(apiClient).toBeDefined()
    expect(apiClient.api).toBeDefined()
    expect(apiClient.api.menu).toBeDefined()
  })

  it('uses the default API URL when NEXT_PUBLIC_API_URL is not set', async () => {
    const { hc } = await import('hono/client')
    expect(hc).toHaveBeenCalledWith('http://localhost:8787')
  })
})
