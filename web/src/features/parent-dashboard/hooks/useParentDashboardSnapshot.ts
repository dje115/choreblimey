import { useEffect, useMemo, useState } from 'react'

import { apiClient } from '../../../lib/api'

export interface ParentDashboardSnapshot {
  pendingApprovals: number | null
  openChores: number | null
  activeStreaks: number | null
  outstandingPocketMoneyPence: number | null
  unreadMessages: number | null
}

export interface ParentDashboardSnapshotState {
  loading: boolean
  error?: string
  snapshot: ParentDashboardSnapshot
  lastUpdated?: number
}

const INITIAL_SNAPSHOT: ParentDashboardSnapshot = {
  pendingApprovals: null,
  openChores: null,
  activeStreaks: null,
  outstandingPocketMoneyPence: null,
  unreadMessages: null,
}

export const useParentDashboardSnapshot = (): ParentDashboardSnapshotState => {
  const [state, setState] = useState<ParentDashboardSnapshotState>({
    loading: true,
    snapshot: INITIAL_SNAPSHOT,
  })

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setState((previous) => ({ ...previous, loading: true, error: undefined }))

      try {
        const [completionsRes, redemptionsRes, starPurchasesRes, choresRes] = await Promise.all([
          apiClient.listCompletions('pending') as Promise<{ completions: Array<unknown> }>,
          apiClient.getRedemptions('pending') as Promise<{ redemptions: Array<unknown> }>,
          apiClient.getStarPurchases('pending') as Promise<{ purchases: Array<unknown> }>,
          apiClient.listChores() as Promise<{ chores: Array<{ active: boolean }> }>,
        ])

        if (cancelled) return

        const pendingApprovals =
          (completionsRes?.completions?.length || 0) +
          (redemptionsRes?.redemptions?.length || 0) +
          (starPurchasesRes?.purchases?.length || 0)

        const openChores = choresRes?.chores?.filter((chore) => chore.active).length ?? 0

        setState({
          loading: false,
          snapshot: {
            pendingApprovals,
            openChores,
            activeStreaks: null,
            outstandingPocketMoneyPence: null,
            unreadMessages: null,
          },
          lastUpdated: Date.now(),
        })
      } catch (error) {
        if (cancelled) return

        setState({
          loading: false,
          snapshot: INITIAL_SNAPSHOT,
          error: error instanceof Error ? error.message : 'Failed to load dashboard data',
        })
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  return useMemo(() => state, [state])
}

