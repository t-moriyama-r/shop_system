import { serve } from '@hono/node-server'
import { db, menuItems } from 'db'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('/*', cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000' }))

const routes = app
  .get('/api/health', (c) => c.json({ status: 'ok' as const }))
  .get('/api/menu', async (c) => {
    const rows = await db.select().from(menuItems)
    return c.json(rows.map((row) => ({ id: row.menuItemId, name: row.name, price: row.price })))
  })

export type AppType = typeof routes

const port = Number(process.env.PORT ?? 8787)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Backend listening on http://localhost:${info.port}`)
})
