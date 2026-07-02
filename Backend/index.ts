import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('/*', cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000' }))

const menuItems = [
  { id: '1', name: 'コーヒー', price: 400 },
  { id: '2', name: 'カフェラテ', price: 480 },
  { id: '3', name: 'チーズケーキ', price: 550 },
]

const routes = app
  .get('/api/health', (c) => c.json({ status: 'ok' as const }))
  .get('/api/menu', (c) => c.json(menuItems))

export type AppType = typeof routes

const port = Number(process.env.PORT ?? 8787)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Backend listening on http://localhost:${info.port}`)
})
