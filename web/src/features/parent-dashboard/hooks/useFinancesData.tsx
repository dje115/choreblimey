import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiClient } from '../../../lib/api'
import { getBroadcastChannel, type NotificationType } from '../../../utils/notifications'
import { notifyUpdate } from '../../../utils/notifications'

interface FamilyMembersResponse {
  members: Array<{
    id: string
    role: string
    displayName?: string | null
    userId?: string | null
    user?: { id: string; email?: string | null }
  }>
  children: Array<{
    id: string
    nickname: string
    ageGroup?: string | null
    birthYear?: number | null
    birthMonth?: number | null
  }>
}

interface WalletResponse {
  wallet?: {
    balancePence?: number
    stars?: number
  }
}

interface WalletStatsResponse {
  stats?: {
    lifetimeEarningsPence?: number
    lifetimePaidOutPence?: number
    lastPayoutAt?: string | null
  }
}

interface Payout {
  id: string
  childId: string
  amountPence: number
  createdAt: string
  method?: string | null
  note?: string | null
}

interface AssignmentSummary {
  id: string
  choreId?: string | null
  childId?: string | null
  biddingEnabled?: boolean | null
  chore?: {
    id: string
    frequency?: 'daily' | 'weekly' | 'once'
    baseRewardPence?: number | null
    active?: boolean | null
  } | null
}

export interface FamilyFinanceSettings {
  maxBudgetPence: number
  budgetPeriod: 'weekly' | 'monthly'
  showLifetimeEarnings: boolean
  buyStarsEnabled: boolean
  starConversionRatePence: number
}

const DEFAULT_FINANCE_SETTINGS: FamilyFinanceSettings = {
  maxBudgetPence: 0,
  budgetPeriod: 'weekly',
  showLifetimeEarnings: false,
  buyStarsEnabled: false,
  starConversionRatePence: 10,
}

export interface ChildFinanceSummary {
  childId: string
  nickname: string
  stars: number
  balancePence: number
  lifetimeEarningsPence: number
  lifetimePaidOutPence: number
  lastPayoutAt?: string | null
  lastPayoutAmountPence?: number | null
}

interface FinancesState {
  loading: boolean
  refreshing: boolean
  error?: string
  children: ChildFinanceSummary[]
  payouts: Payout[]
  assignments: AssignmentSummary[]
  familySettings: FamilyFinanceSettings | null
}

export interface UseFinancesDataResult extends FinancesState {
  refresh: () => Promise<void>
  totalOutstandingPence: number
  totalStars: number
  paidThisMonthPence: number
  saveFamilySettings: (settings: FamilyFinanceSettings) => Promise<void>
}

const safeNumber = (value?: number | null): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

export const useFinancesData = (): UseFinancesDataResult => {
  const [state, setState] = useState<FinancesState>({
    loading: true,
    refreshing: false,
    children: [],
    payouts: [],
    assignments: [],
    familySettings: DEFAULT_FINANCE_SETTINGS,
  })

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    setState((previous) => ({
      ...previous,
      loading: silent ? previous.loading : true,
      refreshing: silent ? true : false,
      error: undefined,
    }))

    try {
      const [familyRes, membersRes, payoutsRes, assignmentsRes] = await Promise.allSettled([
        apiClient.getFamily() as Promise<{ family: any }> ,
        apiClient.getFamilyMembers() as Promise<FamilyMembersResponse>,
        apiClient.getPayouts() as Promise<{ payouts: Payout[] }>,
        apiClient.listAssignments() as Promise<{ assignments: AssignmentSummary[] }> ,
      ])

      const children: FamilyMembersResponse['children'] =
        membersRes.status === 'fulfilled' ? membersRes.value.children ?? [] : []

      const uniqueChildren = Array.from(new Map(children.map((child) => [child.id, child])).values())

      const walletPromises = uniqueChildren.map((child) =>
        apiClient.getWallet(child.id).catch(() => ({ wallet: { balancePence: 0, stars: 0 } })) as Promise<WalletResponse>,
      )
      const statsPromises = uniqueChildren.map((child) =>
        apiClient
          .getWalletStats(child.id)
          .catch(() => ({ stats: { lifetimeEarningsPence: 0, lifetimePaidOutPence: 0, lastPayoutAt: null } })) as Promise<WalletStatsResponse>,
      )

      const [walletResults, statsResults] = await Promise.all([Promise.all(walletPromises), Promise.all(statsPromises)])

      const payouts: Payout[] = payoutsRes.status === 'fulfilled' ? payoutsRes.value.payouts ?? [] : []

      const assignments: AssignmentSummary[] =
        assignmentsRes.status === 'fulfilled' ? assignmentsRes.value.assignments ?? [] : []

      const familySettings: FamilyFinanceSettings | null = (() => {
        if (familyRes.status !== 'fulfilled') {
          return DEFAULT_FINANCE_SETTINGS
        }

        const family = familyRes.value.family
        return {
          maxBudgetPence: safeNumber(family?.maxBudgetPence),
          budgetPeriod: (family?.budgetPeriod ?? 'weekly') as 'weekly' | 'monthly',
          showLifetimeEarnings: family?.showLifetimeEarnings ?? false,
          buyStarsEnabled: family?.buyStarsEnabled ?? false,
          starConversionRatePence: safeNumber(family?.starConversionRatePence) || 10,
        }
      })()

      const payoutTotals = payouts.reduce<Record<string, { total: number; lastAmount: number; lastAt: string }>>((acc, payout) => {
        const record = acc[payout.childId] ?? { total: 0, lastAmount: 0, lastAt: '' }
        record.total += safeNumber(payout.amountPence)
        if (!record.lastAt || new Date(payout.createdAt) > new Date(record.lastAt)) {
          record.lastAt = payout.createdAt
          record.lastAmount = payout.amountPence
        }
        acc[payout.childId] = record
        return acc
      }, {})

      const childSummaries: ChildFinanceSummary[] = uniqueChildren.map((child, index) => {
        const wallet = walletResults[index]?.wallet
        const stats = statsResults[index]?.stats
        const payoutInfo = payoutTotals[child.id]
        return {
          childId: child.id,
          nickname: child.nickname || 'Unnamed child',
          stars: safeNumber(wallet?.stars),
          balancePence: safeNumber(wallet?.balancePence),
          lifetimeEarningsPence: safeNumber(stats?.lifetimeEarningsPence),
          lifetimePaidOutPence:
            safeNumber(stats?.lifetimePaidOutPence) || safeNumber(payoutInfo?.total),
          lastPayoutAt: stats?.lastPayoutAt ?? payoutInfo?.lastAt,
          lastPayoutAmountPence: payoutInfo?.lastAmount ?? null,
        }
      })

      setState({
        loading: false,
        refreshing: false,
        error: undefined,
        children: childSummaries,
        payouts,
        assignments,
        familySettings,
      })
    } catch (error) {
      console.error('Failed to load finances data', error)
      setState((previous) => ({
        ...previous,
        loading: false,
        refreshing: false,
        error: error instanceof Error ? error.message : 'Failed to load finances data',
      }))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const relevant: NotificationType[] = ['familyUpdated', 'giftUpdated']

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

  const refresh = useCallback(async () => {
    await load({ silent: true })
  }, [load])

  const totals = useMemo(() => {
    const totalOutstandingPence = state.children.reduce((sum, child) => sum + child.balancePence, 0)
    const totalStars = state.children.reduce((sum, child) => sum + child.stars, 0)
    const now = new Date()
    const paidThisMonthPence = state.payouts.reduce((sum, payout) => {
      const payoutDate = new Date(payout.createdAt)
      if (
        payoutDate.getUTCFullYear() === now.getUTCFullYear() &&
        payoutDate.getUTCMonth() === now.getUTCMonth()
      ) {
        return sum + safeNumber(payout.amountPence)
      }
      return sum
    }, 0)
    return { totalOutstandingPence, totalStars, paidThisMonthPence }
  }, [state.children, state.payouts])

  const saveFamilySettings = useCallback(
    async (settings: FamilyFinanceSettings) => {
      await apiClient.updateFamily({
        maxBudgetPence: settings.maxBudgetPence,
        budgetPeriod: settings.budgetPeriod,
        showLifetimeEarnings: settings.showLifetimeEarnings,
        buyStarsEnabled: settings.buyStarsEnabled,
        starConversionRatePence: settings.starConversionRatePence,
      })
      notifyUpdate('familyUpdated')
      await load({ silent: true })
    },
    [load],
  )

  return {
    ...state,
    refresh,
    totalOutstandingPence: totals.totalOutstandingPence,
    totalStars: totals.totalStars,
    paidThisMonthPence: totals.paidThisMonthPence,
    saveFamilySettings,
  }
}

