import type { InferResponseType } from 'hono/client'
import type { apiClient } from './api'

type MenuRoute = typeof apiClient.api.menu

export type MenuItem = InferResponseType<MenuRoute['$get']>[number]
