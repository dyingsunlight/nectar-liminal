import { serve } from '@hono/node-server'
import { app } from './app'
import { getRepository } from './store'

const port = Number(process.env.PORT || 8787)
const repo = getRepository()

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(
      `[fc-api] Listening on http://localhost:${info.port} (storage=${repo.driver})`
    )
  }
)
