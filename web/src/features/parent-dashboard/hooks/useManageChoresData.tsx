import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiClient } from '../../../lib/api'

export interface ParentChore {
  id: string
  title: string
  description?: string | null
  frequency: string
  proof: string
  baseRewardPence?: number | null
  starsOverride?: number | null
  minBidPence?: number | null
  maxBidPence?: number | null
  startDate?: string | null
  endDate?: string | null
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ParentAssignment {
  id: string
  choreId: string
  familyId: string
  childId?: string | null
  biddingEnabled?: boolean
  chore?: {
    id: string
    title: string
    baseRewardPence?: number | null
    active: boolean
  } | null
  child?: {
    id: string
    nickname?: string | null
    ageGroup?: string | null
  } | null
}

interface ManageChoresState {
  loading: boolean
  error?: string
  chores: ParentChore[]
  assignments: ParentAssignment[]
  refreshing: boolean
}

export interface UseManageChoresDataResult extends ManageChoresState {
  refresh: () => Promise<void>
  toggleChoreActive: (choreId: string, nextActive: boolean) => Promise<void>
}

export const useManageChoresData = (): UseManageChoresDataResult => {
  const [state, setState] = useState<ManageChoresState>({
    loading: true,
    chores: [],
    assignments: [],
    refreshing: false,
  })

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: undefined }))
    try {
      const [choresResponse, assignmentsResponse] = await Promise.all([
        apiClient.listChores() as Promise<{ chores: ParentChore[] }>,
        apiClient.listAssignments() as Promise<{ assignments: ParentAssignment[] }>,
      ])

      setState({
        loading: false,
        refreshing: false,
        chores: choresResponse?.chores ?? [],
        assignments: assignmentsResponse?.assignments ?? [],
      })
    } catch (error) {
      console.error('Failed to load manage chores data', error)
      setState((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: error instanceof Error ? error.message : 'Failed to load chores',
      }))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, refreshing: true }))
    await load()
  }, [load])

  const toggleChoreActive = useCallback(
    async (choreId: string, nextActive: boolean) => {
      try {
        await apiClient.updateChore(choreId, { active: nextActive })
        setState((prev) => ({
          ...prev,
          chores: prev.chores.map((chore) => (chore.id === choreId ? { ...chore, active: nextActive } : chore)),
        }))
      } catch (error) {
        console.error('Failed to toggle chore active state', error)
        throw error
      }
    },
    [],
  )

  return useMemo(
    () => ({
      ...state,
      refresh,
      toggleChoreActive,
    }),
    [state, refresh, toggleChoreActive],
  )
}

