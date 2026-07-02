'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'

type MenuItem = { id: string; name: string; price: number }

export function OrderMenu() {
  const [menu, setMenu] = useState<MenuItem[]>([])

  useEffect(() => {
    apiClient.api.menu
      .$get()
      .then((res) => res.json())
      .then(setMenu)
  }, [])

  return (
    <ul>
      {menu.map((item) => (
        <li key={item.id}>
          {item.name} - ¥{item.price}
        </li>
      ))}
    </ul>
  )
}
