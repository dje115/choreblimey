import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api'
import { formatCurrency } from '../utils/currency'
import { notifyUpdate } from '../utils/notifications'
import { useRealtimeUpdates } from '../hooks/useRealtimeUpdates'
import { useSocket } from '../contexts/SocketContext'
import { handleApiError } from '../utils/errorHandler'
import Toast from '../components/Toast'
import Confetti from '../components/Confetti'
import { childThemes, getTheme, applyTheme, type ChildTheme } from '../themes/childThemes'
import { FamilyChat } from '../components/FamilyChat'

interface Wallet {
  balancePence: number
  transactions: Array<{
    id: string
    type: 'credit' | 'debit'
    amountPence: number
    source?: string
    note?: string
    createdAt: string
  }>
}

interface Chore {
  id: string
  title: string
  description?: string
  frequency: 'daily' | 'weekly' | 'once'
  proof: 'none' | 'photo' | 'note'
  baseRewardPence: number
  minBidPence?: number
  maxBidPence?: number
  active: boolean
}

interface Reward {
  id: string
  title: string
  description?: string
  type: 'affiliate' | 'custom'
  starsRequired: number
  amazonUrl?: string
  daysOutUrl?: string
  affiliateTag?: string
  imageUrl?: string
  category?: string
  pricePence?: number
  active?: boolean
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

interface LeaderboardEntry {
  childId: string
  nickname: string
  totalStars: number
}

interface Assignment {
  id: string
  choreId: string
  childId?: string | null
  biddingEnabled?: boolean
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
  reward?: Reward
  approvedByUser?: {
    id: string
    email: string
  }
  rejectedByUser?: {
    id: string
    email: string
  }
  [key: string]: any
}

interface FamilyMember {
  id: string
  role: string
  user?: {
    id: string
    email: string
  }
  displayName?: string
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

interface Transaction {
  id: string
  type: 'credit' | 'debit'
  amountPence: number
  source?: string
  note?: string
  createdAt: string
  [key: string]: any
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

interface WalletStats {
  totalEarned: number
  totalSpent: number
  [key: string]: any
}

type Tab = 'today' | 'streaks' | 'shop' | 'showdown' | 'bank' | 'chat'

const ChildDashboard: React.FC = () => {
  const { user, logout } = useAuth()
  
  /**
   * Notifies parent dashboard of completion updates
   * Uses shared notification utility for cross-tab communication
   */
  const notifyParentDashboard = () => {
    notifyUpdate('completionUpdated')
  }
  const [isLoading, setIsLoading] = useState(true)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [walletStats, setWalletStats] = useState<WalletStats | null>(null)
  const [familySettings, setFamilySettings] = useState<any>(null)
  const [chores, setChores] = useState<Chore[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [familyGifts, setFamilyGifts] = useState<FamilyGift[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [pendingRedemptions, setPendingRedemptions] = useState<Redemption[]>([])
  const [redemptionHistory, setRedemptionHistory] = useState<Redemption[]>([])
  const [selectedGiftForRedemption, setSelectedGiftForRedemption] = useState<FamilyGift | null>(null)
  const [showRedemptionModal, setShowRedemptionModal] = useState(false)
  const [starPurchases, setStarPurchases] = useState<any[]>([])
  const [pendingStarPurchases, setPendingStarPurchases] = useState<any[]>([])
  const [buyStarsAmount, setBuyStarsAmount] = useState(1)
  const [buyingStars, setBuyingStars] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [streakStats, setStreakStats] = useState<{ individualStreaks: StreakStat[]; [key: string]: any } | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [gifts, setGifts] = useState<any[]>([]) // Gift records (money/star gifts from adults)
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [error, setError] = useState<string>('')
  const [unreadChatCount, setUnreadChatCount] = useState(0) // Track unread chat messages
  const [lastReadChatTime, setLastReadChatTime] = useState<number>(Date.now()) // Track when chat was last viewed
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [activeTab, setActiveTab] = useState<Tab>('today')
  
  // Holiday mode state
  const [holidayMode, setHolidayMode] = useState({
    isActive: false,
    isFamilyHoliday: false,
    startDate: '',
    endDate: '',
    message: '',
  })
  const holidayPrevActiveRef = useRef(false)
  
  // Toast & Confetti
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  
  // Completion modal state
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null)
  const [completionNote, setCompletionNote] = useState('')
  const [completingChore, setCompletingChore] = useState(false)

  // Reward claiming state
  const [claimingReward, setClaimingReward] = useState<string | null>(null)

  // Challenge mode: Track who's the champion for each chore and all bids
  const [choreChampions, setChoreChampions] = useState<Map<string, any>>(new Map())
  const [choreBids, setChoreBids] = useState<Map<string, Array<{ id: string; childId: string; amountPence: number; [key: string]: any }>>>(new Map())
  const [choreStreaks, setChoreStreaks] = useState<Map<string, any>>(new Map())
  const [allChoreStreaks, setAllChoreStreaks] = useState<Map<string, any>>(new Map()) // Streaks for all chores (not just challenge)

  // Theme management
  const [currentTheme, setCurrentTheme] = useState<ChildTheme>(getTheme('superhero'))
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [childProfile, setChildProfile] = useState<any>(null)

  // Detect age mode from user profile
  const getAgeMode = (): 'kid' | 'tween' | 'teen' => {
    const age = user?.ageGroup
    if (age === '12-15') return 'teen'
    if (age === '9-11') return 'tween'
    return 'kid' // Default to kid for 5-8 or undefined
  }
  
  const ageMode = getAgeMode()
  const isTeen = ageMode === 'teen'

  // Define loadDashboard FIRST so it can be used in hooks
  const loadDashboard = useCallback(async () => {
    try {
      setError('')
      const childId = user?.childId || user?.id || ''

      const [walletRes, walletStatsRes, familyRes, familyMembersRes, assignmentsRes, completionsRes, rewardsRes, familyGiftsRes, leaderboardRes, streaksRes, transactionsRes, payoutsRes, redemptionsRes, starPurchasesRes, giftsRes] = await Promise.allSettled([
        apiClient.getWallet(childId),
        apiClient.getWalletStats(childId),
        apiClient.getFamily(),
        apiClient.getFamilyMembers(),
        apiClient.listAssignments(childId),
        apiClient.listCompletions(), // Get all completions - we'll filter by status (only approved = completed)
        apiClient.getRewards(childId), // Keep for backward compatibility
        apiClient.getFamilyGifts({ childId, active: 'true' }), // New: Get family gifts
        apiClient.getLeaderboard(),
        apiClient.getStreakStats(childId),
        apiClient.getTransactions(childId, 50),
        apiClient.getPayouts(childId), // Get payouts to show who paid
        apiClient.getRedemptions(undefined, childId), // Get all redemptions for this child
        apiClient.getStarPurchases(undefined, childId), // Get all star purchases for this child
        apiClient.listGifts({ childId }) // Get Gift records (money/star gifts from adults)
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
        
        // If shop is disabled and user is on shop tab, switch to today tab
        if (family && family.giftsEnabled === false && activeTab === 'shop') {
          setActiveTab('today')
        }

        if (family) {
          const wasActive = holidayPrevActiveRef.current
          const now = new Date()
          const holidayEnabled = Boolean(family.holidayMode)
          const withinStart = !family.holidayStartDate || new Date(family.holidayStartDate) <= now
          const withinEnd = !family.holidayEndDate || new Date(family.holidayEndDate) >= now
          const isFamilyHolidayActive = holidayEnabled && withinStart && withinEnd

          const isHolidayActive = isFamilyHolidayActive

          // Only update holiday mode state if it's different from current state
          // This prevents unnecessary re-renders and overwriting WebSocket updates
          if (isHolidayActive !== wasActive || isHolidayActive) {
            if (isHolidayActive) {
              const endDate = family.holidayEndDate ? new Date(family.holidayEndDate) : null
              let message = "It's holiday time! No chores today – enjoy your break!"
              if (endDate) {
                const millisLeft = endDate.getTime() - now.getTime()
                const daysLeft = Math.max(0, Math.ceil(millisLeft / (1000 * 60 * 60 * 24)))
                if (daysLeft > 0) {
                  message = `Holiday mode! ${daysLeft} day${daysLeft === 1 ? '' : 's'} left of your break!`
                }
              }

              console.log('🌴 loadDashboard: Setting holiday mode to ACTIVE')
              setHolidayMode({
                isActive: true,
                isFamilyHoliday: true,
                startDate: family.holidayStartDate || '',
                endDate: family.holidayEndDate || '',
                message,
              })
            } else {
              if (wasActive) {
                console.log('🌴 loadDashboard: Holiday mode ended; setting to INACTIVE')
              }
              setHolidayMode({
                isActive: false,
                isFamilyHoliday: false,
                startDate: '',
                endDate: '',
                message: '',
              })
            }

            holidayPrevActiveRef.current = isHolidayActive
          }
        }
      }
      if (familyMembersRes.status === 'fulfilled') {
        const members = familyMembersRes.value.members || []
        const children = familyMembersRes.value.children || []
        
        // Store family members for payout display
        setFamilyMembers(members)
        
        // Look for child in the children array, not members array
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
        
        // Load all bids in parallel with a delay between each to avoid rate limiting
        const bidPromises = challengeAssignments.map((assignment, index) => 
          new Promise(resolve => {
            // Stagger requests by 100ms each to avoid rate limiting
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
            }, index * 100) // 100ms delay between each request
          })
        )
        
        const bidResults = await Promise.all(bidPromises)
        
        // Process results
        bidResults.forEach((result: { bids: Array<{ id: string; childId: string; amountPence: number; [key: string]: any }> }) => {
          if (result.bids.length > 0) {
            bidsMap.set(result.assignmentId, result.bids)
            championsMap.set(result.assignmentId, result.champion)
          }
        })
        
        // Check streak data
        if (streaksRes.status === 'fulfilled' && streaksRes.value?.stats?.individualStreaks) {
          challengeAssignments.forEach(assignment => {
            const choreStreak = streaksRes.value.stats.individualStreaks.find((s: StreakStat) => s.chore?.id === assignment.chore?.id)
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
      if (rewardsRes.status === 'fulfilled') {
        setRewards(rewardsRes.value.rewards || [])
      }
      
      // Handle family gifts
      if (familyGiftsRes.status === 'fulfilled') {
        setFamilyGifts(familyGiftsRes.value.gifts || [])
      }
      
      // Handle redemptions
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
        // Transform leaderboard data to flatten child object
        const transformedLeaderboard = (leaderboardRes.value.leaderboard || []).map((entry: LeaderboardEntry) => ({
          ...entry,
          nickname: entry.child?.nickname || 'Unknown',
          ageGroup: entry.child?.ageGroup
        }))
        setLeaderboard(transformedLeaderboard)
      }
      if (streaksRes.status === 'fulfilled') {
        console.log('🔥 STREAK STATS RECEIVED:', streaksRes.value.stats)
        console.log('🔥 Current Streak:', streaksRes.value.stats?.currentStreak)
        setStreakStats(streaksRes.value.stats)
        
        // Build map of streaks by choreId for all chores (to show flames on missions)
        if (streaksRes.value.stats?.individualStreaks) {
          const streaksByChore = new Map<string, any>()
          streaksRes.value.stats.individualStreaks.forEach((streak: StreakStat) => {
            if (streak.chore?.id && streak.current > 0) {
              streaksByChore.set(streak.chore.id, streak)
            }
          })
          setAllChoreStreaks(streaksByChore)
        } else {
          // Fallback: try to get streaks from the streakStats object if structured differently
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
  }, [user, activeTab]) // Dependencies: user and activeTab

  // Initialize dashboard on mount
  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  // WebSocket connection for real-time updates
  const { socket, isConnected, on, off } = useSocket()

  /**
   * Listen for updates via WebSocket
   * This works across all devices, browsers, and tabs
   */
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('🔌 WebSocket not connected, skipping event listeners')
      return
    }

    console.log('👂 Setting up WebSocket listeners for child dashboard')

    // Listen for chore created (parent creates new chore)
    const handleChoreCreated = (data: any) => {
      console.log('📢 WebSocket: chore:created received', data)
      console.log('🔄 Refreshing child dashboard...')
      loadDashboard()
    }

    // Listen for assignment created (parent assigns chore to child)
    const handleAssignmentCreated = (data: any) => {
      console.log('📢 WebSocket: assignment:created received', data)
      console.log('🔄 Refreshing child dashboard...')
      loadDashboard()
    }

    // Listen for assignment deleted (parent removes chore assignment)
    const handleAssignmentDeleted = (data: any) => {
      console.log('📢 WebSocket: assignment:deleted received', data)
      console.log('🔄 Refreshing child dashboard...')
      loadDashboard()
    }

    // Listen for chore updated (parent updates chore details)
    const handleChoreUpdated = (data: any) => {
      console.log('📢 WebSocket: chore:updated received', data)
      console.log('🔄 Refreshing child dashboard...')
      loadDashboard()
    }

    // Listen for completion approved (parent approves, child needs to see wallet update)
    const handleCompletionApproved = (data: any) => {
      console.log('📢 WebSocket: completion:approved received', data)
      console.log('🔄 Refreshing child dashboard...')
      loadDashboard()
    }

    // Listen for completion rejected (parent rejects, child needs to see status)
    const handleCompletionRejected = (data: any) => {
      console.log('📢 WebSocket: completion:rejected received', data)
      console.log('🔄 Refreshing child dashboard...')
      loadDashboard()
    }

    // Listen for redemption created (child redeems gift)
    const handleRedemptionCreated = (data: any) => {
      console.log('📢 WebSocket: redemption:created received', data)
      console.log('🔄 Refreshing child dashboard...')
      loadDashboard()
    }

    // Listen for redemption fulfilled (parent fulfills redemption)
    const handleRedemptionFulfilled = (data: any) => {
      console.log('📢 WebSocket: redemption:fulfilled received', data)
      console.log('🔄 Refreshing child dashboard...')
      loadDashboard()
    }

    // Listen for redemption rejected (parent rejects redemption, stars refunded)
    const handleRedemptionRejected = (data: any) => {
      console.log('📢 WebSocket: redemption:rejected received', data)
      console.log('🔄 Refreshing child dashboard...')
      loadDashboard()
    }

    // Listen for gift created/updated (parent adds/updates gifts)
    const handleGiftCreated = (data: any) => {
      console.log('📢 WebSocket: gift:created received', data)
      console.log('🔄 Refreshing child dashboard...')
      loadDashboard()
    }

    const handleGiftUpdated = (data: any) => {
      console.log('📢 WebSocket: gift:updated received', data)
      console.log('🔄 Refreshing child dashboard...')
      loadDashboard()
    }

    // Listen for star purchase approved (parent approves, child needs to see wallet update)
    const handleStarPurchaseApproved = (data: any) => {
      console.log('📢 WebSocket: starPurchase:approved received', data)
      console.log('🔄 Refreshing child dashboard...')
      loadDashboard()
    }

    // Listen for star purchase rejected (parent rejects, child needs to see wallet update)
    const handleStarPurchaseRejected = (data: any) => {
      console.log('📢 WebSocket: starPurchase:rejected received', data)
      console.log('🔄 Refreshing child dashboard...')
      loadDashboard()
    }

    // Listen for family settings updated (holiday mode, shop enable/disable, streak settings)
    const handleFamilySettingsUpdated = (data: any) => {
      console.log('📢 WebSocket: family:settings:updated received on CHILD dashboard', data)
      console.log('📢 Full event data:', JSON.stringify(data, null, 2))
      const familyData = data.family
      console.log('📢 Extracted familyData:', familyData)
      
      if (familyData) {
        // Update family settings immediately
        setFamilySettings((prev: any) => ({
          ...prev,
          ...familyData
        }))
        
        // Update holiday mode state immediately from WebSocket data
        const now = new Date()
        const holidayEnabled = Boolean(familyData.holidayMode)
        const startDate = familyData.holidayStartDate ? new Date(familyData.holidayStartDate) : null
        const endDate = familyData.holidayEndDate ? new Date(familyData.holidayEndDate) : null
        const withinStart = !startDate || startDate <= now
        const withinEnd = !endDate || endDate >= now
        const isFamilyHolidayActive = holidayEnabled && withinStart && withinEnd
        
        if (isFamilyHolidayActive) {
          const endDateObj = endDate
          let message = "It's holiday time! No chores today – enjoy your break!"
          if (endDateObj) {
            const millisLeft = endDateObj.getTime() - now.getTime()
            const daysLeft = Math.max(0, Math.ceil(millisLeft / (1000 * 60 * 60 * 24)))
            if (daysLeft > 0) {
              message = `Holiday mode! ${daysLeft} day${daysLeft === 1 ? '' : 's'} left of your break!`
            }
          }
          
          console.log('🌴 Updating holiday mode state to ACTIVE via WebSocket')
          setHolidayMode({
            isActive: true,
            isFamilyHoliday: true,
            startDate: familyData.holidayStartDate || '',
            endDate: familyData.holidayEndDate || '',
            message,
          })
          holidayPrevActiveRef.current = true
        } else {
          console.log('🌴 Updating holiday mode state to INACTIVE via WebSocket')
          setHolidayMode({
            isActive: false,
            isFamilyHoliday: false,
            startDate: '',
            endDate: '',
            message: '',
          })
          holidayPrevActiveRef.current = false
        }
      }
      
      // Don't call loadDashboard here - it will overwrite optimistic updates
      // The state has already been updated above, and loadDashboard will be called
      // by the fallback polling system if needed
    }

    // Listen for child pause status updated (individual child holiday mode)
    const handleChildPauseUpdated = (data: any) => {
      console.log('📢 WebSocket: child:pause:updated received', data)
      console.log('🔄 Refreshing child dashboard...')
      loadDashboard()
    }

    // Listen for chat messages (to track unread count)
    const handleChatMessage = (data: any) => {
      console.log('📢 WebSocket: chat:message received in child dashboard', data)
      // Only increment unread count if chat tab is not active
      if (activeTab !== 'chat') {
        setUnreadChatCount((prev) => prev + 1)
      }
    }

    // Register listeners
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
    on('chat:message', handleChatMessage)

    // Cleanup
    return () => {
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
      off('chat:message', handleChatMessage)
    }
  }, [socket, isConnected, on, off, loadDashboard, activeTab])

  // Fallback: Keep existing client-side system as backup
  useRealtimeUpdates({
    eventTypes: ['choreUpdated', 'redemptionUpdated'],
    onUpdate: () => {
      console.log('🔄 Child dashboard: Update detected (fallback), refreshing...')
      loadDashboard()
    },
    enablePolling: true,
    pollingInterval: 5000, // Poll every 5 seconds as fallback
    useVisibilityAPI: true
  })

  // Load and apply theme from localStorage or use default
  useEffect(() => {
    const loadChildTheme = () => {
      try {
        const childId = user?.childId || user?.id
        const savedThemeId = localStorage.getItem(`child_theme_${childId}`) || 'superhero'
        const theme = getTheme(savedThemeId)
        setCurrentTheme(theme)
        applyTheme(theme)
      } catch (error) {
        console.error('Failed to load child theme:', error)
        // Fallback to default theme
        const theme = getTheme('superhero')
        setCurrentTheme(theme)
        applyTheme(theme)
      }
    }
    
    if (user) {
      loadChildTheme()
    }
  }, [user])

  // Apply theme when it changes
  useEffect(() => {
    applyTheme(currentTheme)
  }, [currentTheme])

  const handleMarkAsDone = (assignment: Assignment) => {
    setSelectedAssignment(assignment)
    setCompletionNote('')
    setShowCompletionModal(true)
  }

  const handleSubmitCompletion = async () => {
    if (!selectedAssignment) return

    try {
      setCompletingChore(true)
      await apiClient.createCompletion({
        assignmentId: selectedAssignment.id,
        note: completionNote || undefined
      })

      setShowCompletionModal(false)
      setSelectedAssignment(null)
      setCompletionNote('')
      
      // Show success toast
      setToast({ message: '✨ Nice work! Submitted for approval', type: 'success' })
      
      // Notify parent dashboard IMMEDIATELY (before reload)
      // This ensures instant update on parent dashboard
      notifyParentDashboard()
      
      // Small delay to ensure DB is updated, then reload
      await new Promise(resolve => setTimeout(resolve, 300))
      await loadDashboard()
    } catch (error) {
      const appError = handleApiError(error, 'Submitting completion')
      console.error('Failed to submit completion:', appError)
      setToast({ message: appError.message, type: 'error' })
    } finally {
      setCompletingChore(false)
    }
  }

  const handleClaimReward = async (reward: Reward) => {
    if (!user?.childId && !user?.id) return
    
    const childId = user.childId || user.id
    
    try {
      setClaimingReward(reward.id)
      await apiClient.redeemReward({
        rewardId: reward.id,
        childId
      })

      // Reload dashboard to update wallet and rewards
      await loadDashboard()
      
      // Show success with confetti celebration!
      setShowConfetti(true)
      setToast({ message: `🎉 ${reward.title} claimed! Ask your parent to get it for you`, type: 'success' })
      setTimeout(() => setShowConfetti(false), 2000)
    } catch (error: any) {
      const appError = handleApiError(error, 'Claiming reward')
      console.error('Failed to claim reward:', appError)
      setToast({ message: appError.message, type: 'error' })
    } finally {
      setClaimingReward(null)
    }
  }

  const handleRedeemGift = async () => {
    if (!selectedGiftForRedemption || !user?.childId && !user?.id) return
    
    const childId = user.childId || user.id
    
    try {
      setClaimingReward(selectedGiftForRedemption.id)
      
      // Optimistically update stars immediately (before API call)
      if (wallet) {
        setWallet({
          ...wallet,
          stars: Math.max(0, wallet.stars - selectedGiftForRedemption.starsRequired)
        })
      }
      
      await apiClient.redeemReward({
        familyGiftId: selectedGiftForRedemption.id,
        childId
      })

      // Close modal first
      setShowRedemptionModal(false)
      setSelectedGiftForRedemption(null)
      
      // Show success with confetti celebration!
      setShowConfetti(true)
      setToast({ message: `🎉 ${selectedGiftForRedemption.title} redeemed! Ask your parent to get it for you`, type: 'success' })
      setTimeout(() => setShowConfetti(false), 2000)
      
      // Reload dashboard to sync with server (get updated wallet, redemptions, etc.)
      await loadDashboard()
    } catch (error: any) {
      const appError = handleApiError(error, 'Redeeming gift')
      console.error('Failed to redeem gift:', appError)
      
      // Revert optimistic update on error
      if (wallet) {
        setWallet({
          ...wallet,
          stars: wallet.stars + selectedGiftForRedemption.starsRequired
        })
      }
      
      setToast({ message: appError.message, type: 'error' })
    } finally {
      setClaimingReward(null)
    }
  }

  const totalStars = wallet?.stars || 0

  // Calculate split values for banner display
  const calculateBannerStats = () => {
    let earnedMoneyUnpaidPence = 0  // Money earned from chores that hasn't been paid out
    let giftedMoneyUnpaidPence = 0  // Money gifted that is pending (unpaid)
    let totalPaidOutPence = 0  // Total amount paid out
    let earnedStars = 0
    let giftedStars = 0
    
    // Calculate total paid out from chores (not including gifts)
    // Each payout has choreAmountPence which tells us how much was from chores
    let totalChorePaidOutPence = 0
    if (payouts && payouts.length > 0) {
      totalChorePaidOutPence = payouts.reduce((sum: number, p: any) => {
        // If choreAmountPence is set, use it; otherwise, if no gifts were paid, the full amount was from chores
        if (p.choreAmountPence !== null && p.choreAmountPence !== undefined) {
          return sum + p.choreAmountPence
        }
        // Legacy payouts: if no giftIds, assume all was from chores
        if (!p.giftIds || p.giftIds.length === 0) {
          return sum + (p.amountPence || 0)
        }
        // If gifts were paid but no choreAmountPence, assume 0 from chores (all was gifts)
        return sum
      }, 0)
      // Also calculate total paid out for display
      totalPaidOutPence = payouts.reduce((sum: number, p: any) => sum + (p.amountPence || 0), 0)
    }
    
    // Calculate total earned money from all credit transactions (excluding gifts)
    let totalEarnedMoneyPence = 0
    transactions.forEach((tx: any) => {
      const meta = typeof tx.metaJson === 'string' ? JSON.parse(tx.metaJson) : (tx.metaJson || {})
      
      if (tx.type === 'credit') {
        if (meta.type === 'gift_stars') {
          // Gifted stars (always count all gifted stars)
          giftedStars += meta.starsAmount || 0
        } else if (meta.type === 'gift_money') {
          // Gifted money - check if the gift is still pending
          // Find the gift record by giftId to check its actual status
          const giftRecord = gifts.find((g: any) => g.id === meta.giftId)
          if (giftRecord && giftRecord.status === 'pending') {
            giftedMoneyUnpaidPence += tx.amountPence
          }
        } else if (meta.completionId || meta.type === 'streak_bonus' || meta.type === 'rivalry_bonus') {
          // Earned from chores/completions - count all earned money
          totalEarnedMoneyPence += tx.amountPence
        }
      }
    })
    
    // Unpaid earned money = total earned - total paid out from chores only
    // Note: wallet.balancePence should equal earned money unpaid (since gift money isn't in balance until paid out)
    // But we'll calculate it from transactions to be safe
    earnedMoneyUnpaidPence = Math.max(0, totalEarnedMoneyPence - totalChorePaidOutPence)
    
    // Calculate earned stars: total stars minus gifted stars
    // This accounts for stars earned from chores that might have starsOverride
    giftedStars = transactions.reduce((sum: number, tx: any) => {
      const meta = typeof tx.metaJson === 'string' ? JSON.parse(tx.metaJson) : (tx.metaJson || {})
      if (tx.type === 'credit' && meta.type === 'gift_stars') {
        return sum + (meta.starsAmount || 0)
      }
      return sum
    }, 0)
    
    earnedStars = Math.max(0, totalStars - giftedStars)
    
    // Owed = earned money unpaid + gifted money unpaid
    const owedPence = earnedMoneyUnpaidPence + giftedMoneyUnpaidPence
    
    return {
      owedPence,
      earnedMoneyUnpaidPence,
      giftedMoneyUnpaidPence,
      earnedStars,
      giftedStars,
      lifetimeEarningsPence: walletStats?.lifetimeEarningsPence || 0
    }
  }
  
  const bannerStats = calculateBannerStats()

  const handleThemeChange = async (themeId: string) => {
    try {
      const theme = getTheme(themeId)
      setCurrentTheme(theme)
      applyTheme(theme)
      
      // Save theme preference to localStorage and backend
      const childId = user?.childId || user?.id
      if (childId) {
        // Save to localStorage immediately
        localStorage.setItem(`child_theme_${childId}`, themeId)
        
        // Try to save to backend (non-blocking)
        try {
          await apiClient.updateChild(childId, { theme: themeId })
        } catch (backendError) {
          console.warn('Failed to save theme to backend, but saved locally:', backendError)
        }
        
        setToast({ message: `🎨 Theme changed to ${theme.name}!`, type: 'success' })
      }
      
      setShowThemePicker(false)
    } catch (error) {
      const appError = handleApiError(error, 'Changing theme')
      console.error('Failed to change theme:', appError)
      setToast({ message: appError.message, type: 'error' })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--primary)] border-t-transparent mx-auto mb-4"></div>
          <p className="cb-body">Loading your chores...</p>
        </div>
      </div>
    )
  }

  // Show paused message if child is paused
  if (isPaused) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8 border-4 border-yellow-200">
            <div className="text-8xl mb-6">⏸️</div>
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Oh Blimey!</h1>
            <h2 className="text-xl font-semibold text-yellow-600 mb-6">Chores are on pause!</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Your account has been temporarily paused. This means you can't complete chores or earn rewards right now.
            </p>
            <div className="bg-yellow-100 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                <strong>Don't worry!</strong> Your parent can unpause your account anytime. 
                All your progress and stars are safe! 🌟
              </p>
            </div>
            <div className="text-4xl mb-4">😴</div>
            <p className="text-gray-500 text-sm">
              Check back later or ask your parent to unpause your account!
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)] pb-24 sm:pb-6">
      {/* Hero Banner */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[var(--primary)] via-[var(--secondary)] to-[var(--primary)] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-20 h-20 bg-white rounded-full animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-32 h-32 bg-white rounded-full animate-pulse delay-100"></div>
          <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-white rounded-full animate-pulse delay-200"></div>
        </div>
        
        <div className="relative container mx-auto px-4 py-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold mb-2" style={{ fontFamily: "'Baloo 2', cursive" }}>
                Hey {user?.nickname || 'Champion'}! 🌟
                {holidayMode.isActive && (
                  <span className="ml-3 text-3xl animate-bounce" title="Holiday mode active">🌴</span>
                )}
              </h1>
              <p className="text-white/90 text-lg">
                {holidayMode.isActive ? 'Enjoy your holiday break!' : 'Time to earn those stars!'}
              </p>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => setShowThemePicker(true)}
                className="min-h-[44px] px-4 py-3 sm:px-4 sm:py-2 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full font-semibold text-sm sm:text-base backdrop-blur transition-all touch-manipulation flex items-center justify-center"
                title="Change Theme"
              >
                {currentTheme.emoji} Theme
              </button>
              <button
                onClick={logout}
                className="min-h-[44px] px-4 py-3 sm:px-4 sm:py-2 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full font-semibold text-sm sm:text-base backdrop-blur transition-all touch-manipulation flex items-center justify-center"
              >
                👋 Logout
              </button>
            </div>
          </div>

          {/* Star Bank Card */}
          <div className="bg-white/10 backdrop-blur-md border-2 border-white/20 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white/80 text-sm font-semibold uppercase tracking-wide">Your Star Bank</p>
                <p className="text-6xl font-bold mt-2">{totalStars}⭐</p>
                <p className="text-white/70 text-sm mt-1">£{(bannerStats.owedPence / 100).toFixed(2)} owed</p>
              </div>
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-4xl animate-pulse">
                💰
              </div>
            </div>
            <div className={`grid gap-3 text-sm ${familySettings?.showLifetimeEarnings !== false ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-7' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-white/70 text-xs">Owed</p>
                <p className="font-bold text-lg">£{(bannerStats.owedPence / 100).toFixed(2)}</p>
                <p className="text-white/60 text-[10px]">Earned + Gifted unpaid</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-white/70 text-xs">Earned</p>
                <p className="font-bold text-lg">£{(bannerStats.earnedMoneyUnpaidPence / 100).toFixed(2)}</p>
                <p className="text-white/60 text-[10px]">From chores unpaid</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-white/70 text-xs">Gifted</p>
                <p className="font-bold text-lg">£{(bannerStats.giftedMoneyUnpaidPence / 100).toFixed(2)}</p>
                <p className="text-white/60 text-[10px]">Money gifted unpaid</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-white/70 text-xs">Stars Earned</p>
                <p className="font-bold text-lg">{bannerStats.earnedStars}⭐</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-white/70 text-xs">Stars Gifted</p>
                <p className="font-bold text-lg">{bannerStats.giftedStars}⭐</p>
              </div>
              {familySettings?.showLifetimeEarnings !== false && (
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-white/70 text-xs">Lifetime Earned</p>
                  <p className="font-bold text-lg">£{(bannerStats.lifetimeEarningsPence / 100).toFixed(2)}</p>
                </div>
              )}
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-white/70 text-xs">Streak</p>
                <p className="font-bold text-lg">🔥 {streakStats?.currentStreak || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {holidayMode.isActive && (
        <div className="bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 text-white py-4 px-4">
          <div className="container mx-auto flex items-center justify-center gap-3 text-center">
            <div className="text-4xl animate-bounce">🌴</div>
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold mb-1">Holiday mode is active!</h2>
              <p className="text-sm sm:text-base opacity-90">{holidayMode.message}</p>
            </div>
            <div className="text-4xl animate-bounce delay-100">😎</div>
          </div>
        </div>
      )}

      {/* Tab Navigation - now responsive across all breakpoints */}
      <div className="sticky top-0 z-30 bg-white border-b-2 border-[var(--card-border)] shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3 overflow-x-auto py-3 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide justify-center">
            {[
              { id: 'today' as Tab, label: 'Today', icon: '📅' },
              { id: 'streaks' as Tab, label: 'Streaks', icon: '🔥' },
              ...(familySettings?.giftsEnabled !== false ? [{ id: 'shop' as Tab, label: 'Shop', icon: '🛍️' }] : []),
              { id: 'showdown' as Tab, label: 'Showdown', icon: '⚔️' },
              { id: 'bank' as Tab, label: 'Bank', icon: '🏦' },
              { id: 'chat' as Tab, label: 'Chat', icon: '💬' }
            ].map((tab) => {
              const hasUnread = tab.id === 'chat' && unreadChatCount > 0
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    // Clear unread count when opening chat tab
                    if (tab.id === 'chat') {
                      setUnreadChatCount(0)
                      setLastReadChatTime(Date.now())
                    }
                  }}
                  className={`min-h-[44px] px-4 sm:px-6 py-3 rounded-full font-bold text-sm sm:text-base whitespace-nowrap transition-all relative touch-manipulation flex-shrink-0 flex items-center justify-center ${
                    activeTab === tab.id
                      ? 'bg-[var(--primary)] text-white shadow-lg active:scale-100 sm:scale-105'
                      : hasUnread
                        ? 'bg-orange-400 text-white animate-pulse shadow-lg active:bg-orange-500'
                        : 'bg-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--primary)]/20 active:bg-[var(--primary)]/30'
                  }`}
                  aria-label={tab.label}
                >
                  <span className="text-lg sm:text-xl leading-none">{tab.icon}</span>
                  <span className="child-nav-label ml-1 capitalize tracking-wide text-xs sm:text-sm md:text-base">
                    {tab.label}
                  </span>
                  {hasUnread && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-red-500 text-white rounded-full text-xs font-bold flex items-center justify-center animate-bounce">
                      {unreadChatCount > 9 ? '9+' : unreadChatCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Today Tab */}
        {activeTab === 'today' && (
          <div className="space-y-6">
            {holidayMode.isActive && (
              <div className="cb-card bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-300 p-6">
                <div className="text-center space-y-3">
                  <div className="flex justify-center gap-4 text-4xl">
                    <span className="animate-bounce">🌴</span>
                    <span className="animate-bounce delay-100">☀️</span>
                    <span className="animate-bounce delay-200">😎</span>
                  </div>
                  <h3 className="font-bold text-yellow-800 text-2xl">Holiday mode is active!</h3>
                  <p className="text-yellow-700 text-lg">{holidayMode.message}</p>
                  <div className="bg-white/60 rounded-lg px-4 py-2 inline-block">
                    <p className="text-yellow-800 font-semibold text-sm">No chores required today—have fun and relax!</p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <h2 className="cb-heading-lg text-[var(--primary)]">🎯 Today's Missions</h2>
              <span className="cb-chip bg-[var(--success)]/10 text-[var(--success)]">
                {(() => {
                  // Filter assignments
                  const filtered = assignments.filter(a => {
                    // For weekly chores, only consider a chore "completed" if there's an APPROVED completion
                    // Pending/rejected completions don't count - the chore is still available
                    const assignmentCompletions = completions.filter(c => c.assignmentId === a.id)
                    const hasApprovedCompletion = assignmentCompletions.some(c => c.status === 'approved')
                    
                    if (!a.chore?.active || hasApprovedCompletion) {
                      return false
                    }
                    
                    // For daily chores, only show assignments created today
                    if (a.chore.frequency === 'daily') {
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      const assignmentDate = new Date(a.createdAt)
                      assignmentDate.setHours(0, 0, 0, 0)
                      return assignmentDate.getTime() === today.getTime()
                    }
                    
                    // For weekly chores, show all assignments that don't have an approved completion
                    // Pending/rejected completions mean the child can still see and complete the chore
                    if (a.chore.frequency === 'weekly') {
                      // Only hide if there's an approved completion
                      // Pending/rejected completions should still show the chore
                      return !hasApprovedCompletion
                    }
                    
                    // For 'once' chores, show all
                    return true
                  })
                  
                  // For weekly chores, only show the most recent incomplete assignment per chore
                  // This prevents duplicates if the worker somehow creates multiple assignments
                  const weeklyChores = new Map<string, Assignment>()
                  const otherAssignments: Assignment[] = []
                  
                  filtered.forEach(a => {
                    if (a.chore?.frequency === 'weekly') {
                      const choreId = a.choreId
                      const existing = weeklyChores.get(choreId)
                      if (!existing || new Date(a.createdAt) > new Date(existing.createdAt)) {
                        weeklyChores.set(choreId, a)
                      }
                    } else {
                      otherAssignments.push(a)
                    }
                  })
                  
                  return [...Array.from(weeklyChores.values()), ...otherAssignments]
                })().length} active
              </span>
            </div>

            {(() => {
              // Filter assignments
              const filtered = assignments.filter(a => {
                // For weekly chores, only consider a chore "completed" if there's an APPROVED completion
                // Pending/rejected completions don't count - the chore is still available
                const assignmentCompletions = completions.filter(c => c.assignmentId === a.id)
                const hasApprovedCompletion = assignmentCompletions.some(c => c.status === 'approved')
                
                if (!a.chore?.active || hasApprovedCompletion) return false
                
                // For daily chores, only show assignments created today
                if (a.chore.frequency === 'daily') {
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const assignmentDate = new Date(a.createdAt)
                  assignmentDate.setHours(0, 0, 0, 0)
                  return assignmentDate.getTime() === today.getTime()
                }
                
                // For weekly chores, show all assignments that don't have an approved completion
                // Pending/rejected completions mean the child can still see and complete the chore
                if (a.chore.frequency === 'weekly') {
                  // Only hide if there's an approved completion
                  return !hasApprovedCompletion
                }
                
                // For 'once' chores, show all
                return true
              })
              
              // For weekly chores, only show the most recent incomplete assignment per chore
              // This prevents duplicates if the worker somehow creates multiple assignments
              const weeklyChores = new Map<string, Assignment>()
              const otherAssignments: Assignment[] = []
              
              filtered.forEach(a => {
                if (a.chore?.frequency === 'weekly') {
                  const choreId = a.choreId
                  const existing = weeklyChores.get(choreId)
                  if (!existing || new Date(a.createdAt) > new Date(existing.createdAt)) {
                    weeklyChores.set(choreId, a)
                  }
                } else {
                  otherAssignments.push(a)
                }
              })
              
              return [...Array.from(weeklyChores.values()), ...otherAssignments]
            })().length === 0 ? (
              <div className="text-center py-16">
                <div className="text-8xl mb-4">🎉</div>
                <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">All caught up!</h3>
                <p className="text-[var(--text-secondary)]">No pending chores right now. Great work!</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(() => {
                  // Filter assignments - same logic as the count above
                  const filtered = assignments.filter(a => {
                    // For weekly chores, only consider a chore "completed" if there's an APPROVED completion
                    // Pending/rejected completions don't count - the chore is still available
                    const assignmentCompletions = completions.filter(c => c.assignmentId === a.id)
                    const hasApprovedCompletion = assignmentCompletions.some(c => c.status === 'approved')
                    
                    if (!a.chore?.active || hasApprovedCompletion) return false
                    
                    // For daily chores, only show assignments created today
                    if (a.chore.frequency === 'daily') {
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      const assignmentDate = new Date(a.createdAt)
                      assignmentDate.setHours(0, 0, 0, 0)
                      return assignmentDate.getTime() === today.getTime()
                    }
                    
                    // For weekly chores, show all assignments that don't have an approved completion
                    // Pending/rejected completions mean the child can still see and complete the chore
                    if (a.chore.frequency === 'weekly') {
                      // Only hide if there's an approved completion
                      return !hasApprovedCompletion
                    }
                    
                    // For 'once' chores, show all
                    return true
                  })
                  
                  // For weekly chores, only show the most recent incomplete assignment per chore
                  // This prevents duplicates if the worker somehow creates multiple assignments
                  const weeklyChores = new Map<string, Assignment>()
                  const otherAssignments: Assignment[] = []
                  
                  filtered.forEach(a => {
                    if (a.chore?.frequency === 'weekly') {
                      const choreId = a.choreId
                      const existing = weeklyChores.get(choreId)
                      if (!existing || new Date(a.createdAt) > new Date(existing.createdAt)) {
                        weeklyChores.set(choreId, a)
                      }
                    } else {
                      otherAssignments.push(a)
                    }
                  })
                  
                  return [...Array.from(weeklyChores.values()), ...otherAssignments]
                })().map((assignment) => {
                  const chore = assignment.chore
                  return (
                    <div
                      key={assignment.id}
                      className="bg-gradient-to-br from-[#1e2235] to-[#252a42] border-2 border-[var(--primary)]/30 rounded-3xl overflow-hidden hover:shadow-2xl hover:border-[var(--primary)]/60 transition-all hover:-translate-y-2"
                    >
                      {/* Gradient top bar */}
                      <div className="h-3 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]"></div>
                      
                      <div className="p-6">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 shadow-lg">
                            🧹
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg text-white mb-1 flex items-center gap-2">
                              {(() => {
                                const choreStreak = allChoreStreaks.get(chore.id)
                                if (choreStreak && choreStreak.current > 0) {
                                  return (
                                    <>
                                      <span className="text-orange-400" title={`${choreStreak.current} day streak!`}>
                                        🔥 {choreStreak.current}
                                      </span>
                                      {chore.title}
                                    </>
                                  )
                                }
                                return chore.title
                              })()}
                            </h3>
                            <p className="text-sm text-gray-300 line-clamp-2">
                              {chore.description || 'Complete this task to earn stars!'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                          <span className="flex-1 cb-chip bg-[var(--success)] text-white text-center font-bold border-2 border-[var(--success)]/30">
                            💰 £{(chore.baseRewardPence / 100).toFixed(2)}
                          </span>
                          <span className="flex-1 cb-chip bg-yellow-500 text-white text-center font-bold border-2 border-yellow-400/30">
                            ⭐ {chore.starsOverride || Math.max(1, Math.floor(chore.baseRewardPence / 10))}
                          </span>
                          <span className="flex-1 cb-chip bg-[var(--secondary)] text-white text-center font-bold border-2 border-[var(--secondary)]/30">
                            {chore.frequency === 'daily' ? '📅 Daily' : chore.frequency === 'weekly' ? '📆 Weekly' : '🎯 Once'}
                          </span>
                        </div>

                        {chore.proof === 'note' && (
                          <div className="mb-3 text-xs text-center text-gray-400 bg-white/5 rounded-lg py-2">
                            📝 Explanation note required
                          </div>
                        )}

                        {assignment.biddingEnabled && (() => {
                          const champion = choreChampions.get(assignment.id)
                          const isChampion = champion && champion.childId === (user?.childId || user?.id)
                          const hasBids = choreChampions.has(assignment.id)
                          
                          if (!hasBids) {
                            return (
                              <div className="mb-3">
                                <div className="text-xs text-center text-orange-300 font-semibold bg-orange-500/20 rounded-lg py-2 mb-2">
                                  ⚔️ CHALLENGE MODE
                                </div>
                                <div className="text-xs text-center text-gray-300 bg-red-500/20 rounded-lg py-2">
                                  🔒 No one claimed yet! Go to Showdown to claim it
                                </div>
                              </div>
                            )
                          }
                          
                          if (isChampion) {
                            return (
                              <div className="mb-3">
                                <div className="text-xs text-center text-yellow-300 font-bold bg-yellow-500/30 rounded-lg py-2 border-2 border-yellow-400 animate-pulse">
                                  👑 YOU'RE THE CHAMPION! You can complete this!
                                </div>
                              </div>
                            )
                          }
                          
                          return (
                            <div className="mb-3">
                              <div className="text-xs text-center text-orange-300 font-semibold bg-orange-500/20 rounded-lg py-2 mb-2">
                                ⚔️ CHALLENGE MODE
                              </div>
                              <div className="text-xs text-center text-gray-300 bg-red-500/20 rounded-lg py-2">
                                🔒 {champion?.child?.nickname} claimed this! Beat their offer in Showdown
                              </div>
                            </div>
                          )
                        })()}

                        <button 
                          onClick={() => {
                            if (assignment.biddingEnabled) {
                              const champion = choreChampions.get(assignment.id)
                              const isChampion = champion && champion.childId === (user?.childId || user?.id)
                              const hasBids = choreChampions.has(assignment.id)
                              
                              if (!hasBids) {
                                setToast({ message: '🔒 Go to Showdown tab to claim this challenge first!', type: 'warning' })
                                return
                              }
                              
                              if (!isChampion) {
                                setToast({ message: `🔒 ${champion?.child?.nickname} is the champion! Beat their offer in Showdown first!`, type: 'warning' })
                                return
                              }
                            }
                            
                            handleMarkAsDone(assignment)
                          }}
                          className={`w-full py-3 text-sm font-bold shadow-lg transition-all ${
                            assignment.biddingEnabled && (!choreChampions.has(assignment.id) || choreChampions.get(assignment.id)?.childId !== (user?.childId || user?.id))
                              ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                              : 'cb-button-primary hover:scale-105'
                          }`}
                        >
                          {assignment.biddingEnabled && choreChampions.get(assignment.id)?.childId === (user?.childId || user?.id)
                            ? '🏆 Do It & Win!'
                            : '✅ Mark as Done'
                          }
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Recent Activity - Completed Missions */}
            {completions.length > 0 && (
              <div className="mt-8">
                <h3 className="cb-heading-md text-[var(--text-secondary)] mb-4">📋 Recent Activity</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {completions.slice(0, 7).map((completion) => {
                    const assignment = assignments.find(a => a.id === completion.assignmentId)
                    const chore = assignment?.chore
                    
                    if (!chore) return null

                    const getStatusBadge = (status: string) => {
                      switch (status) {
                        case 'pending':
                          return {
                            bg: 'bg-yellow-100',
                            text: 'text-yellow-700',
                            border: 'border-yellow-300',
                            icon: '⏳',
                            label: 'Waiting for approval'
                          }
                        case 'approved':
                          return {
                            bg: 'bg-green-100',
                            text: 'text-green-700',
                            border: 'border-green-300',
                            icon: '✅',
                            label: 'Approved'
                          }
                        case 'rejected':
                          return {
                            bg: 'bg-red-100',
                            text: 'text-red-700',
                            border: 'border-red-300',
                            icon: '❌',
                            label: 'Not approved'
                          }
                        default:
                          return {
                            bg: 'bg-gray-100',
                            text: 'text-gray-700',
                            border: 'border-gray-300',
                            icon: '📝',
                            label: 'Submitted'
                          }
                      }
                    }

                    const badge = getStatusBadge(completion.status)
                    const completionDate = new Date(completion.timestamp)
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const yesterday = new Date(today)
                    yesterday.setDate(yesterday.getDate() - 1)
                    const completionDay = new Date(completionDate)
                    completionDay.setHours(0, 0, 0, 0)
                    
                    let timeDisplay = ''
                    if (completionDay.getTime() === today.getTime()) {
                      // Today - just show time
                      timeDisplay = `Today ${completionDate.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}`
                    } else if (completionDay.getTime() === yesterday.getTime()) {
                      // Yesterday
                      timeDisplay = `Yesterday ${completionDate.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}`
                    } else {
                      // Older - show date and time
                      timeDisplay = completionDate.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: completionDay.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })
                    }

                    return (
                      <div
                        key={completion.id}
                        className={`bg-[#1a1d2e] border-2 ${badge.border} rounded-2xl p-4 hover:shadow-lg transition-all`}
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-md">
                            🧹
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm text-white truncate">
                              {chore.title}
                            </h4>
                            <p className="text-xs text-gray-400">{timeDisplay}</p>
                          </div>
                        </div>

                        <div className={`${badge.bg} ${badge.text} border-2 ${badge.border} rounded-xl px-3 py-2 text-center text-xs font-bold mb-2 shadow-sm`}>
                          {badge.icon} {badge.label}
                        </div>

                        <div className="text-center">
                          <span className="text-base font-bold text-[var(--bonus-stars)]">
                            💰 £{(chore.baseRewardPence / 100).toFixed(2)}
                          </span>
                          <span className="text-base font-bold text-yellow-600 ml-2">
                            ⭐ {chore.starsOverride || Math.max(1, Math.floor(chore.baseRewardPence / 10))}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Streaks Tab */}
        {activeTab === 'streaks' && (
          <div className="space-y-6">
            <h2 className="cb-heading-lg text-[var(--primary)]">🔥 Your Streaks</h2>

            {/* Individual Chore Streaks */}
            {streakStats?.individualStreaks && streakStats.individualStreaks.length > 0 && (
              <div className="cb-card p-6">
                <h3 className="cb-heading-md text-[var(--primary)] mb-4">🔥 Your Chore Streaks</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {streakStats.individualStreaks
                    .filter((s: StreakStat) => s.current > 0)
                    .sort((a: StreakStat, b: StreakStat) => b.current - a.current)
                    .map((streak: StreakStat) => (
                      <div
                        key={streak.choreId}
                        className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-xl p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                            <span className="text-orange-500">🔥</span>
                            {streak.chore?.title || 'Unknown Chore'}
                          </h4>
                          <span className="text-2xl font-bold text-orange-600">{streak.current}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
                          <span>🔥 {streak.current} days</span>
                          <span>🏆 Best: {streak.best}</span>
                        </div>
                        {streak.current >= streak.best && streak.current > 0 && (
                          <div className="mt-2 text-xs font-bold text-orange-600 bg-orange-100 rounded px-2 py-1 inline-block">
                            🎯 Matching your best!
                          </div>
                        )}
                      </div>
                    ))}
                </div>
                {streakStats.individualStreaks.filter((s: any) => s.current === 0).length > 0 && (
                  <div className="mt-4 text-sm text-[var(--text-secondary)] text-center">
                    Start streaks on {streakStats.individualStreaks.filter((s: any) => s.current === 0).length} other chores to earn more bonuses! 💪
                  </div>
                )}
              </div>
            )}

            {/* Next Bonus Milestone */}
            {familySettings && (
              <div className="cb-card p-6 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300">
                <h3 className="cb-heading-md text-[var(--primary)] mb-4">🎁 Your Next Bonus</h3>
                {(() => {
                  const currentStreak = streakStats?.currentStreak || 0
                  const bonusDays = familySettings.bonusDays || 7
                  const bonusEnabled = familySettings.bonusEnabled !== false
                  const bonusType = familySettings.bonusType || 'both'
                  const bonusMoneyPence = familySettings.bonusMoneyPence || 0
                  const bonusStars = familySettings.bonusStars || 0
                  
                  // Calculate next bonus milestone
                  const nextMilestone = Math.ceil((currentStreak + 1) / bonusDays) * bonusDays
                  const daysUntilNext = nextMilestone - currentStreak
                  
                  if (!bonusEnabled) {
                    return (
                      <div className="text-center py-4">
                        <p className="text-[var(--text-secondary)]">Bonuses are currently disabled</p>
                      </div>
                    )
                  }
                  
                  return (
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-orange-600 mb-2">
                          {daysUntilNext} {daysUntilNext === 1 ? 'day' : 'days'} to go!
                        </div>
                        <div className="text-sm text-[var(--text-secondary)] mb-4">
                          Complete chores for {daysUntilNext} more {daysUntilNext === 1 ? 'day' : 'days'} to reach {nextMilestone} days
                        </div>
                        
                        {/* Progress bar */}
                        <div className="w-full bg-gray-200 rounded-full h-6 mb-4 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-orange-400 to-red-500 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all duration-500"
                            style={{ width: `${Math.min(100, (currentStreak / nextMilestone) * 100)}%` }}
                          >
                            {currentStreak > 0 && `${currentStreak}/${nextMilestone}`}
                          </div>
                        </div>
                        
                        {/* Bonus reward preview */}
                        <div className="bg-white rounded-xl p-4 border-2 border-yellow-300">
                          <div className="font-bold text-lg text-[var(--text-primary)] mb-2">
                            You'll earn:
                          </div>
                          <div className="flex items-center justify-center gap-6">
                            {(bonusType === 'money' || bonusType === 'both') && bonusMoneyPence > 0 && (
                              <div className="text-center">
                                <div className="text-3xl font-bold text-green-600">💰</div>
                                <div className="text-xl font-bold text-green-600">£{(bonusMoneyPence / 100).toFixed(2)}</div>
                              </div>
                            )}
                            {(bonusType === 'stars' || bonusType === 'both') && bonusStars > 0 && (
                              <div className="text-center">
                                <div className="text-3xl font-bold text-yellow-600">⭐</div>
                                <div className="text-xl font-bold text-yellow-600">{bonusStars} Stars</div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Bonus schedule */}
                        <div className="mt-4 text-xs text-[var(--text-secondary)] text-center">
                          💡 Bonuses are awarded every {bonusDays} days ({bonusDays}, {bonusDays * 2}, {bonusDays * 3}...)
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Streak Protection Info */}
            {familySettings && familySettings.streakProtectionDays > 0 && (
              <div className="cb-card p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300">
                <h3 className="cb-heading-md text-blue-600 mb-3 flex items-center gap-2">
                  🛡️ Streak Protection
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-3">
                  You have <span className="font-bold text-blue-600">{familySettings.streakProtectionDays}</span> protection {familySettings.streakProtectionDays === 1 ? 'day' : 'days'}!
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  If you miss a day, your streak won't break for {familySettings.streakProtectionDays} {familySettings.streakProtectionDays === 1 ? 'day' : 'days'}. 
                  This gives you a safety net! 🎯
                </p>
              </div>
            )}

            {/* Penalty Information (if enabled) */}
            {familySettings && familySettings.penaltyEnabled && (
              <div className="cb-card p-4 bg-white border-2 border-red-300">
                <h3 className="text-sm font-bold text-red-600 mb-2 flex items-center gap-2">
                  ⚠️ Penalty Info
                </h3>
                <p className="text-xs text-gray-700 mb-2">
                  Missing chores after protection period:
                </p>
                <div className="space-y-1 text-xs">
                  {familySettings.firstMissPence > 0 && (
                    <div className="flex items-center justify-between text-gray-800">
                      <span>1st miss:</span>
                      <span className="font-bold text-red-600">
                        -£{(familySettings.firstMissPence / 100).toFixed(2)}
                        {familySettings.firstMissStars > 0 && ` / -${familySettings.firstMissStars}⭐`}
                      </span>
                    </div>
                  )}
                  {familySettings.secondMissPence > 0 && (
                    <div className="flex items-center justify-between text-gray-800">
                      <span>2nd miss:</span>
                      <span className="font-bold text-red-600">
                        -£{(familySettings.secondMissPence / 100).toFixed(2)}
                        {familySettings.secondMissStars > 0 && ` / -${familySettings.secondMissStars}⭐`}
                      </span>
                    </div>
                  )}
                  {familySettings.thirdMissPence > 0 && (
                    <div className="flex items-center justify-between text-gray-800">
                      <span>3rd+ miss:</span>
                      <span className="font-bold text-red-600">
                        -£{(familySettings.thirdMissPence / 100).toFixed(2)}
                        {familySettings.thirdMissStars > 0 && ` / -${familySettings.thirdMissStars}⭐`}
                      </span>
                    </div>
                  )}
                </div>
                {(familySettings.minBalancePence > 0 || familySettings.minBalanceStars > 0) && (
                  <div className="mt-2 pt-2 border-t border-red-200 text-xs text-gray-700">
                    🛡️ Protection: You'll always keep at least £{(familySettings.minBalancePence / 100).toFixed(2)}
                    {familySettings.minBalanceStars > 0 && ` and ${familySettings.minBalanceStars} stars`}
                  </div>
                )}
              </div>
            )}

            {/* Streak Tips */}
            <div className="cb-card bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 p-6">
              <h3 className="cb-heading-md text-blue-600 mb-3">💡 Streak Tips</h3>
              <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Complete at least one chore every day to maintain your streak 🔥</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Your streak counts when you submit a chore (even before parent approval!) ✅</span>
                </li>
                {familySettings?.streakProtectionDays > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>You have {familySettings.streakProtectionDays} protection {familySettings.streakProtectionDays === 1 ? 'day' : 'days'} - use them wisely! 🛡️</span>
                  </li>
                )}
                {familySettings?.bonusEnabled && (
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Earn bonuses every {familySettings.bonusDays || 7} days - keep going! 🎁</span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Your best streak is saved forever - try to beat it! 🏆</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Shop Tab */}
        {activeTab === 'shop' && (
          <div className="space-y-6">
            <h2 className="cb-heading-lg text-[var(--primary)]">🛍️ Rewards Shop</h2>
            
            {/* Check if gifts are enabled */}
            {familySettings?.giftsEnabled === false ? (
              <div className="text-center py-16">
                <div className="text-8xl mb-4">🔒</div>
                <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Shop is Temporarily Closed</h3>
                <p className="text-[var(--text-secondary)]">The gift shop is currently disabled. Ask your parents to enable it!</p>
              </div>
            ) : familyGifts.length === 0 && rewards.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-8xl mb-4">🎁</div>
                <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">No rewards yet!</h3>
                <p className="text-[var(--text-secondary)]">Ask your parents to add some rewards!</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {/* Display Family Gifts (new system) */}
                {familyGifts.map((gift) => (
                  <div
                    key={gift.id}
                    className="bg-white border-2 border-[var(--card-border)] rounded-2xl overflow-hidden hover:shadow-xl transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedGiftForRedemption(gift)
                      setShowRedemptionModal(true)
                    }}
                  >
                    <div className="aspect-square bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center text-4xl relative">
                      {gift.imageUrl ? (
                        <a
                          href={gift.affiliateUrl || gift.sitestripeUrl || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="block w-full h-full"
                        >
                          <img src={gift.imageUrl} alt={gift.title} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                        </a>
                      ) : (
                        '🎁'
                      )}
                    </div>
                    <div className="p-3">
                      <h3 
                        className={`font-bold text-base text-[var(--text-primary)] mb-1 line-clamp-2 ${gift.affiliateUrl || gift.sitestripeUrl ? 'cursor-pointer hover:text-[var(--primary)] transition-colors' : ''}`}
                        onClick={(e) => {
                          if (gift.affiliateUrl || gift.sitestripeUrl) {
                            e.stopPropagation()
                            window.open(gift.affiliateUrl || gift.sitestripeUrl, '_blank', 'noopener,noreferrer')
                          }
                        }}
                      >
                        {gift.title}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mb-2 line-clamp-2">
                        {gift.description || 'A special reward just for you!'}
                      </p>
                      {gift.createdByUser && (
                        <p className="text-xs text-[var(--text-secondary)] mb-2 italic">
                          Added by {gift.createdByUser.email?.split('@')[0] || 'Unknown'}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-200">
                          <span className="text-lg font-bold text-yellow-700">
                            {gift.starsRequired}
                          </span>
                          <span className="text-lg">⭐</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedGiftForRedemption(gift)
                            setShowRedemptionModal(true)
                          }}
                          disabled={totalStars < gift.starsRequired || claimingReward === gift.id}
                          className={`px-3 py-1.5 rounded-full font-bold text-xs whitespace-nowrap ${
                            totalStars >= gift.starsRequired
                              ? 'bg-[var(--primary)] text-white hover:scale-105'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          } transition-all`}
                        >
                          {claimingReward === gift.id ? '⏳...' : totalStars >= gift.starsRequired ? '🎉 Redeem' : `🔒 Need ${gift.starsRequired - totalStars}`}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Display old Rewards (backward compatibility) */}
                {rewards.map((reward) => (
                  <div
                    key={reward.id}
                    className="bg-white border-2 border-[var(--card-border)] rounded-2xl overflow-hidden hover:shadow-xl transition-all"
                  >
                    <div className="aspect-square bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center text-4xl">
                      {reward.imageUrl ? (
                        <img src={reward.imageUrl} alt={reward.title} className="w-full h-full object-cover" />
                      ) : (
                        '🎁'
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-base text-[var(--text-primary)] mb-1 line-clamp-2">{reward.title}</h3>
                      <p className="text-xs text-[var(--text-secondary)] mb-2 line-clamp-2">
                        {reward.description || 'A special reward just for you!'}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-200">
                          <span className="text-lg font-bold text-yellow-700">
                            {reward.starsRequired}
                          </span>
                          <span className="text-lg">⭐</span>
                        </div>
                        <button
                          onClick={() => handleClaimReward(reward)}
                          disabled={totalStars < reward.starsRequired || claimingReward === reward.id}
                          className={`px-3 py-1.5 rounded-full font-bold text-xs whitespace-nowrap ${
                            totalStars >= reward.starsRequired
                              ? 'bg-[var(--primary)] text-white hover:scale-105'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          } transition-all`}
                        >
                          {claimingReward === reward.id ? '⏳...' : totalStars >= reward.starsRequired ? '🎉 Claim' : '🔒 Locked'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Redemption Confirmation Modal */}
            {showRedemptionModal && selectedGiftForRedemption && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overscroll-contain">
                <div className="bg-white rounded-3xl p-4 sm:p-6 max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
                  <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Confirm Redemption</h3>
                  
                  <div className="mb-6">
                    {selectedGiftForRedemption.imageUrl && (
                      <img 
                        src={selectedGiftForRedemption.imageUrl} 
                        alt={selectedGiftForRedemption.title} 
                        className="w-full h-48 object-cover rounded-xl mb-4"
                      />
                    )}
                    <h4 className="text-xl font-bold text-[var(--text-primary)] mb-2">{selectedGiftForRedemption.title}</h4>
                    {selectedGiftForRedemption.description && (
                      <p className="text-[var(--text-secondary)] mb-2">{selectedGiftForRedemption.description}</p>
                    )}
                    {selectedGiftForRedemption.createdByUser && (
                      <p className="text-sm text-[var(--text-secondary)] mb-4 italic">
                        Added by {selectedGiftForRedemption.createdByUser.email?.split('@')[0] || 'Unknown'}
                      </p>
                    )}
                  </div>
                  
                  <div className="bg-[var(--card-border)]/20 rounded-xl p-4 mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[var(--text-secondary)]">Cost:</span>
                      <span className="text-2xl font-bold text-[var(--bonus-stars)]">
                        {selectedGiftForRedemption.starsRequired} ⭐
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-[var(--card-border)]">
                      <span className="text-[var(--text-secondary)]">Your Stars:</span>
                      <span className="font-bold text-[var(--text-primary)]">
                        {totalStars} ⭐ → {totalStars - selectedGiftForRedemption.starsRequired} ⭐
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => {
                        setShowRedemptionModal(false)
                        setSelectedGiftForRedemption(null)
                      }}
                      className="min-h-[44px] flex-1 px-4 py-3 rounded-full font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400 transition-all touch-manipulation"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRedeemGift}
                      disabled={totalStars < selectedGiftForRedemption.starsRequired || claimingReward === selectedGiftForRedemption.id}
                      className={`min-h-[44px] flex-1 px-4 py-3 rounded-full font-bold text-white transition-all touch-manipulation ${
                        totalStars >= selectedGiftForRedemption.starsRequired
                          ? 'bg-[var(--primary)] hover:scale-105 active:scale-100 active:bg-[var(--primary)]/90'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {claimingReward === selectedGiftForRedemption.id ? '⏳ Redeeming...' : 'Confirm Redeem'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Pending Redemptions Section */}
            {pendingRedemptions.length > 0 && (
              <div className="mt-8">
                <h3 className="cb-heading-md text-[var(--primary)] mb-4">⏳ Waiting for Approval ({pendingRedemptions.length})</h3>
                <div className="space-y-3">
                  {pendingRedemptions.map((redemption: Redemption) => (
                    <div
                      key={redemption.id}
                      className="bg-white border-2 border-yellow-300 rounded-[var(--radius-lg)] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                          ⏳
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-[var(--text-primary)] mb-1">
                            {redemption.familyGift?.title || redemption.reward?.title || 'Gift'}
                          </h4>
                          <p className="text-xs text-[var(--text-secondary)] mb-2">
                            Redeemed {new Date(redemption.createdAt).toLocaleString()}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="cb-chip bg-yellow-100 text-yellow-700">
                              -{redemption.costPaid} ⭐
                            </span>
                            <span className="text-sm text-[var(--text-secondary)]">
                              Waiting for parent approval...
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Redemption History Section */}
            {redemptionHistory.length > 0 && (
              <div className="mt-8">
                <h3 className="cb-heading-md text-[var(--primary)] mb-4">📜 Order History</h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {redemptionHistory.map((redemption: Redemption) => {
                    const isApproved = redemption.status === 'fulfilled'
                    const isRejected = redemption.status === 'rejected'
                    const icon = isApproved ? '✅' : isRejected ? '❌' : '⏳'
                    const processedBy = isApproved ? redemption.approvedByUser : redemption.rejectedByUser
                    
                    return (
                      <div
                        key={redemption.id}
                        className={`bg-white border-2 ${
                          isApproved ? 'border-green-300' : isRejected ? 'border-red-300' : 'border-yellow-300'
                        } rounded-[var(--radius-lg)] p-4`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
                            isApproved ? 'bg-gradient-to-br from-green-400 to-green-600' : 
                            isRejected ? 'bg-gradient-to-br from-red-400 to-red-600' : 
                            'bg-gradient-to-br from-yellow-400 to-orange-500'
                          }`}>
                            {icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-[var(--text-primary)] mb-1">
                              {redemption.familyGift?.title || redemption.reward?.title || 'Gift'}
                            </h4>
                            <p className="text-xs text-[var(--text-secondary)] mb-2">
                              {new Date(redemption.createdAt).toLocaleString()}
                              {redemption.processedAt && (
                                <> • Processed {new Date(redemption.processedAt).toLocaleString()}</>
                              )}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`cb-chip ${
                                isApproved ? 'bg-green-100 text-green-700' : 
                                isRejected ? 'bg-red-100 text-red-700' : 
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {isRejected ? '+' : '-'}{redemption.costPaid} ⭐
                              </span>
                              {processedBy && (
                                <span className="text-sm text-[var(--text-secondary)]">
                                  {isApproved ? '✅ Approved' : '❌ Rejected'} by {processedBy.email?.split('@')[0] || 'Unknown'}
                                </span>
                              )}
                            </div>
                            {isRejected && (
                              <p className="text-sm text-red-600 mt-2 italic">
                                Stars have been refunded to your account
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="cb-card p-6">
            <h3 className="cb-heading-lg text-[var(--primary)] mb-4">💬 Family Chat</h3>
            <div className="h-[60vh]">
              <FamilyChat 
                compact={false}
                days={30}
                maxMessages={150}
                childFriendly={true}
                onNewMessage={() => {
                  // Only count as unread if chat tab is not active
                  if (activeTab !== 'chat') {
                    setUnreadChatCount(prev => prev + 1)
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Showdown Tab - Rivalry Bidding */}
        {activeTab === 'showdown' && (
          <div className="space-y-6">
            {/* Bidding Chores */}
            <div>
              <h3 className="cb-heading-md text-[var(--primary)] mb-4">🎯 Challenge Chores</h3>
              {(() => {
                // Filter assignments where bidding is enabled AND not already completed/submitted
                const biddingChores = assignments.filter((a: any) => {
                  const hasCompletion = completions.some(c => c.assignmentId === a.id)
                  return a.biddingEnabled && a.chore?.active && !hasCompletion
                })
                
                if (biddingChores.length === 0) {
                  return (
                    <div className="cb-card p-8 text-center">
                      <div className="text-6xl mb-4">😴</div>
                      <h4 className="font-bold text-[var(--text-primary)] mb-2">No Challenge Chores</h4>
                      <p className="text-[var(--text-secondary)]">
                        Ask your parents to turn on Challenge Mode for some chores!
                      </p>
                    </div>
                  )
                }

                return (
                  <div className="space-y-4">
                    {biddingChores.map((assignment: any) => {
                      const chore = assignment.chore
                      const baseReward = chore.baseRewardPence
                      // For challenge mode: you can bid UP TO the base reward (or lower to win)
                      // Min: £0.01 (must be positive), Max: base reward
                      const minBid = 1 // 1 pence minimum
                      const maxBid = baseReward // Can't bid more than base reward
                      const champion = choreChampions.get(assignment.id)
                      const isChampion = champion && champion.childId === (user?.childId || user?.id)
                      const hasChampion = Boolean(champion)
                      const streak = choreStreaks.get(assignment.id)
                      const hasMyStreak = streak && !streak.isDisrupted
                      const streakDays = streak?.current || 0

                      return (
                        <div
                          key={assignment.id}
                          className={`cb-card border-4 p-6 ${
                            isChampion 
                              ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-yellow-100' 
                              : hasChampion
                              ? 'border-red-400 bg-gradient-to-br from-red-50 to-orange-50'
                              : 'border-orange-400 bg-gradient-to-br from-orange-50 to-yellow-50'
                          }`}
                        >
                          <div className="flex items-start gap-4 mb-4">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl flex-shrink-0 ${
                              isChampion 
                                ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 animate-pulse'
                                : 'bg-gradient-to-br from-orange-400 to-red-500'
                            }`}>
                              {isChampion ? '👑' : '🔥'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-xl text-[var(--text-primary)]">
                                  {chore.title}
                                </h4>
                                {hasMyStreak && streakDays >= 2 && (
                                  <span className="cb-chip bg-orange-500 text-white text-xs font-bold animate-pulse">
                                    🔥 {streakDays}-day streak!
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-[var(--text-secondary)] mb-3">
                                {chore.description || 'Offer to do this for less to win!'}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <span className="cb-chip bg-yellow-500 text-white font-bold">
                                  🏆 WIN: 2⭐ (DOUBLE STARS!)
                                </span>
                                <span className="cb-chip bg-orange-200 text-orange-800">
                                  💰 Usually pays: £{(baseReward / 100).toFixed(2)}
                                </span>
                                <span className="cb-chip bg-green-200 text-green-800">
                                  💪 You get your bid + bonus star!
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Streak Motivation Banner */}
                          {hasMyStreak && streakDays >= 2 && (
                            <div className="mb-4 rounded-xl p-4 bg-gradient-to-r from-orange-500 to-red-500 text-white border-2 border-red-600 animate-pulse">
                              <div className="flex items-center gap-3">
                                <div className="text-4xl">🔥</div>
                                <div className="flex-1">
                                  <p className="font-bold text-lg">PROTECT YOUR STREAK!</p>
                                  <p className="text-sm text-white/90">
                                    You have a {streakDays}-day streak on this chore! Claim it NOW or lose it! ⚠️
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {!hasMyStreak && hasChampion && streakDays >= 2 && (
                            <div className="mb-4 rounded-xl p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-purple-600">
                              <div className="flex items-center gap-3">
                                <div className="text-4xl">💪</div>
                                <div className="flex-1">
                                  <p className="font-bold text-lg">BREAK THEIR STREAK!</p>
                                  <p className="text-sm text-white/90">
                                    {champion.child?.nickname} has a {streakDays}-day streak! Steal this chore and break it! 😈
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Current Bids Display */}
                          {(() => {
                            const bids = choreBids.get(assignment.id) || []
                            
                            if (bids.length > 0) {
                              return (
                                <div className="mb-4">
                                  <h5 className="text-sm font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                                    📊 Current Offers:
                                  </h5>
                                  <div className="space-y-2">
                                    {bids.map((bid: any, index: number) => {
                                      const isCurrentChampion = index === 0
                                      const isMyBid = bid.childId === (user?.childId || user?.id)
                                      
                                      return (
                                        <div
                                          key={bid.id}
                                          className={`flex items-center gap-3 p-3 rounded-lg border-2 ${
                                            isCurrentChampion && isMyBid
                                              ? 'bg-yellow-100 border-yellow-400'
                                              : isCurrentChampion
                                              ? 'bg-red-100 border-red-400'
                                              : isMyBid
                                              ? 'bg-blue-50 border-blue-300'
                                              : 'bg-gray-50 border-gray-300'
                                          }`}
                                        >
                                          <div className="text-2xl">
                                            {isCurrentChampion ? '👑' : isMyBid ? '💪' : '😐'}
                                          </div>
                                          <div className="flex-1">
                                            <p className={`font-bold text-sm ${
                                              isCurrentChampion && isMyBid
                                                ? 'text-yellow-800'
                                                : isCurrentChampion
                                                ? 'text-red-800'
                                                : isMyBid
                                                ? 'text-blue-800'
                                                : 'text-gray-700'
                                            }`}>
                                              {isMyBid ? 'You' : bid.child?.nickname}
                                              {isCurrentChampion && ' (WINNING!)'}
                                            </p>
                                            <p className="text-xs text-gray-600">
                                              Offered £{(bid.amountPence / 100).toFixed(2)}
                                            </p>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                  
                                  {/* Champion Status */}
                                  {hasChampion && (
                                    <div className={`mt-3 rounded-xl p-3 border-2 ${
                                      isChampion
                                        ? 'bg-yellow-100 border-yellow-400'
                                        : 'bg-red-100 border-red-400'
                                    }`}>
                                      <p className={`text-xs font-bold ${isChampion ? 'text-yellow-800' : 'text-red-800'}`}>
                                        {isChampion 
                                          ? `✨ You have the lowest offer! Go to Today tab to complete it!`
                                          : `⚠️ ${champion.child?.nickname} has the lowest offer! Offer less to steal it!`
                                        }
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )
                            }
                            
                            return null
                          })()}

                          {/* Claim/Steal Area */}
                          <div className="bg-white rounded-xl p-4 border-2 border-orange-300">
                            <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                              {hasChampion && !isChampion 
                                ? `💪 STEAL IT! Offer less than £${(champion.amountPence / 100).toFixed(2)}:` 
                                : `💪 I'll Do It For (up to £${(baseReward / 100).toFixed(2)}):`}
                            </p>
                            <div className="flex gap-3">
                              <input
                                type="number"
                                min="0.01"
                                max={hasChampion && !isChampion ? ((champion.amountPence - 1) / 100).toFixed(2) : (maxBid / 100).toFixed(2)}
                                step="0.01"
                                placeholder={
                                  hasChampion && !isChampion 
                                    ? `Less than £${(champion.amountPence / 100).toFixed(2)}`
                                    : `Up to £${(baseReward / 100).toFixed(2)}`
                                }
                                className="flex-1 px-4 py-3 border-2 border-[var(--card-border)] rounded-lg focus:border-orange-500 focus:outline-none"
                                id={`bid-${assignment.id}`}
                              />
                              <button
                                onClick={async () => {
                                  const input = document.getElementById(`bid-${assignment.id}`) as HTMLInputElement
                                  const bidAmount = parseFloat(input.value)
                                  
                                  // Validation: must be between £0.01 and base reward (or less than current champion if stealing)
                                  if (!bidAmount || bidAmount < 0.01) {
                                    setToast({ 
                                      message: `Offer must be at least £0.01!`, 
                                      type: 'error' 
                                    })
                                    return
                                  }
                                  
                                  if (hasChampion && !isChampion) {
                                    // Stealing: must be less than current champion's bid
                                    if (bidAmount >= champion.amountPence / 100) {
                                      setToast({ 
                                        message: `Must be LESS than £${(champion.amountPence / 100).toFixed(2)} to steal it!`, 
                                        type: 'error' 
                                      })
                                      return
                                    }
                                  } else {
                                    // Claiming: must be up to base reward
                                    if (bidAmount > baseReward / 100) {
                                      setToast({ 
                                        message: `Can't offer more than £${(baseReward / 100).toFixed(2)} (the usual price)!`, 
                                        type: 'error' 
                                      })
                                      return
                                    }
                                  }

                                  try {
                                    await apiClient.competeInBid({
                                      assignmentId: assignment.id,
                                      childId: user?.childId || user?.id || '',
                                      amountPence: Math.round(bidAmount * 100),
                                      targetChildId: champion?.childId
                                    })
                                    
                                    setToast({ 
                                      message: hasChampion && !isChampion
                                        ? `😎 You stole it! You're the new champion!`
                                        : `🎯 You claimed it! £${bidAmount.toFixed(2)} - Go complete it!`, 
                                      type: 'success' 
                                    })
                                    setShowConfetti(true)
                                    setTimeout(() => setShowConfetti(false), 2000)
                                    input.value = ''
                                    
                                    // Reload to show updated champion status
                                    await loadDashboard()
                                  } catch (error) {
                                    console.error('Failed to place claim:', error)
                                    setToast({ message: 'Failed. Try again!', type: 'error' })
                                  }
                                }}
                                className={`px-6 py-3 font-bold rounded-lg transition-all ${
                                  hasChampion && !isChampion
                                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700'
                                    : 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white hover:from-orange-600 hover:to-yellow-600'
                                }`}
                              >
                                {hasChampion && !isChampion ? '💪 STEAL IT!' : '🎯 CLAIM IT!'}
                              </button>
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] mt-2">
                              💡 Lowest offer wins! You get your bid amount + a bonus star (2⭐ total)
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            {/* Leaderboard */}
            <div>
              <h3 className="cb-heading-md text-[var(--primary)] mb-4">🏆 This Week's Champions</h3>
              <div className="space-y-3">
                {leaderboard.length === 0 ? (
                  <div className="cb-card p-8 text-center">
                    <p className="text-[var(--text-secondary)]">No competitors yet. Invite siblings to join!</p>
                  </div>
                ) : (
                  leaderboard.map((entry, index) => (
                    <div
                      key={entry.childId}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 ${
                        index === 0
                          ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 border-yellow-400'
                          : 'bg-white border-[var(--card-border)]'
                      }`}
                    >
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl ${
                          index === 0
                            ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white'
                            : index === 1
                            ? 'bg-gray-300 text-gray-700'
                            : index === 2
                            ? 'bg-orange-300 text-orange-900'
                            : 'bg-[var(--card-border)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-lg text-[var(--text-primary)] truncate">{entry.nickname}</h4>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {entry.completedChores} chore{entry.completedChores !== 1 ? 's' : ''} • £{((entry.totalRewardPence || 0) / 100).toFixed(2)} earned
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-yellow-700">{entry.totalStars || 0} ⭐</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bank Tab */}
        {activeTab === 'bank' && (
          <div className="space-y-6">
            {/* Buy Stars Section - Only show if enabled, otherwise show nothing at top */}
            {familySettings?.buyStarsEnabled && (() => {
              const balancePence = wallet?.balancePence || 0
              const conversionRatePence = familySettings?.starConversionRatePence || 10
              const maxStarsAffordable = Math.floor(balancePence / conversionRatePence)
              const maxStars = Math.max(1, maxStarsAffordable)
              const currentCost = buyStarsAmount * conversionRatePence
              const canAfford = balancePence >= currentCost
              
              // Ensure buyStarsAmount doesn't exceed maxStars
              if (buyStarsAmount > maxStars) {
                setBuyStarsAmount(maxStars)
              }
              
              return (
                <div className="cb-card bg-white p-4 shadow-md border-2 border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">⭐</span>
                      <h2 className="text-lg font-bold text-gray-800">Buy Stars</h2>
                    </div>
                    <span className="text-sm text-gray-600">Balance: £{(balancePence / 100).toFixed(2)}</span>
                  </div>
                  
                  {/* Max Stars Info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-4">
                    <p className="text-xs text-gray-700 text-center">
                      You can buy up to <span className="font-bold text-blue-700">{maxStars} star{maxStars !== 1 ? 's' : ''}</span> ({conversionRatePence}p per star)
                    </p>
                  </div>
                  
                  {/* Slider */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-sm font-semibold text-gray-800">
                        Stars to buy:
                      </label>
                      <span className="text-2xl font-bold text-orange-600">{buyStarsAmount} ⭐</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max={maxStars}
                      step="1"
                      value={buyStarsAmount}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(maxStars, parseInt(e.target.value) || 1))
                        setBuyStarsAmount(val)
                      }}
                      className="w-full h-4 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #f97316 0%, #f97316 ${maxStars > 1 ? ((buyStarsAmount - 1) / (maxStars - 1)) * 100 : 0}%, #e5e7eb ${maxStars > 1 ? ((buyStarsAmount - 1) / (maxStars - 1)) * 100 : 0}%, #e5e7eb 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1</span>
                      <span>{maxStars}</span>
                    </div>
                  </div>
                  
                  {/* Cost Display */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 font-medium">Total cost:</span>
                      <span className={`text-xl font-bold ${canAfford ? 'text-green-600' : 'text-red-600'}`}>
                        £{(currentCost / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Pending Requests Alert */}
                  {pendingStarPurchases.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2 mb-4">
                      <p className="text-xs text-yellow-800 font-semibold text-center">
                        ⏳ {pendingStarPurchases.length} request{pendingStarPurchases.length !== 1 ? 's' : ''} waiting for approval
                      </p>
                    </div>
                  )}
                  
                  {/* Buy Button */}
                  <button
                    onClick={async () => {
                      if (buyingStars) return
                      if (!canAfford) {
                        setToast({ message: "You don't have enough money! 💰", type: 'error' })
                        return
                      }
                      try {
                        setBuyingStars(true)
                        const response = await apiClient.buyStars(buyStarsAmount)
                        setToast({ message: `⭐ Requested ${buyStarsAmount} stars! Waiting for parent approval...`, type: 'success' })
                        setBuyStarsAmount(1)
                        await loadDashboard()
                      } catch (error: any) {
                        const appError = handleApiError(error, 'Buying stars')
                        setToast({ message: appError.message, type: 'error' })
                      } finally {
                        setBuyingStars(false)
                      }
                    }}
                    disabled={buyingStars || !canAfford || maxStars === 0}
                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-bold text-base hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-95 transform"
                  >
                    {buyingStars ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin">⏳</span>
                        <span>Requesting...</span>
                      </span>
                    ) : (
                      <span>💰 Buy {buyStarsAmount} Star{buyStarsAmount !== 1 ? 's' : ''}!</span>
                    )}
                  </button>
                  
                  {/* Info Note */}
                  <p className="text-gray-500 text-xs text-center mt-3">
                    ⚠️ Money deducted now, stars added after approval
                  </p>
                </div>
              )
            })()}

            <div className="cb-card p-6">
              <h3 className="cb-heading-md text-[var(--primary)] mb-4">📊 Transaction History</h3>
              
              {transactions.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-8xl mb-4">💰</div>
                  <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">No transactions yet!</h3>
                  <p className="text-[var(--text-secondary)]">Complete chores to earn your first stars!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {transactions.map((transaction: any) => {
                    const isCredit = transaction.type === 'credit'
                    const metaJson = typeof transaction.metaJson === 'string' 
                      ? JSON.parse(transaction.metaJson) 
                      : transaction.metaJson || {}
                    
                    // Determine transaction type & icon
                    let icon = '💰'
                    let label = isCredit ? 'Earned' : 'Spent'
                    let description = ''
                    
                    if (isCredit) {
                      if (metaJson.completionId) {
                        icon = '✅'
                        label = 'Chore Completed'
                        if (metaJson.rivalryBonus || metaJson.doubledStars) {
                          description = '🏆 Challenge Winner - Double Stars!'
                        } else {
                          description = 'Good job!'
                        }
                      } else if (metaJson.type === 'streak_bonus') {
                        icon = '🔥'
                        label = 'Streak Bonus'
                        description = `${metaJson.streakLength || 0} day streak!`
                      } else if (metaJson.type === 'rivalry_bonus') {
                        icon = '⚔️'
                        label = 'Rivalry Bonus'
                        description = 'Challenge champion!'
                      } else if (metaJson.type === 'gift_stars') {
                        icon = '⭐'
                        label = 'Stars Gifted'
                        description = metaJson.giverName ? `From ${metaJson.giverName}` : (metaJson.note || 'Gift received')
                      } else if (metaJson.type === 'gift_money') {
                        icon = '💵'
                        label = 'Money Gifted'
                        description = metaJson.giverName ? `From ${metaJson.giverName}` : (metaJson.note || 'Gift received')
                      } else {
                        icon = '💵'
                        label = 'Money Added'
                        description = metaJson.note || 'From parent'
                      }
                    } else {
                      if (metaJson.redemptionId || metaJson.familyGiftId) {
                        icon = '🎁'
                        label = 'Reward Claimed'
                        const gift = metaJson.familyGiftId 
                          ? familyGifts.find((g: FamilyGift) => g.id === metaJson.familyGiftId)
                          : null
                        const giftTitle = metaJson.giftTitle || gift?.title || metaJson.rewardTitle || 'Prize redeemed'
                        const addedBy = gift?.createdByUser?.email?.split('@')[0]
                        description = giftTitle + (addedBy ? ` • Added by ${addedBy}` : '')
                      } else if (metaJson.type === 'buy_stars_request') {
                        icon = '⭐'
                        label = 'Buy Stars Request'
                        description = `Requested ${metaJson.starsRequested || 0} stars • Waiting for approval`
                      } else if (metaJson.type === 'buy_stars_approved') {
                        icon = '⭐'
                        label = 'Stars Purchased'
                        description = `Bought ${metaJson.starsRequested || 0} stars!`
                      } else if (metaJson.type === 'buy_stars_rejected' || metaJson.type === 'buy_stars_refund') {
                        icon = '💰'
                        label = 'Buy Stars Refund'
                        description = metaJson.note || 'Refund for rejected star purchase'
                      } else if (metaJson.payoutId) {
                        icon = '💸'
                        label = 'Paid Out'
                        // Find the payout to get who paid
                        const payout = payouts.find((p: any) => p.id === metaJson.payoutId)
                        const paidByName = payout?.paidByUser
                          ? familyMembers.find((m: any) => m.userId === payout.paidBy)?.user?.email?.split('@')[0] || payout.paidByUser.email?.split('@')[0] || 'Parent'
                          : 'Parent'
                        description = `Method: ${metaJson.method || 'cash'} • Paid by ${paidByName}`
                      } else {
                        icon = '💸'
                        label = 'Money Removed'
                        description = metaJson.note || ''
                      }
                    }
                    
                    const date = new Date(transaction.createdAt)
                    const dateStr = date.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                    })
                    const timeStr = date.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true
                    })
                    
                    // Calculate stars and money display based on transaction type
                    let stars = 0
                    let showStars = true
                    let showMoney = true
                    let starsDisplay = ''
                    let moneyDisplay = ''
                    
                    if (metaJson.type === 'buy_stars_approved' && metaJson.starsRequested) {
                      // Buy stars approved: only show stars (no money)
                      stars = metaJson.starsRequested
                      showMoney = false
                      starsDisplay = `+${stars}⭐`
                    } else if (metaJson.redemptionId || metaJson.familyGiftId || metaJson.starsSpent) {
                      // Gift redemption: show stars cost (from starsSpent), no money displayed
                      stars = metaJson.starsSpent || metaJson.costPaid || 0
                      showMoney = false
                      starsDisplay = `-${stars}⭐`
                      moneyDisplay = ''
                    } else if (metaJson.payoutId) {
                      // Cash payout: only show money (no stars)
                      showStars = false
                      showMoney = true
                      moneyDisplay = `£${(transaction.amountPence / 100).toFixed(2)}`
                    } else if (metaJson.type === 'gift_money') {
                      // Money-only gift: only show money (no stars)
                      showStars = false
                      showMoney = true
                      moneyDisplay = `£${(transaction.amountPence / 100).toFixed(2)}`
                    } else if (metaJson.type === 'gift_stars') {
                      // Stars-only gift: only show stars (no money)
                      stars = metaJson.starsAmount || 0
                      showStars = true
                      showMoney = false
                      starsDisplay = `+${stars}⭐`
                    } else {
                      // Default: calculate stars from amount
                      stars = Math.floor(transaction.amountPence / 10)
                      starsDisplay = `${isCredit ? '+' : '-'}${stars}⭐`
                      moneyDisplay = `£${(transaction.amountPence / 100).toFixed(2)}`
                    }
                    
                    return (
                      <div
                        key={transaction.id}
                        className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all hover:shadow-lg ${
                          isCredit
                            ? 'bg-gradient-to-r from-green-50 to-teal-50 border-green-200'
                            : 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-200'
                        }`}
                      >
                        <div 
                          className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl flex-shrink-0 shadow-lg ${
                            isCredit
                              ? 'bg-gradient-to-br from-green-400 to-teal-500'
                              : 'bg-gradient-to-br from-orange-400 to-red-500'
                          }`}
                        >
                          {icon}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-bold text-[var(--text-primary)] text-lg">{label}</h4>
                            <div className="text-right">
                              {metaJson.type === 'buy_stars_approved' ? (
                                // For buy_stars_approved, only show stars (no money)
                                <p className="font-bold text-2xl text-green-600">
                                  {starsDisplay}
                                </p>
                              ) : metaJson.payoutId ? (
                                // For cash payouts, only show money (no stars)
                                <p className="text-lg font-bold text-[var(--text-primary)]">
                                  {moneyDisplay}
                                </p>
                              ) : (metaJson.redemptionId || metaJson.familyGiftId || metaJson.starsSpent) ? (
                                // For gift redemptions, show only stars (no money)
                                <p className={`font-bold text-2xl text-red-600`}>
                                  {starsDisplay}
                                </p>
                              ) : (
                                <>
                                  {showStars && (
                                    <p className={`font-bold text-2xl ${
                                      isCredit ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {starsDisplay}
                                    </p>
                                  )}
                                  {showMoney && (
                                    <p className="text-sm text-[var(--text-secondary)]">
                                      {moneyDisplay || `£{(transaction.amountPence / 100).toFixed(2)}`}
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          
                          {description && (
                            <p className="text-sm text-[var(--text-secondary)] mb-2">{description}</p>
                          )}
                          
                          <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                            <span className="flex items-center gap-1">
                              📅 {dateStr}
                            </span>
                            <span className="flex items-center gap-1">
                              ⏰ {timeStr}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 bg-green-500 text-white p-4 rounded-2xl shadow-2xl animate-bounce">
            {successMessage}
          </div>
        )}
        
        {error && (
          <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 bg-red-500 text-white p-4 rounded-2xl shadow-2xl">
            ❌ {error}
          </div>
        )}
      </div>

      {/* Bottom Navigation (mobile only) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-[var(--card-border)] shadow-lg z-40 sm:hidden safe-area-inset-bottom">
        <div className="flex flex-wrap justify-center items-center gap-1 py-2 px-2">
          {[
            { id: 'today' as Tab, icon: '📅', label: 'Today' },
            { id: 'streaks' as Tab, icon: '🔥', label: 'Streak' },
            ...(familySettings?.giftsEnabled !== false ? [{ id: 'shop' as Tab, icon: '🛍️', label: 'Shop' }] : []),
            { id: 'showdown' as Tab, icon: '⚔️', label: 'Fight' },
            { id: 'bank' as Tab, icon: '🏦', label: 'Bank' },
            { id: 'chat' as Tab, icon: '💬', label: 'Chat' }
          ].map((tab) => {
            const hasUnread = tab.id === 'chat' && unreadChatCount > 0
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  // Clear unread count when opening chat tab
                  if (tab.id === 'chat') {
                    setUnreadChatCount(0)
                    setLastReadChatTime(Date.now())
                  }
                }}
                aria-label={tab.label}
                className={`child-mobile-nav-button flex flex-col items-center justify-center gap-1 px-1 py-2 transition-all touch-manipulation relative ${
                  activeTab === tab.id 
                    ? 'text-[var(--primary)]' 
                    : hasUnread
                      ? 'text-orange-500'
                      : 'text-[var(--text-secondary)]'
                }`}
              >
                <span className="text-2xl relative">
                  {tab.icon}
                  {hasUnread && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                      {unreadChatCount > 9 ? '9+' : unreadChatCount}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-semibold leading-tight text-center max-w-[56px] truncate child-nav-label">
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Completion Modal */}
      {showCompletionModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overscroll-contain">
          <div className="cb-card w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <h3 className="cb-heading-lg text-center mb-4 text-[var(--primary)]">
              ✅ Complete Chore
            </h3>
            
            <div className="mb-6 p-4 bg-[var(--background)] rounded-[var(--radius-lg)]">
              <h4 className="font-bold text-[var(--text-primary)] mb-2">
                {selectedAssignment.chore.title}
              </h4>
              <p className="text-sm text-[var(--text-secondary)]">
                {selectedAssignment.chore.description || 'Complete this task to earn your reward!'}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="cb-chip bg-[var(--success)]/10 text-[var(--success)]">
                  💰 £{(selectedAssignment.chore.baseRewardPence / 100).toFixed(2)}
                </span>
                <span className="cb-chip bg-yellow-100 text-yellow-700">
                  ⭐ {selectedAssignment.chore.starsOverride || Math.max(1, Math.floor(selectedAssignment.chore.baseRewardPence / 10))}
                </span>
              </div>
            </div>

            {selectedAssignment.chore.proof === 'note' && (
              <div className="mb-4">
                <label className="block font-semibold text-[var(--text-primary)] mb-2">
                  📝 Tell Us How You Did It
                </label>
                <textarea
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  className="w-full min-h-[120px] px-4 py-3 text-base sm:text-sm border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none resize-none touch-manipulation"
                  rows={4}
                  placeholder="Tell us how you completed this chore..."
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCompletionModal(false)
                  setSelectedAssignment(null)
                  setCompletionNote('')
                }}
                className="min-h-[44px] flex-1 px-6 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] font-semibold hover:bg-[var(--background)] active:bg-[var(--card-border)] transition-all touch-manipulation"
                disabled={completingChore}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitCompletion}
                disabled={completingChore}
                className="min-h-[44px] flex-1 cb-button-primary disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              >
                {completingChore ? '⏳ Submitting...' : '✅ Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Theme Picker Modal */}
      {showThemePicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overscroll-contain">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white p-6 rounded-t-3xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold mb-1">🎨 Choose Your Theme!</h2>
                  <p className="text-white/90">Pick your favorite style</p>
                </div>
                <button
                  onClick={() => setShowThemePicker(false)}
                  className="min-w-[44px] min-h-[44px] w-10 h-10 sm:w-10 sm:h-10 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full flex items-center justify-center text-2xl transition-all touch-manipulation"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 grid gap-4 sm:grid-cols-2">
              {Object.values(childThemes).map((theme) => {
                const isActive = theme.id === currentTheme.id
                
                return (
                  <button
                    key={theme.id}
                    onClick={() => handleThemeChange(theme.id)}
                    className={`text-left p-6 rounded-2xl border-4 transition-all transform hover:scale-105 ${
                      isActive
                        ? 'border-[var(--primary)] bg-gradient-to-br from-[var(--primary)]/10 to-[var(--secondary)]/10 shadow-lg'
                        : 'border-gray-200 hover:border-[var(--primary)]/50 bg-white'
                    }`}
                    style={{
                      background: isActive 
                        ? `linear-gradient(135deg, ${theme.colors.primary}15, ${theme.colors.secondary}15)`
                        : 'white'
                    }}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div 
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shadow-lg"
                        style={{
                          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`
                        }}
                      >
                        {theme.emoji}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-xl mb-1" style={{ color: theme.colors.primary }}>
                          {theme.name}
                          {isActive && ' ✓'}
                        </h3>
                        <p className="text-sm text-gray-600">{theme.description}</p>
                      </div>
                    </div>

                    {/* Theme Color Preview */}
                    <div className="flex gap-2">
                      <div 
                        className="w-8 h-8 rounded-lg shadow-md"
                        style={{ backgroundColor: theme.colors.primary }}
                        title="Primary"
                      ></div>
                      <div 
                        className="w-8 h-8 rounded-lg shadow-md"
                        style={{ backgroundColor: theme.colors.secondary }}
                        title="Secondary"
                      ></div>
                      <div 
                        className="w-8 h-8 rounded-lg shadow-md"
                        style={{ backgroundColor: theme.colors.accent }}
                        title="Accent"
                      ></div>
                      <div 
                        className="w-8 h-8 rounded-lg shadow-md"
                        style={{ backgroundColor: theme.colors.success }}
                        title="Success"
                      ></div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="p-6 bg-gray-50 rounded-b-3xl">
              <p className="text-center text-sm text-gray-600">
                💡 Your theme will be saved and applied every time you log in!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Confetti Celebration */}
      <Confetti active={showConfetti} />
    </div>
  )
}

export default ChildDashboard

