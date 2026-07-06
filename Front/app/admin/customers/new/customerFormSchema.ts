import { z } from 'zod'

const MAX_FIELD_LENGTH = 255
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const customerFormSchema = z.object({
  shopName: z
    .string()
    .trim()
    .min(1, 'ショップ名は必須です')
    .max(MAX_FIELD_LENGTH, `ショップ名は${MAX_FIELD_LENGTH}文字以内で指定してください`),
  contactName: z
    .string()
    .trim()
    .min(1, '担当者名は必須です')
    .max(MAX_FIELD_LENGTH, `担当者名は${MAX_FIELD_LENGTH}文字以内で指定してください`),
  email: z
    .string()
    .trim()
    .min(1, 'メールアドレスは必須です')
    .max(MAX_FIELD_LENGTH, `メールアドレスは${MAX_FIELD_LENGTH}文字以内で指定してください`)
    .regex(EMAIL_PATTERN, 'メールアドレスの形式が正しくありません'),
})

export type CustomerFormValues = z.infer<typeof customerFormSchema>
