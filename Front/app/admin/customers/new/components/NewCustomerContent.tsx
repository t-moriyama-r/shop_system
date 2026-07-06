'use client'

import { CustomerAccountForm } from './CustomerAccountForm'
import { useNewCustomer } from './useNewCustomer'

export function NewCustomerContent() {
  const { submitting, error, submit } = useNewCustomer()

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">顧客アカウント発行</h2>

      <section className="max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {error && <div className="mb-5 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <CustomerAccountForm submitting={submitting} onSubmit={submit} />
      </section>
    </div>
  )
}
