'use client'

import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import {
  createShopAccount,
  type CreateShopAccountInput,
  type ShopAccount,
} from '@/lib/repositories/shop-accounts'
import { CustomerAccountForm, type CustomerFormValues } from './CustomerAccountForm'
import { IssueCompletePanel } from './IssueCompletePanel'

export function NewCustomerContent() {
  const [created, setCreated] = useState<ShopAccount | null>(null)

  const createMutation = useMutation({
    mutationFn: (input: CreateShopAccountInput) => createShopAccount(input),
    onSuccess: (data) => setCreated(data.shopAccount),
  })

  // customerFormSchema により trim 済みの値が渡るため、そのまま API 入力に用いる。
  const handleSubmit = (values: CustomerFormValues) => createMutation.mutate(values)

  const handleIssueAnother = () => {
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
            <CustomerAccountForm submitting={createMutation.isPending} onSubmit={handleSubmit} />
          </>
        )}
      </section>
    </div>
  )
}
