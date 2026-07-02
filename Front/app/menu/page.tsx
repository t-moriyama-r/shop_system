import { cacheLife, cacheTag } from 'next/cache'
import { apiClient } from '@/lib/api'

async function getMenu() {
  'use cache'
  cacheLife('minutes')
  cacheTag('menu')

  const res = await apiClient.api.menu.$get()
  return res.json()
}

export default async function MenuPage() {
  const menu = await getMenu()

  return (
    <main>
      <h1>メニュー</h1>
      <ul>
        {menu.map((item) => (
          <li key={item.id}>
            {item.name} - ¥{item.price}
          </li>
        ))}
      </ul>
    </main>
  )
}
