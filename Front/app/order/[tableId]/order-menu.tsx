'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'

type MenuItem = { id: string; name: string; price: number }

export function OrderMenu() {
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiClient.api.menu
      .$get()
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch menu: ${res.status} ${res.statusText}`)
        }
        return res.json()
      })
      .then(setMenu)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'メニューの取得に失敗しました'
        console.error('Failed to fetch menu:', err)
        setError(message)
      })
  }, [])

  if (error) {
    return <p role="alert">{error}</p>
  }

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
