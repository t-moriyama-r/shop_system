import { OrderMenu } from './order-menu'

export default async function OrderPage({
  params,
}: {
  params: Promise<{ tableId: string }>
}) {
  const { tableId } = await params

  return (
    <main>
      <h1>テーブル {tableId} の注文</h1>
      <OrderMenu />
    </main>
  )
}
