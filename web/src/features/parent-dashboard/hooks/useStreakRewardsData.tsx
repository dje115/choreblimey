import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiClient } from '../../../lib/api'
import { getBroadcastChannel, notifyUpdate, type NotificationType } from '../../../utils/notifications'
import { useSocket } from '../../../contexts/SocketContext'

interface FamilyResponse {
  family: {
    id: string
    nameCipher: string
    giftsEnabled?: boolean | null
    bonusEnabled?: boolean | null
    bonusDays?: number | null
    bonusStars?: number | null
    bonusMoneyPence?: number | null
    streakProtectionDays?: number | null
  }
}

interface FamilyGift {
  id: string
  title: string
  description?: string | null
  starsCost?: number | null
  starsRequired?: number | null
  pricePence?: number | null
  active: boolean
  type?: string | null
  recurring?: boolean | null
  availableForAll?: boolean | null
  availableForChildIds?: string[] | null
  affiliateUrl?: string | null
  imageUrl?: string | null
  createdAt?: string
}

interface Redemption {
  id: string
  familyGiftId?: string | null
  rewardId?: string | null
  childId?: string | null
  status: string
  createdAt: string
  processedAt?: string | null
  familyGift?: {
    id: string
    title: string
  } | null
  reward?: {
    id: string
    title: string
  } | null
}

interface StarPurchase {
  id: string
  childId: string
  starsRequested: number
  amountPence?: number | null
  status: string
  createdAt: string
  processedAt?: string | null
}

interface StreakRewardsState {
  loading: boolean
  error?: string
  family: FamilyResponse['family'] | null
  gifts: FamilyGift[]
  pendingRedemptions: Redemption[]
  recentRedemptions: Redemption[]
  starPurchases: StarPurchase[]
  refreshing: boolean
}

export interface UseStreakRewardsDataResult extends StreakRewardsState {
  refresh: () => Promise<void>
  toggleGiftShop: (enabled: boolean) => Promise<void>
  setGiftActive: (giftId: string, active: boolean) => Promise<void>
  updateGift: (
    giftId: string,
    data: {
      starsRequired?: number
      availableForAll?: boolean
      availableForChildIds?: string[]
      recurring?: boolean
      title?: string
      description?: string
      imageUrl?: string | null
      affiliateUrl?: string | null
    },
  ) => Promise<void>
  deleteGift: (giftId: string) => Promise<void>
  approveRedemption: (redemptionId: string) => Promise<void>
  rejectRedemption: (redemptionId: string) => Promise<void>
  busyGiftIds: Set<string>
  busyRedemptionIds: Set<string>
}

export const useStreakRewardsData = (): UseStreakRewardsDataResult => {
  const [state, setState] = useState<StreakRewardsState>({
    loading: true,
    family: null,
    gifts: [],
    pendingRedemptions: [],
    recentRedemptions: [],
    starPurchases: [],
    refreshing: false,
  })
  const [busyGiftIds, setBusyGiftIds] = useState<Set<string>>(new Set())
  const [busyRedemptionIds, setBusyRedemptionIds] = useState<Set<string>>(new Set())
  const { on, off } = useSocket()

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: undefined }))

    try {
      const [familyRes, giftsRes, pendingRes, historyRes, purchasesRes] = await Promise.all([
        apiClient.getFamily() as Promise<FamilyResponse>,
        apiClient.getFamilyGifts() as Promise<{ gifts: FamilyGift[] }> ,
        apiClient.getRedemptions('pending') as Promise<{ redemptions: Redemption[] }> ,
        apiClient.getRedemptions('history') as Promise<{ redemptions: Redemption[] }> ,
        apiClient.getStarPurchases() as Promise<{ purchases: StarPurchase[] }> ,
      ])

      setState({
        loading: false,
        family: familyRes.family,
        gifts: giftsRes?.gifts ?? [],
        pendingRedemptions: pendingRes?.redemptions ?? [],
        recentRedemptions: historyRes?.redemptions ?? [],
        starPurchases: purchasesRes?.purchases ?? [],
        refreshing: false,
      })
    } catch (error) {
      console.error('Failed to load streak rewards data', error)
      setState((previous) => ({
        ...previous,
        loading: false,
        refreshing: false,
        error: error instanceof Error ? error.message : 'Failed to load streak rewards data',
      }))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const relevant: NotificationType[] = ['giftUpdated', 'redemptionUpdated']

    const handleCustomEvent = () => {
      void load()
    }

    const handleStorage = (event: StorageEvent) => {
      if (!event.key) return
      if (relevant.some((type) => `${type}_updated` === event.key)) {
        void load()
      }
    }

    const channel = getBroadcastChannel()
    const handleBroadcast = (event: MessageEvent<{ type?: NotificationType }>) => {
      if (event.data?.type && relevant.includes(event.data.type)) {
        void load()
      }
    }

    relevant.forEach((type) => window.addEventListener(type, handleCustomEvent))
    window.addEventListener('storage', handleStorage)
    channel?.addEventListener('message', handleBroadcast)

    return () => {
      relevant.forEach((type) => window.removeEventListener(type, handleCustomEvent))
      window.removeEventListener('storage', handleStorage)
      channel?.removeEventListener('message', handleBroadcast)
    }
  }, [load])

  useEffect(() => {
    if (!on || !off) {
      return
    }

    const events: NotificationType[] = ['redemptionUpdated', 'giftUpdated']
    const handlers = [
      'redemption:created',
      'redemption:fulfilled',
      'redemption:rejected',
      'starPurchase:created',
      'starPurchase:approved',
      'starPurchase:rejected',
    ].map((eventName) => {
      const handler = () => {
        events.forEach((event) => notifyUpdate(event))
        void load()
      }
      on(eventName, handler)
      return { eventName, handler }
    })

    return () => {
      handlers.forEach(({ eventName, handler }) => off(eventName, handler))
    }
  }, [on, off, load])

  const refresh = useCallback(async () => {
    setState((previous) => ({ ...previous, refreshing: true }))
    await load()
  }, [load])

  const toggleGiftShop = useCallback(
    async (enabled: boolean) => {
      try {
        await apiClient.updateFamily({ giftsEnabled: enabled })
        setState((previous) => ({
          ...previous,
          family: previous.family ? { ...previous.family, giftsEnabled: enabled } : previous.family,
        }))
        notifyUpdate('giftUpdated')
      } catch (error) {
        console.error('Failed to toggle gift shop', error)
        throw error
      }
    },
    [],
  )

  const markGiftBusy = useCallback((id: string) => {
    setBusyGiftIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const unmarkGiftBusy = useCallback((id: string) => {
    setBusyGiftIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const markRedemptionBusy = useCallback((id: string) => {
    setBusyRedemptionIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const unmarkRedemptionBusy = useCallback((id: string) => {
    setBusyRedemptionIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const setGiftActive = useCallback(
    async (giftId: string, active: boolean) => {
      markGiftBusy(giftId)
      try {
        await apiClient.updateFamilyGift(giftId, { active })
        setState((previous) => ({
          ...previous,
          gifts: previous.gifts.map((gift) => (gift.id === giftId ? { ...gift, active } : gift)),
        }))
        notifyUpdate('giftUpdated')
      } finally {
        unmarkGiftBusy(giftId)
      }
    },
    [markGiftBusy, unmarkGiftBusy],
  )

  const updateGift = useCallback(
    async (
      giftId: string,
      data: {
        starsRequired?: number
        availableForAll?: boolean
        availableForChildIds?: string[]
        recurring?: boolean
        title?: string
        description?: string
        imageUrl?: string | null
        affiliateUrl?: string | null
      },
    ) => {
      markGiftBusy(giftId)
      try {
        await apiClient.updateFamilyGift(giftId, data)
        setState((previous) => ({
          ...previous,
          gifts: previous.gifts.map((gift) =>
            gift.id === giftId
              ? {
                  ...gift,
                  title: data.title ?? gift.title,
                  description: data.description ?? gift.description,
                  imageUrl: data.imageUrl ?? gift.imageUrl,
                  affiliateUrl: data.affiliateUrl ?? (gift as any).affiliateUrl,
                  starsCost:
                    data.starsRequired !== undefined
                      ? data.starsRequired
                      : gift.starsCost !== undefined
                      ? gift.starsCost
                      : (gift as any).starsRequired,
                  starsRequired:
                    data.starsRequired !== undefined
                      ? data.starsRequired
                      : (gift as any).starsRequired ?? gift.starsCost,
                  availableForAll: data.availableForAll ?? gift.availableForAll,
                  availableForChildIds: data.availableForChildIds ?? gift.availableForChildIds,
                  recurring: data.recurring ?? gift.recurring,
                }
              : gift,
          ),
        }))
        notifyUpdate('giftUpdated')
      } finally {
        unmarkGiftBusy(giftId)
      }
    },
    [markGiftBusy, unmarkGiftBusy],
  )

  const deleteGift = useCallback(
    async (giftId: string) => {
      markGiftBusy(giftId)
      try {
        await apiClient.deleteFamilyGift(giftId)
        setState((previous) => ({
          ...previous,
          gifts: previous.gifts.filter((gift) => gift.id !== giftId),
        }))
        notifyUpdate('giftUpdated')
      } finally {
        unmarkGiftBusy(giftId)
      }
    },
    [markGiftBusy, unmarkGiftBusy],
  )

  const approveRedemption = useCallback(
    async (redemptionId: string) => {
      markRedemptionBusy(redemptionId)
      try {
        await apiClient.fulfillRedemption(redemptionId)
        setState((previous) => ({
          ...previous,
          pendingRedemptions: previous.pendingRedemptions.filter((redemption) => redemption.id !== redemptionId),
          recentRedemptions: previous.recentRedemptions.map((redemption) =>
            redemption.id === redemptionId ? { ...redemption, status: 'fulfilled', processedAt: new Date().toISOString() } : redemption,
          ),
        }))
        notifyUpdate('redemptionUpdated')
      } finally {
        unmarkRedemptionBusy(redemptionId)
      }
    },
    [markRedemptionBusy, unmarkRedemptionBusy],
  )

  const rejectRedemption = useCallback(
    async (redemptionId: string) => {
      markRedemptionBusy(redemptionId)
      try {
        await apiClient.rejectRedemption(redemptionId)
        setState((previous) => ({
          ...previous,
          pendingRedemptions: previous.pendingRedemptions.filter((redemption) => redemption.id !== redemptionId),
          recentRedemptions: previous.recentRedemptions.map((redemption) =>
            redemption.id === redemptionId ? { ...redemption, status: 'rejected', processedAt: new Date().toISOString() } : redemption,
          ),
        }))
        notifyUpdate('redemptionUpdated')
      } finally {
        unmarkRedemptionBusy(redemptionId)
      }
    },
    [markRedemptionBusy, unmarkRedemptionBusy],
  )

  return useMemo(
    () => ({
      ...state,
      refresh,
      toggleGiftShop,
      setGiftActive,
      updateGift,
      deleteGift,
      approveRedemption,
      rejectRedemption,
      busyGiftIds,
      busyRedemptionIds,
    }),
    [
      state,
      refresh,
      toggleGiftShop,
      setGiftActive,
      updateGift,
      deleteGift,
      approveRedemption,
      rejectRedemption,
      busyGiftIds,
      busyRedemptionIds,
    ],
  )
}

