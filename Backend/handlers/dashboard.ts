import { getDashboardSummary, listShopAccountActivities } from 'db/dashboard'
import { parsePositiveInt } from '../lib/pagination'
import type { HandlerResult } from './types'

// systemStatus の詳細定義は未提供のため、最小実装として固定値を返す（二次開発で拡張前提）。
const SYSTEM_STATUS = 'ok'

const DEFAULT_ACTIVITIES_LIMIT = 10
const MAX_ACTIVITIES_LIMIT = 100

export async function getDashboardSummaryHandler(): Promise<HandlerResult> {
  const summary = await getDashboardSummary()
  return {
    status: 200,
    body: {
      systemStatus: SYSTEM_STATUS,
      ...summary,
      generatedAt: new Date().toISOString(),
    },
  }
}

export interface ListShopAccountActivitiesInput {
  limit?: string
}

export async function listShopAccountActivitiesHandler(
  input: ListShopAccountActivitiesInput,
): Promise<HandlerResult> {
  const limit = parsePositiveInt(input.limit, DEFAULT_ACTIVITIES_LIMIT, MAX_ACTIVITIES_LIMIT)
  const activities = await listShopAccountActivities(limit)
  return { status: 200, body: { data: activities, limit } }
}
