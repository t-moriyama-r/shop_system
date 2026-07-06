import { describe, it, expect, vi, afterEach } from 'vitest'
import { createShopAccount } from './shop-accounts'

const input = { shopName: 'サンプル商店', contactName: '山田 太郎', email: 'owner@example.com' }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createShopAccount', () => {
  it('POSTs the payload with credentials and returns the created account', async () => {
    const account = { shopAccountId: 'a1', ...input, accountStatus: 'active' }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'ショップアカウントを発行しました', shopAccount: account }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await createShopAccount(input)

    expect(result.shopAccount).toEqual(account)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/shop-accounts')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(JSON.parse(init.body)).toEqual(input)
  })

  it('throws the server-provided error message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'このメールアドレスは既に登録されています' }),
      }),
    )

    await expect(createShopAccount(input)).rejects.toThrow('このメールアドレスは既に登録されています')
  })
})
