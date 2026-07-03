import type { MenuItem } from '@/lib/types'

export function MenuItemList({ items }: { items: MenuItem[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          {item.name} - ¥{item.price}
        </li>
      ))}
    </ul>
  )
}
