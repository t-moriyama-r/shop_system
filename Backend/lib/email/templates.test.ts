import { describe, it, expect } from 'vitest'
import { buildShopAccountIssuedEmail } from './templates'

describe('buildShopAccountIssuedEmail', () => {
  it('本文にメールアドレス・仮パスワード・ログインURLが含まれる', () => {
    const { subject, text } = buildShopAccountIssuedEmail({
      shopName: 'テストショップ',
      contactName: '山田太郎',
      email: 'shop@example.com',
      temporaryPassword: 'temp-pass-123',
      loginUrl: 'https://example.com/',
    })

    expect(subject).toContain('アカウント発行')
    expect(text).toContain('テストショップ')
    expect(text).toContain('山田太郎')
    expect(text).toContain('shop@example.com')
    expect(text).toContain('temp-pass-123')
    expect(text).toContain('https://example.com/')
  })
})
