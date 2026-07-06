'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createShopAccount, type CreateShopAccountInput } from '@/lib/repositories/shop-accounts'

export function useNewCustomer() {
  const router = useRouter()

  const createMutation = useMutation({
    mutationFn: (input: CreateShopAccountInput) => createShopAccount(input),
    onSuccess: (data) => {
      router.push(`/admin/customers/complete?shopAccountId=${data.shopAccount.shopAccountId}`)
    },
  })

  const submit = (values: CreateShopAccountInput) => createMutation.mutate(values)

  return {
    submitting: createMutation.isPending,
    error: createMutation.isError ? createMutation.error.message : null,
    submit,
  }
}
