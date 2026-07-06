'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { shopAccountQuery, type ShopAccountDetail } from '@/lib/repositories/shop-accounts'

export function useCustomerComplete(): {
  shopAccountId: string
  account: ShopAccountDetail | null
  loading: boolean
  error: boolean
} {
  const router = useRouter()
  const searchParams = useSearchParams()
  const shopAccountId = searchParams.get('shopAccountId') ?? ''

  useEffect(() => {
    if (!shopAccountId) router.replace('/admin/dashboard')
  }, [shopAccountId, router])

  const query = useQuery(shopAccountQuery(shopAccountId))

  return {
    shopAccountId,
    account: query.data ?? null,
    loading: query.isPending,
    error: query.isError,
  }
}
