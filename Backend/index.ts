import { serve } from '@hono/node-server'

import { app } from './app'
import { initSentry } from './lib/sentry'

export type { AppType } from './app'

initSentry()

const port = Number(process.env.PORT ?? 8787)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Backend listening on http://localhost:${info.port}`)
})
