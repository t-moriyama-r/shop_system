import { hc } from 'hono/client'
import type { AppType } from 'backend'
import { API_BASE_URL } from './config'

export const apiClient = hc<AppType>(API_BASE_URL)
