import { describe, it, expect } from 'vitest'
import { buildSeAdminAccountIssuedEmail, buildShopAccountIssuedEmail } from './templates'

describe('buildShopAccountIssuedEmail', () => {
  it('includes the email, temporary password, and login URL in the body', () => {
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

describe('buildSeAdminAccountIssuedEmail', () => {
  it('includes the email, initial password, and login URL in the body', () => {
    const { subject, text } = buildSeAdminAccountIssuedEmail({
      email: 'admin@example.com',
      temporaryPassword: 'initial-pass-123',
      loginUrl: 'https://example.com/admin/login',
    })

    expect(subject).toContain('SE管理者アカウント発行')
    expect(text).toContain('admin@example.com')
    expect(text).toContain('initial-pass-123')
    expect(text).toContain('https://example.com/admin/login')
    expect(text).toContain('パスワードの変更が必要')
  })
})
