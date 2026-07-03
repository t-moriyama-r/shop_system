import { db, menuItems } from 'db'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { auth } from './routes/auth'

const app = new Hono()

app.use('/*', secureHeaders())
app.use(
  '/*',
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  }),
)

const routes = app
  .get('/api/health', (c) => c.json({ status: 'ok' as const }))
  .get('/api/menu', async (c) => {
    const rows = await db.select().from(menuItems)
    return c.json(rows.map((row) => ({ id: row.menuItemId, name: row.name, price: row.price })))
  })
  .route('/api/auth', auth)

export type AppType = typeof routes

export { app }
