'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { TextField } from '@/components/form/TextField'
import { customerFormSchema, type CustomerFormValues } from '../customerFormSchema'

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
        <TextField
          key={field.name}
          id={`customer-${field.name}`}
          label={field.label}
          type={field.type}
          placeholder={field.placeholder}
          required
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
