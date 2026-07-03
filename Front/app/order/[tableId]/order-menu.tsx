'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import { MenuItemList } from '@/components/menu-item-list'
import type { MenuItem } from '@/lib/types'

export function OrderMenu() {
  const [menu, setMenu] = useState<MenuItem[]>([])

  useEffect(() => {
    apiClient.api.menu
      .$get()
      .then((res) => res.json())
      .then(setMenu)
  }, [])

  return <MenuItemList items={menu} />
}
