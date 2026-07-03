import { cacheLife, cacheTag } from 'next/cache'
import { apiClient } from '@/lib/api'
import { MenuItemList } from '@/components/menu-item-list'

async function getMenu() {
  'use cache'
  cacheLife('minutes')
  cacheTag('menu')

  const res = await apiClient.api.menu.$get()
  if (!res.ok) {
    throw new Error(`Failed to fetch menu: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export default async function MenuPage() {
  const menu = await getMenu()

  return (
    <main>
      <h1>メニュー</h1>
      <MenuItemList items={menu} />
    </main>
  )
}
