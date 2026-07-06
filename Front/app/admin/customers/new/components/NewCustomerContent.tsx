'use client'

import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import {
  createShopAccount,
  type CreateShopAccountInput,
  type ShopAccount,
} from '@/lib/repositories/shop-accounts'
import { CustomerAccountForm, validateCustomerForm, type CustomerFormErrors } from './CustomerAccountForm'
import { IssueCompletePanel } from './IssueCompletePanel'

const EMPTY_FORM: CreateShopAccountInput = { shopName: '', contactName: '', email: '' }

export function NewCustomerContent() {
  const [values, setValues] = useState<CreateShopAccountInput>(EMPTY_FORM)
  const [errors, setErrors] = useState<CustomerFormErrors>({})
  const [created, setCreated] = useState<ShopAccount | null>(null)

  const createMutation = useMutation({
    mutationFn: (input: CreateShopAccountInput) => createShopAccount(input),
    onSuccess: (data) => setCreated(data.shopAccount),
  })

  const handleChange = (field: keyof CreateShopAccountInput, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    // 入力中に該当フィールドのエラーを消し、リアルタイムに解消状態を反映する。
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  const handleSubmit = () => {
    const validationErrors = validateCustomerForm(values)
    if (Object.values(validationErrors).some(Boolean)) {
      setErrors(validationErrors)
      return
    }
    setErrors({})
    createMutation.mutate({
      shopName: values.shopName.trim(),
      contactName: values.contactName.trim(),
      email: values.email.trim(),
    })
  }

  const handleIssueAnother = () => {
    setValues(EMPTY_FORM)
    setErrors({})
    setCreated(null)
    createMutation.reset()
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">顧客アカウント発行</h2>

      <section className="max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {created ? (
          <IssueCompletePanel account={created} onIssueAnother={handleIssueAnother} />
        ) : (
          <>
            {createMutation.isError && (
              <div className="mb-5 rounded-md bg-red-50 p-3 text-sm text-red-700">
                {createMutation.error.message}
              </div>
            )}
            <CustomerAccountForm
              values={values}
              errors={errors}
              submitting={createMutation.isPending}
              onChange={handleChange}
              onSubmit={handleSubmit}
            />
          </>
        )}
      </section>
    </div>
  )
}
