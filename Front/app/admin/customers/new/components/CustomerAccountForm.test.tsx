import { describe, it, expect } from 'vitest'
import { customerFormSchema } from './CustomerAccountForm'

function errorFor(input: unknown, field: string): string | undefined {
  const result = customerFormSchema.safeParse(input)
  if (result.success) return undefined
  return result.error.issues.find((issue) => issue.path[0] === field)?.message
}

describe('customerFormSchema', () => {
  const valid = {
    shopName: 'サンプル商店',
    contactName: '山田 太郎',
    email: 'owner@example.com',
  }

  it('accepts valid input and trims the values', () => {
    const result = customerFormSchema.safeParse({
      shopName: '  サンプル商店  ',
      contactName: ' 山田 太郎 ',
      email: '  owner@example.com ',
    })
    expect(result.success).toBe(true)
    expect(result.data).toEqual(valid)
  })

  it('flags empty required fields', () => {
    expect(errorFor({ shopName: '  ', contactName: '', email: '' }, 'shopName')).toBe(
      'ショップ名は必須です',
    )
    expect(errorFor({ shopName: '  ', contactName: '', email: '' }, 'contactName')).toBe(
      '担当者名は必須です',
    )
    expect(errorFor({ shopName: '  ', contactName: '', email: '' }, 'email')).toBe(
      'メールアドレスは必須です',
    )
  })

  it('flags malformed email', () => {
    expect(errorFor({ ...valid, email: 'not-an-email' }, 'email')).toBe(
      'メールアドレスの形式が正しくありません',
    )
  })

  it('flags fields exceeding the max length', () => {
    const long = 'a'.repeat(256)
    expect(errorFor({ ...valid, shopName: long }, 'shopName')).toContain('255文字以内')
    expect(errorFor({ ...valid, contactName: long }, 'contactName')).toContain('255文字以内')
    expect(errorFor({ ...valid, email: `${long}@x.com` }, 'email')).toContain('255文字以内')
  })
})
