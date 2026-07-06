'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type UseFormRegisterReturn } from 'react-hook-form'
import { z } from 'zod'

type Props = {
  submitting: boolean
  onSubmit: (values: CustomerFormValues) => void
}

export function CustomerAccountForm({ submitting, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: { shopName: '', contactName: '', email: '' },
    mode: 'onBlur',
  })

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      {FIELDS.map((field) => (
        <FormField
          key={field.name}
          field={field}
          registration={register(field.name)}
          error={errors[field.name]?.message}
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
  registration: UseFormRegisterReturn
  error?: string
}

function FormField({ field, registration, error }: FormFieldProps) {
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
        placeholder={field.placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
        }`}
        {...registration}
      />
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

const MAX_FIELD_LENGTH = 255
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// サーバ（Backend/handlers/shop-accounts.ts）と同じ基準でクライアント側も検証する。
// trim 済みの値がそのまま onSubmit に渡るため、送信前の整形も本スキーマに集約する。
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

type FieldDef = {
  name: keyof CustomerFormValues
  label: string
  type: 'text' | 'email'
  placeholder: string
}

const FIELDS: FieldDef[] = [
  { name: 'shopName', label: 'ショップ名', type: 'text', placeholder: '例）サンプル商店' },
  { name: 'contactName', label: '担当者名', type: 'text', placeholder: '例）山田 太郎' },
  { name: 'email', label: 'メールアドレス', type: 'email', placeholder: '例）owner@example.com' },
]
