'use client'

import { useQuery } from '@tanstack/react-query'
import { shopAccountActivitiesQuery } from '@/lib/repositories/dashboard'
import { ActivitiesPanel } from './ActivitiesPanel'

export function ActivitiesSection() {
  const activitiesQuery = useQuery(shopAccountActivitiesQuery())

  return (
    <ActivitiesPanel
      activities={activitiesQuery.data?.data ?? []}
      loading={activitiesQuery.isPending}
      error={activitiesQuery.isError ? '発行状況の取得に失敗しました' : null}
      refreshing={activitiesQuery.isFetching}
      onRefresh={() => activitiesQuery.refetch()}
    />
  )
}
