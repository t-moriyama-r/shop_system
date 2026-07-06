'use client'

import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import {
  createShopAccount,
  type CreateShopAccountInput,
  type ShopAccount,
} from '@/lib/repositories/shop-accounts'

export function useNewCustomer() {
  const [created, setCreated] = useState<ShopAccount | null>(null)

  const createMutation = useMutation({
    mutationFn: (input: CreateShopAccountInput) => createShopAccount(input),
    onSuccess: (data) => setCreated(data.shopAccount),
  })

  const submit = (values: CreateShopAccountInput) => createMutation.mutate(values)

  const issueAnother = () => {
    setCreated(null)
    createMutation.reset()
  }

  return {
    created,
    submitting: createMutation.isPending,
    error: createMutation.isError ? createMutation.error.message : null,
    submit,
    issueAnother,
  }
}
