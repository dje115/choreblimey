import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useSocket } from '../../../contexts/SocketContext'
import { apiClient } from '../../../lib/api'
import { handleApiError } from '../../../utils/errorHandler'
import { notifyUpdate, getBroadcastChannel, type NotificationType } from '../../../utils/notifications'

interface Wallet {
  balancePence: number
  stars?: number
  transactions?: Array<{
    id: string
    type: 'credit' | 'debit'
    amountPence: number
    source?: string
    note?: string
    createdAt: string
  }>
}

interface WalletStats {
  totalEarned?: number
  totalSpent?: number
  lifetimeEarningsPence?: number
  lifetimePaidOutPence?: number
  lastPayoutAt?: string | null
  [key: string]: any
}

interface Chore {
  id: string
  title: string
  description?: string
  frequency: 'daily' | 'weekly' | 'once'
  proof: 'none' | 'photo' | 'note'
  baseRewardPence: number
  starsOverride?: number
  minBidPence?: number
  maxBidPence?: number
  active: boolean
}

interface Assignment {
  id: string
  choreId: string
  childId?: string | null
  biddingEnabled?: boolean
  createdAt: string
  chore?: Chore
  [key: string]: any
}

interface Completion {
  id: string
  assignmentId: string
  childId: string
  status: 'pending' | 'approved' | 'rejected'
  timestamp: string
  assignment?: Assignment
  [key: string]: any
}

interface FamilyGift {
  id: string
  title: string
  description?: string
  type: 'amazon_product' | 'activity' | 'custom'
  starsRequired: number
  imageUrl?: string
  category?: string
  pricePence?: number
  active?: boolean
  affiliateUrl?: string
  sitestripeUrl?: string
  availableForAll?: boolean
  availableForChildIds?: string[]
  recurring?: boolean
  createdByUser?: {
    id: string
    email: string
  }
  [key: string]: any
}

interface Redemption {
  id: string
  familyGiftId?: string
  rewardId?: string
  childId: string
  costPaid: number
  status: 'pending' | 'fulfilled' | 'rejected'
  createdAt: string
  processedAt?: string
  familyGift?: FamilyGift
  reward?: any
  [key: string]: any
}

interface LeaderboardEntry {
  childId: string
  nickname: string
  totalStars: number
  ageGroup?: string
  child?: {
    nickname: string
    ageGroup?: string
  }
}

interface StreakStat {
  chore?: {
    id: string
    title: string
  }
  current: number
  longest: number
  [key: string]: any
}

interface Transaction {
  id: string
  type: 'credit' | 'debit'
  amountPence: number
  source?: string
  note?: string
  createdAt: string
  metaJson?: string | any
  [key: string]: any
}

interface Payout {
  id: string
  childId: string
  amountPence: number
  paidAt: string
  paidBy?: string
  paidByUser?: {
    email: string
  }
  [key: string]: any
}

interface Bid {
  id: string
  childId: string
  amountPence: number
  assignmentId: string
  [key: string]: any
}

interface HolidayMode {
  isActive: boolean
  isFamilyHoliday: boolean
  startDate: string
  endDate: string
  message: string
}

export interface UseChildDashboardDataResult {
  // Loading states
  isLoading: boolean
  error: string
  
  // Core data
  wallet: Wallet | null
  walletStats: WalletStats | null
  familySettings: any
  assignments: Assignment[]
  completions: Completion[]
  familyGifts: FamilyGift[]
  redemptions: Redemption[]
  pendingRedemptions: Redemption[]
  redemptionHistory: Redemption[]
  starPurchases: any[]
  pendingStarPurchases: any[]
  leaderboard: LeaderboardEntry[]
  streakStats: { individualStreaks: StreakStat[]; [key: string]: any } | null
  transactions: Transaction[]
  payouts: Payout[]
  gifts: any[]
  familyMembers: any[]
  
  // Challenge mode data
  choreChampions: Map<string, any>
  choreBids: Map<string, Bid[]>
  choreStreaks: Map<string, any>
  allChoreStreaks: Map<string, any>
  
  // Holiday mode
  holidayMode: HolidayMode
  isPaused: boolean
  
  // Actions
  refresh: () => Promise<void>
  loadBidsForAssignment: (assignmentId: string) => Promise<Bid[]>
}

export const useChildDashboardData = (activeTab: string): UseChildDashboardDataResult => {
  const { user } = useAuth()
  const { on, off } = useSocket()
  
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [walletStats, setWalletStats] = useState<WalletStats | null>(null)
  const [familySettings, setFamilySettings] = useState<any>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [familyGifts, setFamilyGifts] = useState<FamilyGift[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [pendingRedemptions, setPendingRedemptions] = useState<Redemption[]>([])
  const [redemptionHistory, setRedemptionHistory] = useState<Redemption[]>([])
  const [starPurchases, setStarPurchases] = useState<any[]>([])
  const [pendingStarPurchases, setPendingStarPurchases] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [streakStats, setStreakStats] = useState<{ individualStreaks: StreakStat[]; [key: string]: any } | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [gifts, setGifts] = useState<any[]>([])
  const [familyMembers, setFamilyMembers] = useState<any[]>([])
  
  // Challenge mode state
  const [choreChampions, setChoreChampions] = useState<Map<string, any>>(new Map())
  const [choreBids, setChoreBids] = useState<Map<string, Bid[]>>(new Map())
  const [choreStreaks, setChoreStreaks] = useState<Map<string, any>>(new Map())
  const [allChoreStreaks, setAllChoreStreaks] = useState<Map<string, any>>(new Map())
  
  // Holiday mode state
  const [holidayMode, setHolidayMode] = useState<HolidayMode>({
    isActive: false,
    isFamilyHoliday: false,
    startDate: '',
    endDate: '',
    message: '',
  })
  const holidayPrevActiveRef = useRef(false)
  const [isPaused, setIsPaused] = useState(false)

  const loadDashboard = useCallback(async () => {
    try {
      setError('')
      const childId = user?.childId || user?.id || ''

      const [
        walletRes,
        walletStatsRes,
        familyRes,
        familyMembersRes,
        assignmentsRes,
        completionsRes,
        rewardsRes,
        familyGiftsRes,
        leaderboardRes,
        streaksRes,
        transactionsRes,
        payoutsRes,
        redemptionsRes,
        starPurchasesRes,
        giftsRes,
      ] = await Promise.allSettled([
        apiClient.getWallet(childId),
        apiClient.getWalletStats(childId),
        apiClient.getFamily(),
        apiClient.getFamilyMembers(),
        apiClient.listAssignments(childId),
        apiClient.listCompletions(),
        apiClient.getRewards(childId),
        apiClient.getFamilyGifts({ childId, active: 'true' }),
        apiClient.getLeaderboard(),
        apiClient.getStreakStats(childId),
        apiClient.getTransactions(childId, 50),
        apiClient.getPayouts(childId),
        apiClient.getRedemptions(undefined, childId),
        apiClient.getStarPurchases(undefined, childId),
        apiClient.listGifts({ childId }),
      ])

      if (walletRes.status === 'fulfilled') {
        setWallet(walletRes.value.wallet)
      }
      if (walletStatsRes.status === 'fulfilled') {
        setWalletStats(walletStatsRes.value.stats)
      }
      if (familyRes.status === 'fulfilled') {
        const family = familyRes.value.family
        setFamilySettings(family)

        if (family) {
          const wasActive = holidayPrevActiveRef.current
          const now = new Date()
          const holidayEnabled = Boolean(family.holidayMode)
          const withinStart = !family.holidayStartDate || new Date(family.holidayStartDate) <= now
          const withinEnd = !family.holidayEndDate || new Date(family.holidayEndDate) >= now
          const isFamilyHolidayActive = holidayEnabled && withinStart && withinEnd

          if (isFamilyHolidayActive !== wasActive || isFamilyHolidayActive) {
            if (isFamilyHolidayActive) {
              const endDate = family.holidayEndDate ? new Date(family.holidayEndDate) : null
              let message = "It's holiday time! No chores today – enjoy your break!"
              if (endDate) {
                const millisLeft = endDate.getTime() - now.getTime()
                const daysLeft = Math.max(0, Math.ceil(millisLeft / (1000 * 60 * 60 * 24)))
                if (daysLeft > 0) {
                  message = `Holiday mode! ${daysLeft} day${daysLeft === 1 ? '' : 's'} left of your break!`
                }
              }

              setHolidayMode({
                isActive: true,
                isFamilyHoliday: true,
                startDate: family.holidayStartDate || '',
                endDate: family.holidayEndDate || '',
                message,
              })
            } else {
              setHolidayMode({
                isActive: false,
                isFamilyHoliday: false,
                startDate: '',
                endDate: '',
                message: '',
              })
            }

            holidayPrevActiveRef.current = isFamilyHolidayActive
          }
        }
      }
      if (familyMembersRes.status === 'fulfilled') {
        const members = familyMembersRes.value.members || []
        const children = familyMembersRes.value.children || []
        setFamilyMembers(members)

        const currentChild = children.find((child: { id: string; [key: string]: any }) => child.id === childId)
        if (currentChild) {
          setIsPaused(currentChild.paused || false)
        }
      }
      if (assignmentsRes.status === 'fulfilled') {
        const assignmentsList = assignmentsRes.value.assignments || []
        setAssignments(assignmentsList)

        // Load bids and streaks for challenge chores
        const challengeAssignments = assignmentsList.filter((a: Assignment) => a.biddingEnabled)
        const championsMap = new Map()
        const bidsMap = new Map()
        const streaksMap = new Map()

        const bidPromises = challengeAssignments.map(
          (assignment, index) =>
            new Promise((resolve) => {
              setTimeout(async () => {
                try {
                  const { bids } = await apiClient.listBids(assignment.id)
                  if (bids && bids.length > 0) {
                    resolve({ assignmentId: assignment.id, bids, champion: bids[0] })
                  } else {
                    resolve({ assignmentId: assignment.id, bids: [], champion: null })
                  }
                } catch (error) {
                  console.error('Failed to load bids for assignment:', assignment.id, error)
                  resolve({ assignmentId: assignment.id, bids: [], champion: null })
                }
              }, index * 100)
            }),
        )

        const bidResults = await Promise.all(bidPromises)

        bidResults.forEach((result: { bids: Bid[]; assignmentId: string; champion: any }) => {
          if (result.bids.length > 0) {
            bidsMap.set(result.assignmentId, result.bids)
            championsMap.set(result.assignmentId, result.champion)
          }
        })

        if (streaksRes.status === 'fulfilled' && streaksRes.value?.stats?.individualStreaks) {
          challengeAssignments.forEach((assignment) => {
            const choreStreak = streaksRes.value.stats.individualStreaks.find(
              (s: StreakStat) => s.chore?.id === assignment.chore?.id,
            )
            if (choreStreak && choreStreak.current > 0) {
              streaksMap.set(assignment.id, choreStreak)
            }
          })
        }

        setChoreChampions(championsMap)
        setChoreBids(bidsMap)
        setChoreStreaks(streaksMap)
      }
      if (completionsRes.status === 'fulfilled') {
        setCompletions(completionsRes.value.completions || [])
      }
      if (familyGiftsRes.status === 'fulfilled') {
        setFamilyGifts(familyGiftsRes.value.gifts || [])
      }
      if (redemptionsRes.status === 'fulfilled') {
        const allRedemptions = redemptionsRes.value.redemptions || []
        setRedemptions(allRedemptions)
        setPendingRedemptions(allRedemptions.filter((r: Redemption) => r.status === 'pending'))
        setRedemptionHistory(allRedemptions.filter((r: Redemption) => r.status === 'fulfilled' || r.status === 'rejected'))
      }
      if (starPurchasesRes.status === 'fulfilled') {
        const allPurchases = starPurchasesRes.value.purchases || []
        setStarPurchases(allPurchases)
        setPendingStarPurchases(allPurchases.filter((p: any) => p.status === 'pending'))
      }
      if (leaderboardRes.status === 'fulfilled') {
        const transformedLeaderboard = (leaderboardRes.value.leaderboard || []).map((entry: LeaderboardEntry) => ({
          ...entry,
          nickname: entry.child?.nickname || 'Unknown',
          ageGroup: entry.child?.ageGroup,
        }))
        setLeaderboard(transformedLeaderboard)
      }
      if (streaksRes.status === 'fulfilled') {
        setStreakStats(streaksRes.value.stats)

        if (streaksRes.value.stats?.individualStreaks) {
          const streaksByChore = new Map<string, any>()
          streaksRes.value.stats.individualStreaks.forEach((streak: StreakStat) => {
            if (streak.chore?.id && streak.current > 0) {
              streaksByChore.set(streak.chore.id, streak)
            }
          })
          setAllChoreStreaks(streaksByChore)
        } else {
          setAllChoreStreaks(new Map())
        }
      }
      if (transactionsRes.status === 'fulfilled') {
        setTransactions(transactionsRes.value.transactions || [])
      }
      if (payoutsRes.status === 'fulfilled') {
        setPayouts(payoutsRes.value.payouts || [])
      }
      if (giftsRes.status === 'fulfilled') {
        setGifts(giftsRes.value.gifts || [])
      }
    } catch (err: any) {
      const appError = handleApiError(err, 'Loading dashboard')
      console.error('Error loading dashboard:', appError)
      setError(appError.message)
    } finally {
      setIsLoading(false)
    }
  }, [user, activeTab])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  // WebSocket listeners for real-time updates
  useEffect(() => {
    if (!on || !off) {
      return
    }

    const relevant: NotificationType[] = [
      'completionUpdated',
      'redemptionUpdated',
      'assignmentUpdated',
      'choreUpdated',
      'giftUpdated',
      'familyUpdated',
    ]

    const handleCustomEvent = () => {
      void loadDashboard()
    }

    const handleStorage = (event: StorageEvent) => {
      if (!event.key) return
      if (relevant.some((type) => `${type}_updated` === event.key)) {
        void loadDashboard()
      }
    }

    const channel = getBroadcastChannel()
    const handleBroadcast = (event: MessageEvent<{ type?: NotificationType }>) => {
      if (event.data?.type && relevant.includes(event.data.type)) {
        void loadDashboard()
      }
    }

    // WebSocket event handlers
    const handleChoreCreated = () => {
      notifyUpdate('choreUpdated')
      void loadDashboard()
    }

    const handleAssignmentCreated = () => {
      notifyUpdate('assignmentUpdated')
      void loadDashboard()
    }

    const handleAssignmentDeleted = () => {
      notifyUpdate('assignmentUpdated')
      void loadDashboard()
    }

    const handleChoreUpdated = () => {
      notifyUpdate('choreUpdated')
      void loadDashboard()
    }

    const handleCompletionApproved = () => {
      notifyUpdate('completionUpdated')
      void loadDashboard()
    }

    const handleCompletionRejected = () => {
      notifyUpdate('completionUpdated')
      void loadDashboard()
    }

    const handleRedemptionCreated = () => {
      notifyUpdate('redemptionUpdated')
      void loadDashboard()
    }

    const handleRedemptionFulfilled = () => {
      notifyUpdate('redemptionUpdated')
      void loadDashboard()
    }

    const handleRedemptionRejected = () => {
      notifyUpdate('redemptionUpdated')
      void loadDashboard()
    }

    const handleGiftCreated = () => {
      notifyUpdate('giftUpdated')
      void loadDashboard()
    }

    const handleGiftUpdated = () => {
      notifyUpdate('giftUpdated')
      void loadDashboard()
    }

    const handleStarPurchaseApproved = () => {
      notifyUpdate('redemptionUpdated')
      void loadDashboard()
    }

    const handleStarPurchaseRejected = () => {
      notifyUpdate('redemptionUpdated')
      void loadDashboard()
    }

    const handleFamilySettingsUpdated = (data: any) => {
      notifyUpdate('familyUpdated')
      const familyData = data.family
      if (familyData) {
        setFamilySettings((prev: any) => {
          if (!prev) return familyData
          return { ...prev, ...familyData }
        })
      }
    }

    const handleChildPauseUpdated = () => {
      notifyUpdate('familyUpdated')
      void loadDashboard()
    }

    // Register event listeners
    relevant.forEach((type) => window.addEventListener(type, handleCustomEvent))
    window.addEventListener('storage', handleStorage)
    channel?.addEventListener('message', handleBroadcast)

    on('chore:created', handleChoreCreated)
    on('assignment:created', handleAssignmentCreated)
    on('assignment:deleted', handleAssignmentDeleted)
    on('chore:updated', handleChoreUpdated)
    on('completion:approved', handleCompletionApproved)
    on('completion:rejected', handleCompletionRejected)
    on('redemption:created', handleRedemptionCreated)
    on('redemption:fulfilled', handleRedemptionFulfilled)
    on('redemption:rejected', handleRedemptionRejected)
    on('gift:created', handleGiftCreated)
    on('gift:updated', handleGiftUpdated)
    on('starPurchase:approved', handleStarPurchaseApproved)
    on('starPurchase:rejected', handleStarPurchaseRejected)
    on('family:settings:updated', handleFamilySettingsUpdated)
    on('child:pause:updated', handleChildPauseUpdated)

    return () => {
      relevant.forEach((type) => window.removeEventListener(type, handleCustomEvent))
      window.removeEventListener('storage', handleStorage)
      channel?.removeEventListener('message', handleBroadcast)

      off('chore:created', handleChoreCreated)
      off('assignment:created', handleAssignmentCreated)
      off('assignment:deleted', handleAssignmentDeleted)
      off('chore:updated', handleChoreUpdated)
      off('completion:approved', handleCompletionApproved)
      off('completion:rejected', handleCompletionRejected)
      off('redemption:created', handleRedemptionCreated)
      off('redemption:fulfilled', handleRedemptionFulfilled)
      off('redemption:rejected', handleRedemptionRejected)
      off('gift:created', handleGiftCreated)
      off('gift:updated', handleGiftUpdated)
      off('starPurchase:approved', handleStarPurchaseApproved)
      off('starPurchase:rejected', handleStarPurchaseRejected)
      off('family:settings:updated', handleFamilySettingsUpdated)
      off('child:pause:updated', handleChildPauseUpdated)
    }
  }, [on, off, loadDashboard])

  const loadBidsForAssignment = useCallback(async (assignmentId: string): Promise<Bid[]> => {
    try {
      const { bids } = await apiClient.listBids(assignmentId)
      return bids || []
    } catch (error) {
      console.error('Failed to load bids for assignment:', assignmentId, error)
      return []
    }
  }, [])

  return {
    isLoading,
    error,
    wallet,
    walletStats,
    familySettings,
    assignments,
    completions,
    familyGifts,
    redemptions,
    pendingRedemptions,
    redemptionHistory,
    starPurchases,
    pendingStarPurchases,
    leaderboard,
    streakStats,
    transactions,
    payouts,
    gifts,
    familyMembers,
    choreChampions,
    choreBids,
    choreStreaks,
    allChoreStreaks,
    holidayMode,
    isPaused,
    refresh: loadDashboard,
    loadBidsForAssignment,
  }
}


