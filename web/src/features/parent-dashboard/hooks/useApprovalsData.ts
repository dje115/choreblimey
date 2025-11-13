import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiClient } from '../../../lib/api'
import { getBroadcastChannel, notifyUpdate, type NotificationType } from '../../../utils/notifications'
import { useSocket } from '../../../contexts/SocketContext'

export interface PendingCompletion {
  id: string
  assignmentId: string
  childId: string
  status: string
  timestamp: string
  assignment?: {
    id: string
    chore?: {
      id: string
      title: string
      baseRewardPence?: number | null
    } | null
  } | null
}

export interface PendingRedemption {
  id: string
  childId?: string | null
  status: string
  createdAt: string
  starsCost?: number | null
  reward?: {
    id: string
    title: string
  } | null
  familyGift?: {
    id: string
    title: string
  } | null
}

export interface PendingStarPurchase {
  id: string
  childId: string
  status: string
  starsRequested: number
  createdAt: string
}

export interface UseApprovalsDataResult {
  loading: boolean
  error?: string
  completions: PendingCompletion[]
  redemptions: PendingRedemption[]
  starPurchases: PendingStarPurchase[]
  approveCompletion: (completionId: string) => Promise<void>
  rejectCompletion: (completionId: string, reason?: string) => Promise<void>
  approveRedemption: (redemptionId: string) => Promise<void>
  rejectRedemption: (redemptionId: string) => Promise<void>
  approveStarPurchase: (purchaseId: string) => Promise<void>
  rejectStarPurchase: (purchaseId: string) => Promise<void>
  refresh: () => Promise<void>
  busyIds: Set<string>
}

export const useApprovalsData = (): UseApprovalsDataResult => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()
  const [completions, setCompletions] = useState<PendingCompletion[]>([])
  const [redemptions, setRedemptions] = useState<PendingRedemption[]>([])
  const [starPurchases, setStarPurchases] = useState<PendingStarPurchase[]>([])
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const { on, off } = useSocket()

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(undefined)

    try {
      const [completionResponse, redemptionResponse, starPurchaseResponse] = await Promise.all([
        apiClient.listCompletions('pending') as Promise<{ completions: PendingCompletion[] }>,
        apiClient.getRedemptions('pending') as Promise<{ redemptions: PendingRedemption[] }>,
        apiClient.getStarPurchases('pending') as Promise<{ purchases: PendingStarPurchase[] }>,
      ])

      setCompletions(completionResponse?.completions ?? [])
      setRedemptions(redemptionResponse?.redemptions ?? [])
      setStarPurchases(starPurchaseResponse?.purchases ?? [])
    } catch (err) {
      console.error('Failed to load approvals data', err)
      setError(err instanceof Error ? err.message : 'Failed to load approvals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    const relevantNotifications: NotificationType[] = ['choreUpdated', 'redemptionUpdated', 'completionUpdated']

    const handleCustomEvent = () => {
      void fetchData()
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key && relevantNotifications.some((type) => `${type}_updated` === event.key)) {
        void fetchData()
      }
    }

    const channel = getBroadcastChannel()
    const handleBroadcast = (event: MessageEvent<{ type?: NotificationType }>) => {
      if (event.data?.type && relevantNotifications.includes(event.data.type)) {
        void fetchData()
      }
    }

    relevantNotifications.forEach((type) => {
      window.addEventListener(type, handleCustomEvent)
    })
    window.addEventListener('storage', handleStorage)
    channel?.addEventListener('message', handleBroadcast)

    return () => {
      relevantNotifications.forEach((type) => {
        window.removeEventListener(type, handleCustomEvent)
      })
      window.removeEventListener('storage', handleStorage)
      channel?.removeEventListener('message', handleBroadcast)
    }
  }, [fetchData])

  useEffect(() => {
    if (!on || !off) {
      return
    }

    const events: Array<{ event: string; notifications: NotificationType[] }> = [
      { event: 'completion:created', notifications: ['completionUpdated'] },
      { event: 'completion:approved', notifications: ['completionUpdated'] },
      { event: 'completion:rejected', notifications: ['completionUpdated'] },
      { event: 'redemption:created', notifications: ['redemptionUpdated'] },
      { event: 'redemption:fulfilled', notifications: ['redemptionUpdated'] },
      { event: 'redemption:rejected', notifications: ['redemptionUpdated'] },
      { event: 'starPurchase:created', notifications: ['redemptionUpdated'] },
      { event: 'starPurchase:approved', notifications: ['redemptionUpdated'] },
      { event: 'starPurchase:rejected', notifications: ['redemptionUpdated'] },
    ]

    const handlers = events.map(({ event, notifications }) => {
      const handler = () => {
        notifications.forEach((notification) => notifyUpdate(notification))
        void fetchData()
      }
      on(event, handler)
      return { event, handler }
    })

    return () => {
      handlers.forEach(({ event, handler }) => off(event, handler))
    }
  }, [on, off, fetchData])

  const markBusy = useCallback((id: string) => {
    setBusyIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const unmarkBusy = useCallback((id: string) => {
    setBusyIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const refresh = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  const approveCompletion = useCallback(
    async (completionId: string) => {
      markBusy(completionId)
      try {
        await apiClient.approveCompletion(completionId)
        await fetchData()
      } finally {
        unmarkBusy(completionId)
      }
    },
    [fetchData, markBusy, unmarkBusy],
  )

  const rejectCompletion = useCallback(
    async (completionId: string, reason?: string) => {
      markBusy(completionId)
      try {
        await apiClient.rejectCompletion(completionId, reason)
        await fetchData()
      } finally {
        unmarkBusy(completionId)
      }
    },
    [fetchData, markBusy, unmarkBusy],
  )

  const approveRedemption = useCallback(
    async (redemptionId: string) => {
      markBusy(redemptionId)
      try {
        await apiClient.fulfillRedemption(redemptionId)
        await fetchData()
      } finally {
        unmarkBusy(redemptionId)
      }
    },
    [fetchData, markBusy, unmarkBusy],
  )

  const rejectRedemption = useCallback(
    async (redemptionId: string) => {
      markBusy(redemptionId)
      try {
        await apiClient.rejectRedemption(redemptionId)
        await fetchData()
      } finally {
        unmarkBusy(redemptionId)
      }
    },
    [fetchData, markBusy, unmarkBusy],
  )

  const approveStarPurchase = useCallback(
    async (purchaseId: string) => {
      markBusy(purchaseId)
      try {
        await apiClient.approveStarPurchase(purchaseId)
        await fetchData()
      } finally {
        unmarkBusy(purchaseId)
      }
    },
    [fetchData, markBusy, unmarkBusy],
  )

  const rejectStarPurchase = useCallback(
    async (purchaseId: string) => {
      markBusy(purchaseId)
      try {
        await apiClient.rejectStarPurchase(purchaseId)
        await fetchData()
      } finally {
        unmarkBusy(purchaseId)
      }
    },
    [fetchData, markBusy, unmarkBusy],
  )

  const busyIdsMemo = useMemo(() => new Set(busyIds), [busyIds])

  return {
    loading,
    error,
    completions,
    redemptions,
    starPurchases,
    approveCompletion,
    rejectCompletion,
    approveRedemption,
    rejectRedemption,
    approveStarPurchase,
    rejectStarPurchase,
    refresh,
    busyIds: busyIdsMemo,
  }
}

