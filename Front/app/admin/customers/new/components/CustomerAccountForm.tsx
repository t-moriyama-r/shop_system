'use client'

import type { CreateShopAccountInput } from '@/lib/repositories/shop-accounts'

type Props = {
  values: CreateShopAccountInput
  errors: CustomerFormErrors
  submitting: boolean
  onChange: (field: keyof CreateShopAccountInput, value: string) => void
  onSubmit: () => void
}

export function CustomerAccountForm({ values, errors, submitting, onChange, onSubmit }: Props) {
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      noValidate
    >
      {FIELDS.map((field) => (
        <FormField
          key={field.name}
          field={field}
          value={values[field.name]}
          error={errors[field.name]}
          onChange={(value) => onChange(field.name, value)}
        />
      ))}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? '発行中...' : '発行する'}
        </button>
      </div>
    </form>
  )
}

type FormFieldProps = {
  field: FieldDef
  value: string
  error?: string
  onChange: (value: string) => void
}

function FormField({ field, value, error, onChange }: FormFieldProps) {
  const inputId = `customer-${field.name}`
  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-gray-700">
        {field.label}
        <span className="ml-1 text-red-600">*</span>
      </label>
      <input
        id={inputId}
        type={field.type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
        }`}
      />
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export type CustomerFormErrors = Partial<Record<keyof CreateShopAccountInput, string>>

type FieldDef = {
  name: keyof CreateShopAccountInput
  label: string
  type: 'text' | 'email'
  placeholder: string
}

const FIELDS: FieldDef[] = [
  { name: 'shopName', label: 'ショップ名', type: 'text', placeholder: '例）サンプル商店' },
  { name: 'contactName', label: '担当者名', type: 'text', placeholder: '例）山田 太郎' },
  { name: 'email', label: 'メールアドレス', type: 'email', placeholder: '例）owner@example.com' },
]

const MAX_FIELD_LENGTH = 255
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// サーバ（Backend/handlers/shop-accounts.ts）と同じ基準でクライアント側でも検証し、
// バリデーションエラーをインライン表示する。戻り値が空なら妥当。
export function validateCustomerForm(values: CreateShopAccountInput): CustomerFormErrors {
  const errors: CustomerFormErrors = {}

  const shopName = values.shopName.trim()
  if (!shopName) errors.shopName = 'ショップ名は必須です'
  else if (shopName.length > MAX_FIELD_LENGTH)
    errors.shopName = `ショップ名は${MAX_FIELD_LENGTH}文字以内で指定してください`

  const contactName = values.contactName.trim()
  if (!contactName) errors.contactName = '担当者名は必須です'
  else if (contactName.length > MAX_FIELD_LENGTH)
    errors.contactName = `担当者名は${MAX_FIELD_LENGTH}文字以内で指定してください`

  const email = values.email.trim()
  if (!email) errors.email = 'メールアドレスは必須です'
  else if (email.length > MAX_FIELD_LENGTH)
    errors.email = `メールアドレスは${MAX_FIELD_LENGTH}文字以内で指定してください`
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'メールアドレスの形式が正しくありません'

  return errors
}
