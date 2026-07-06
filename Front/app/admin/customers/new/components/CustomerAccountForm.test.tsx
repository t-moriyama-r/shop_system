import { describe, it, expect } from 'vitest'
import { validateCustomerForm } from './CustomerAccountForm'

describe('validateCustomerForm', () => {
  const valid = {
    shopName: 'サンプル商店',
    contactName: '山田 太郎',
    email: 'owner@example.com',
  }

  it('returns no errors for valid input', () => {
    expect(validateCustomerForm(valid)).toEqual({})
  })

  it('flags empty required fields', () => {
    const errors = validateCustomerForm({ shopName: '  ', contactName: '', email: '' })
    expect(errors.shopName).toBe('ショップ名は必須です')
    expect(errors.contactName).toBe('担当者名は必須です')
    expect(errors.email).toBe('メールアドレスは必須です')
  })

  it('flags malformed email', () => {
    const errors = validateCustomerForm({ ...valid, email: 'not-an-email' })
    expect(errors.email).toBe('メールアドレスの形式が正しくありません')
  })

  it('flags fields exceeding the max length', () => {
    const long = 'a'.repeat(256)
    const errors = validateCustomerForm({ shopName: long, contactName: long, email: `${long}@x.com` })
    expect(errors.shopName).toContain('255文字以内')
    expect(errors.contactName).toContain('255文字以内')
    expect(errors.email).toContain('255文字以内')
  })
})
