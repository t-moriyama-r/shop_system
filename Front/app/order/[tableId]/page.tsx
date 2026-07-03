import { notFound } from 'next/navigation'
import { OrderMenu } from './order-menu'

const TABLE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,32}$/

export default async function OrderPage({
  params,
}: {
  params: Promise<{ tableId: string }>
}) {
  const { tableId } = await params

  if (!TABLE_ID_PATTERN.test(tableId)) {
    notFound()
  }

  return (
    <main>
      <h1>テーブル {tableId} の注文</h1>
      <OrderMenu />
    </main>
  )
}
