import { db } from 'db'
import { menuItems } from 'db/schema'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import { auth } from './routes/auth'
import { seAdminUsersRoute } from './routes/se-admin-users'
import { auditLogsRoute } from './routes/audit-logs'

const app = new Hono()

app.use('/*', secureHeaders())
app.use(
  '/*',
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  }),
)

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

const routes = app
  .get('/api/health', (c) => c.json({ status: 'ok' as const }))
  .get('/api/menu', async (c) => {
    try {
      const rows = await db.select().from(menuItems)
      return c.json(rows.map((row) => ({ id: row.menuItemId, name: row.name, price: row.price })))
    } catch (err) {
      console.error('Failed to fetch menu items:', err)
      throw new HTTPException(500, { message: 'Failed to fetch menu items' })
    }
  })
  .route('/api/auth', auth)
  .route('/api/se-admin-users', seAdminUsersRoute)
  .route('/api/audit-logs', auditLogsRoute)

export type AppType = typeof routes

export { app }
