import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api'
import { choreTemplates, categoryLabels, calculateSuggestedReward, type ChoreTemplate } from '../data/choreTemplates'
import { formatCurrency } from '../utils/currency'
import { notifyUpdate } from '../utils/notifications'
import { useRealtimeUpdates } from '../hooks/useRealtimeUpdates'
import { useSocket } from '../contexts/SocketContext'
import { handleApiError } from '../utils/errorHandler'
import Toast from '../components/Toast'
import Confetti from '../components/Confetti'
import { FamilyChat } from '../components/FamilyChat'

// Type definitions
interface Family {
  id: string
  nameCipher: string
  holidayMode?: boolean | null
  holidayStartDate?: string | null
  holidayEndDate?: string | null
  giftsEnabled?: boolean | null
  [key: string]: any
}

interface Child {
  id: string
  nickname: string
  ageGroup?: string
  [key: string]: any
}

interface Chore {
  id: string
  title: string
  active?: boolean
  frequency?: string
  baseRewardPence?: number
  starsOverride?: number
  [key: string]: any
}

interface Assignment {
  id: string
  choreId: string
  childId?: string | null
  chore?: Chore
  [key: string]: any
}

interface Completion {
  id: string
  childId: string
  timestamp: string
  assignment?: Assignment
  [key: string]: any
}

// Helper function to format relative time
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}

const ParentDashboard: React.FC = () => {
  const { user, logout } = useAuth()
  
  /**
   * Notifies child dashboards of chore updates
   * Uses shared notification utility for cross-tab communication
   */
  const notifyChildDashboards = () => {
    notifyUpdate('choreUpdated')
  }

  /**
   * Notifies child dashboards of redemption updates
   * Uses shared notification utility for cross-tab communication
   */
  const notifyChildDashboardsOfRedemption = () => {
    notifyUpdate('redemptionUpdated')
  }
  const [family, setFamily] = useState<Family | null>(null)
  const [holidayOptimisticUntil, setHolidayOptimisticUntil] = useState<number>(0)
  const [members, setMembers] = useState<any[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [chores, setChores] = useState<Chore[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [pendingCompletions, setPendingCompletions] = useState<Completion[]>([])
  const [recentCompletions, setRecentCompletions] = useState<Completion[]>([]) // All recent completions for activity feed
  const [activityTab, setActivityTab] = useState<'recent' | 'history'>('recent') // Family Activity tabs
  const [pendingRedemptions, setPendingRedemptions] = useState<any[]>([])
  const [starPurchases, setStarPurchases] = useState<any[]>([])
  const [pendingStarPurchases, setPendingStarPurchases] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [budget, setBudget] = useState<any>(null)
  const [joinCodes, setJoinCodes] = useState<any[]>([])
  const [wallets, setWallets] = useState<any[]>([]) // Child wallets for star totals
  const [walletStats, setWalletStats] = useState<Map<string, any>>(new Map()) // Wallet stats per child (lifetime earnings)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  
  // Toast & Confetti
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  
  // Refs for polling
  const previousChildCountRef = useRef(0)
  
  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteType, setInviteType] = useState<'child' | 'adult'>('child')
  const [adultRole, setAdultRole] = useState<'parent_co_parent' | 'parent_viewer' | 'grandparent' | 'uncle_aunt' | 'relative_contributor'>('parent_co_parent')
  const [adultName, setAdultName] = useState('')
  const [showFamilyModal, setShowFamilyModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'rivalry' | 'budget' | 'account'>('rivalry')
  const [showStreakSettingsModal, setShowStreakSettingsModal] = useState(false)
  const [streakSettingsTab, setStreakSettingsTab] = useState<'overview' | 'bonuses' | 'penalties' | 'protection'>('overview')
  const [showCreateChoreModal, setShowCreateChoreModal] = useState(false)
  const [showChoreLibraryModal, setShowChoreLibraryModal] = useState(false)
  const [showEditChoreModal, setShowEditChoreModal] = useState(false)
  const [selectedChore, setSelectedChore] = useState<any>(null)
  
  // Child profile modal
  const [showChildProfileModal, setShowChildProfileModal] = useState(false)
  const [selectedChild, setSelectedChild] = useState<any>(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [newJoinCode, setNewJoinCode] = useState<string | null>(null)
  const [childProfileTab, setChildProfileTab] = useState<'info' | 'device' | 'stats' | 'management'>('info')
  
  // Adult member management modal
  const [showAdultProfileModal, setShowAdultProfileModal] = useState(false)
  const [selectedAdult, setSelectedAdult] = useState<any>(null)
  const [adultProfileTab, setAdultProfileTab] = useState<'info' | 'device' | 'stats' | 'management'>('info')
  const [adultDeviceToken, setAdultDeviceToken] = useState<string | null>(null)
  const [generatingDeviceToken, setGeneratingDeviceToken] = useState(false)
  const [deviceTokenEmailSent, setDeviceTokenEmailSent] = useState(false)
  const [adultStats, setAdultStats] = useState<any>(null)
  const [loadingAdultStats, setLoadingAdultStats] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  
  // Payout system
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutChild, setPayoutChild] = useState<any>(null)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutChoreAmount, setPayoutChoreAmount] = useState('') // Amount from chores
  const [payoutMethod, setPayoutMethod] = useState<'cash' | 'bank_transfer' | 'other'>('cash')
  const [payoutNote, setPayoutNote] = useState('')
  
  // Holiday Mode
  const [holidayMode, setHolidayMode] = useState({
    familyHolidayMode: false,
    familyHolidayStartDate: '',
    familyHolidayEndDate: '',
    childHolidayModes: {} as Record<string, { enabled: boolean; startDate: string; endDate: string }>
  })
  
  // Streak Settings
  const [streakSettings, setStreakSettings] = useState({
    // Protection
    protectionDays: 1, // Grace period before penalties start
    
    // Bonuses (for consecutive completions)
    bonusEnabled: true,
    bonusDays: 7, // Days in a row to earn bonus
    bonusMoneyPence: 50, // 50p bonus
    bonusStars: 5,
    bonusType: 'both' as 'money' | 'stars' | 'both',
    
    // Penalties (escalating for repeated misses)
    penaltyEnabled: true,
    firstMissPence: 10, // 10p for first miss
    firstMissStars: 1,
    secondMissPence: 25, // 25p for second miss
    secondMissStars: 3,
    thirdMissPence: 50, // 50p for third miss
    thirdMissStars: 5,
    penaltyType: 'both' as 'money' | 'stars' | 'both',
    
    // Minimum balance protection (kids always keep at least this much)
    minBalancePence: 100, // Always keep at least 100p (£1)
    minBalanceStars: 10 // Always keep at least 10 stars
  })
  const [payouts, setPayouts] = useState<any[]>([])
  const [processingPayout, setProcessingPayout] = useState(false)
  
  // Gift system (stars and money)
  const [gifts, setGifts] = useState<any[]>([])
  const [showGiftStarsMoneyModal, setShowGiftStarsMoneyModal] = useState(false)
  const [giftChild, setGiftChild] = useState<any>(null)
  const [giftStars, setGiftStars] = useState('')
  const [giftMoney, setGiftMoney] = useState('')
  const [giftNote, setGiftNote] = useState('')
  const [processingGift, setProcessingGift] = useState(false)
  const [selectedGiftIds, setSelectedGiftIds] = useState<string[]>([]) // For payout modal
  
  // Account management
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false)
  const [showSuspendAccountModal, setShowSuspendAccountModal] = useState(false)
  const [showEmailChangeModal, setShowEmailChangeModal] = useState(false)
  const [accountSuspended, setAccountSuspended] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [newEmail, setNewEmail] = useState('')
  
  // Forms
  const [inviteData, setInviteData] = useState({ email: '', realName: '', nickname: '', birthYear: null as number | null, birthMonth: null as number | null })
  const [nicknameManuallyEdited, setNicknameManuallyEdited] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  
  const [familyName, setFamilyName] = useState('')
  const [familyLoading, setFamilyLoading] = useState(false)
  const [familyMessage, setFamilyMessage] = useState('')
  
  const [rivalrySettings, setRivalrySettings] = useState({
    enabled: true,
    minUnderbidDifference: 5,
    friendlyMode: true
  })
  
  const [budgetSettings, setBudgetSettings] = useState({
    maxBudgetPence: 0,
    budgetPeriod: 'weekly' as 'weekly' | 'monthly',
    showLifetimeEarnings: true,
    buyStarsEnabled: false,
    starConversionRatePence: 10 // Default 0.10p per star
  })
  const [buyStarsEnabledTemp, setBuyStarsEnabledTemp] = useState(false)
  const buyStarsEnabledTimeoutRef = useRef<number | null>(null)
  
  const [activeTab, setActiveTab] = useState<'all' | 'recurring' | 'pending' | 'completed'>('all')
  
  const [newChore, setNewChore] = useState({
    title: '',
    description: '',
    frequency: 'daily' as 'daily' | 'weekly' | 'once',
    proof: 'none' as 'none' | 'photo' | 'note',
    baseRewardPence: 50,
    starsOverride: null as number | null
  })

  const [choreAssignments, setChoreAssignments] = useState<{
    childIds: string[]
    biddingEnabled: boolean
  }>({
    childIds: [],
    biddingEnabled: false
  })

  const [showHolidayModal, setShowHolidayModal] = useState(false)

  // Gifts management
  const [giftsTab, setGiftsTab] = useState<'all' | 'pending' | 'history'>('all')
  const [familyGifts, setFamilyGifts] = useState<any[]>([])
  const [giftTemplates, setGiftTemplates] = useState<any[]>([])
  const [loadingGifts, setLoadingGifts] = useState(false)
  const [showAddGiftModal, setShowAddGiftModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const selectedTemplateRef = useRef<any>(null) // Ref to persist template during modal transition
  const [selectedGift, setSelectedGift] = useState<any>(null)
  const [showEditGiftModal, setShowEditGiftModal] = useState(false)
  const [giftFilters, setGiftFilters] = useState({ type: '', category: '', age: '', gender: '' })
  const [giftCategory, setGiftCategory] = useState<string>('all') // For gift category tabs
  const [redemptions, setRedemptions] = useState<any[]>([]) // All redemptions (pending and fulfilled)
  const [showGiftModal, setShowGiftModal] = useState(false) // For browsing admin templates
  const [showChatModal, setShowChatModal] = useState(false) // For full chat modal
  const [chatTab, setChatTab] = useState<'recent' | 'history'>('recent') // Chat modal tabs

  const parentLoadingRef = useRef(false)
  const uiBusyRef = useRef(false)
  const loadDashboardRef = useRef<(() => Promise<void>) | null>(null)
  const debounce = (fn: (...args: any[]) => void, wait = 400) => {
    let timeoutId: number | undefined
    return (...args: any[]) => {
      if (timeoutId) window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => fn(...args), wait)
    }
  }

  // Define loadDashboard FIRST so it can be used in other callbacks
  const loadDashboard = useCallback(async () => {
    if (parentLoadingRef.current) {
      console.log('⏸️ loadDashboard already in progress, skipping...')
      return
    }
    console.log('🔄 loadDashboard called - fetching latest data...')
    parentLoadingRef.current = true
    try {
      const [familyRes, membersRes, choresRes, assignmentsRes, pendingCompletionsRes, allCompletionsRes, redemptionsRes, starPurchasesRes, leaderboardRes, budgetRes, joinCodesRes, payoutsRes, giftsRes] = await Promise.allSettled([
        apiClient.getFamily(),
        apiClient.getFamilyMembers(),
        apiClient.listChores(),
        apiClient.listAssignments(),
        apiClient.listCompletions('pending'), // For approval section
        apiClient.listCompletions(), // All recent for activity feed
        apiClient.getRedemptions(), // Get all redemptions (pending and fulfilled) for history tab
        apiClient.getStarPurchases(), // Get all star purchases (pending and approved) for activity feed
        apiClient.getLeaderboard(),
        apiClient.getFamilyBudget(),
        apiClient.getFamilyJoinCodes(),
        apiClient.getPayouts(), // All payouts
        apiClient.listGifts() // All gifts (stars and money)
      ])

      if (familyRes.status === 'fulfilled') {
        const familyData = familyRes.value.family
        setFamily((prev: Family | null) => {
          if (familyData && Date.now() < holidayOptimisticUntil && prev) {
            return {
              ...familyData,
              holidayMode: prev.holidayMode,
              holidayStartDate: prev.holidayStartDate,
              holidayEndDate: prev.holidayEndDate,
            }
          }
          return familyData
        })

        // Load streak and holiday settings from family
        if (familyData) {
          const withinOptimistic = Date.now() < holidayOptimisticUntil
          // Don't update holiday mode state if modal is open or within optimistic window
          // Also don't update if modal was just initialized (to avoid overwriting user changes)
          if (!withinOptimistic && !showHolidayModal && !holidayModalInitializedRef.current) {
            setHolidayMode((prev: any) => ({
              ...prev,
              familyHolidayMode: familyData.holidayMode ?? false,
              familyHolidayStartDate: familyData.holidayStartDate
                ? new Date(familyData.holidayStartDate).toISOString().split('T')[0]
                : '',
              familyHolidayEndDate: familyData.holidayEndDate
                ? new Date(familyData.holidayEndDate).toISOString().split('T')[0]
                : '',
            }))
          }

          console.log('Loaded family data:', {
            bonusDays: familyData.bonusDays,
            bonusEnabled: familyData.bonusEnabled,
            streakProtectionDays: familyData.streakProtectionDays,
            hasBonusDays: 'bonusDays' in familyData,
          })
          setStreakSettings({
            protectionDays: familyData.streakProtectionDays ?? 1,
            bonusEnabled: familyData.bonusEnabled ?? true,
            bonusDays: familyData.bonusDays ?? 7,
            bonusMoneyPence: familyData.bonusMoneyPence ?? 50,
            bonusStars: familyData.bonusStars ?? 5,
            bonusType: (familyData.bonusType || 'both') as 'money' | 'stars' | 'both',
            penaltyEnabled: familyData.penaltyEnabled ?? true,
            firstMissPence: familyData.firstMissPence ?? 10,
            firstMissStars: familyData.firstMissStars ?? 1,
            secondMissPence: familyData.secondMissPence ?? 25,
            secondMissStars: familyData.secondMissStars ?? 3,
            thirdMissPence: familyData.thirdMissPence ?? 50,
            thirdMissStars: familyData.thirdMissStars ?? 5,
            penaltyType: (familyData.penaltyType || 'both') as 'money' | 'stars' | 'both',
            minBalancePence: familyData.minBalancePence ?? 100,
            minBalanceStars: familyData.minBalanceStars ?? 10,
          })
        }
      }
      if (membersRes.status === 'fulfilled') {
        setMembers(membersRes.value.members || [])
        const childrenList = membersRes.value.children || []
        
        // De-duplicate children by ID to prevent React key warnings
        const uniqueChildren: Child[] = Array.from(
          new Map(childrenList.map((child: any) => [child.id, child])).values()
        ) as Child[]
        setChildren(uniqueChildren)
        
        // Update ref for polling
        previousChildCountRef.current = uniqueChildren.length
        
        // Fetch wallets and wallet stats for all children
        const walletPromises = uniqueChildren.map((child: Child) => 
          apiClient.getWallet(child.id).catch(() => ({ wallet: { balancePence: 0 } }))
        )
        const walletStatsPromises = uniqueChildren.map((child: Child) => 
          apiClient.getWalletStats(child.id).catch(() => ({ stats: { lifetimeEarningsPence: 0, lifetimePaidOutPence: 0 } }))
        )
        const [walletResults, walletStatsResults] = await Promise.all([
          Promise.all(walletPromises),
          Promise.all(walletStatsPromises)
        ])
        const walletsData = walletResults.map((result: { wallet?: { balancePence?: number; stars?: number } }, index: number) => ({
          childId: uniqueChildren[index]!.id,
          balancePence: result.wallet?.balancePence || 0,
          stars: result.wallet?.stars || 0
        }))
        setWallets(walletsData)
        
        // Store wallet stats in a Map by childId
        const statsMap = new Map<string, any>()
        walletStatsResults.forEach((result: { stats?: any }, index: number) => {
          if (uniqueChildren[index]) {
            statsMap.set(uniqueChildren[index]!.id, result.stats || { lifetimeEarningsPence: 0, lifetimePaidOutPence: 0 })
          }
        })
        setWalletStats(statsMap)
      }
      if (choresRes.status === 'fulfilled') {
        setChores(choresRes.value.chores || [])
        // Force re-render by updating a timestamp
        setLoading(false)
      }
      if (assignmentsRes.status === 'fulfilled') setAssignments(assignmentsRes.value.assignments || [])
      if (pendingCompletionsRes.status === 'fulfilled') setPendingCompletions(pendingCompletionsRes.value.completions || [])
      if (allCompletionsRes.status === 'fulfilled') setRecentCompletions(allCompletionsRes.value.completions || [])
      if (redemptionsRes.status === 'fulfilled') {
        const allRedemptions = redemptionsRes.value.redemptions || []
        setRedemptions(allRedemptions) // Store all redemptions for history tab
        setPendingRedemptions(allRedemptions.filter((r: any) => r.status === 'pending')) // Only pending for approval section
      }
      if (starPurchasesRes.status === 'fulfilled') {
        const allPurchases = starPurchasesRes.value.purchases || []
        setStarPurchases(allPurchases)
        setPendingStarPurchases(allPurchases.filter((p: any) => p.status === 'pending'))
      }
      if (leaderboardRes.status === 'fulfilled') {
        // Transform leaderboard data to flatten child object
        const transformedLeaderboard = (leaderboardRes.value.leaderboard || []).map((entry: any) => ({
          ...entry,
          nickname: entry.child?.nickname || 'Unknown',
          ageGroup: entry.child?.ageGroup
        }))
        setLeaderboard(transformedLeaderboard)
      }
      if (budgetRes.status === 'fulfilled') setBudget(budgetRes.value)
      if (joinCodesRes.status === 'fulfilled') setJoinCodes(joinCodesRes.value.joinCodes || [])
      if (payoutsRes.status === 'fulfilled') setPayouts(payoutsRes.value.payouts || [])
      if (giftsRes.status === 'fulfilled') setGifts(giftsRes.value.gifts || [])
    } catch (error) {
      const appError = handleApiError(error, 'Loading dashboard')
      console.error('Error loading dashboard:', appError)
      setToast({ message: appError.message, type: 'error' })
    } finally {
      parentLoadingRef.current = false
      setLoading(false)
    }
  }, []) // Empty deps - loadDashboard doesn't depend on any props/state that change

  // Store loadDashboard in ref for use in useEffect (avoids dependency issues)
  loadDashboardRef.current = loadDashboard

  useEffect(() => {
    // Use ref to call loadDashboard to avoid dependency issues
    if (loadDashboardRef.current) {
      loadDashboardRef.current()
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (buyStarsEnabledTimeoutRef.current) {
        clearTimeout(buyStarsEnabledTimeoutRef.current)
      }
    }
  }, []) // Empty deps - only run on mount

  // WebSocket connection for real-time updates
  const { socket, isConnected, on, off } = useSocket()

  /**
   * Listen for completion updates via WebSocket
   * This works across all devices, browsers, and tabs
   */
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('🔌 WebSocket not connected, skipping event listeners')
      return
    }

    console.log('👂 Setting up WebSocket listeners for parent dashboard')

    // Listen for completion created (child submits chore)
    const handleCompletionCreated = (data: any) => {
      console.log('📢 WebSocket: completion:created received', data)
      console.log('🔄 Refreshing parent dashboard...')
      loadDashboard()
    }

    // Listen for completion approved (parent approves, child needs to see wallet update)
    const handleCompletionApproved = (data: any) => {
      console.log('📢 WebSocket: completion:approved received', data)
      console.log('🔄 Refreshing parent dashboard...')
      loadDashboard()
    }

    // Listen for completion rejected (parent rejects, child needs to see status)
    const handleCompletionRejected = (data: any) => {
      console.log('📢 WebSocket: completion:rejected received', data)
      console.log('🔄 Refreshing parent dashboard...')
      loadDashboard()
    }

    // Listen for chore created (parent creates chore, children need to see it)
    const handleChoreCreated = (data: any) => {
      console.log('📢 WebSocket: chore:created received', data)
      console.log('🔄 Refreshing parent dashboard...')
      loadDashboard()
    }

    // Listen for assignment created (parent assigns chore to child)
    const handleAssignmentCreated = (data: any) => {
      console.log('📢 WebSocket: assignment:created received', data)
      console.log('🔄 Refreshing parent dashboard...')
      loadDashboard()
    }

    // Listen for assignment deleted (parent removes chore assignment)
    const handleAssignmentDeleted = (data: any) => {
      console.log('📢 WebSocket: assignment:deleted received', data)
      console.log('🔄 Refreshing parent dashboard...')
      loadDashboard()
    }

    // Listen for chore updated (parent updates chore details)
    const handleChoreUpdated = (data: any) => {
      console.log('📢 WebSocket: chore:updated received', data)
      console.log('🔄 Refreshing parent dashboard...')
      loadDashboard()
    }

    // Listen for redemption created (child redeems gift)
    const handleRedemptionCreated = (data: any) => {
      console.log('📢 WebSocket: redemption:created received', data)
      console.log('🔄 Refreshing parent dashboard...')
      loadDashboard()
    }

    // Listen for redemption fulfilled (parent fulfills redemption)
    const handleRedemptionFulfilled = (data: any) => {
      console.log('📢 WebSocket: redemption:fulfilled received', data)
      console.log('🔄 Refreshing parent dashboard...')
      loadDashboard()
    }

    // Listen for redemption rejected (parent rejects redemption)
    const handleRedemptionRejected = (data: any) => {
      console.log('📢 WebSocket: redemption:rejected received', data)
      console.log('🔄 Refreshing parent dashboard...')
      loadDashboard()
    }

    // Listen for gift created/updated (parent adds/updates gifts)
    const handleGiftCreated = (data: any) => {
      console.log('📢 WebSocket: gift:created received', data)
      console.log('🔄 Refreshing parent dashboard...')
      loadDashboard()
    }

    const handleGiftUpdated = (data: any) => {
      console.log('📢 WebSocket: gift:updated received', data)
      console.log('🔄 Refreshing parent dashboard...')
      loadDashboard()
    }

    // Listen for star purchase created (child buys stars)
    const handleStarPurchaseCreated = (data: any) => {
      console.log('📢 WebSocket: starPurchase:created received', data)
      console.log('🔄 Refreshing parent dashboard...')
      loadDashboard()
    }

    // Listen for star purchase approved (parent approves, child needs to see wallet update)
    const handleStarPurchaseApproved = (data: any) => {
      console.log('📢 WebSocket: starPurchase:approved received', data)
      console.log('🔄 Refreshing parent dashboard...')
      loadDashboard()
    }

    // Listen for star purchase rejected (parent rejects, child needs to see wallet update)
    const handleStarPurchaseRejected = (data: any) => {
      console.log('📢 WebSocket: starPurchase:rejected received', data)
      console.log('🔄 Refreshing parent dashboard...')
      loadDashboard()
    }

    // Listen for family settings updated (holiday mode, shop enable/disable, streak settings)
    const handleFamilySettingsUpdated = (data: any) => {
      console.log('📢 WebSocket: family:settings:updated received', data)
      const familyData = data.family
      
      if (familyData) {
        // Update family state immediately
        setFamily((prev: Family | null) => {
          if (!prev) return prev
          return {
            ...prev,
            ...familyData
          }
        })
        
        // Update budget settings immediately
        setBudgetSettings((prev: any) => ({
          ...prev,
          buyStarsEnabled: familyData.buyStarsEnabled ?? prev.buyStarsEnabled,
          starConversionRatePence: familyData.starConversionRatePence ?? prev.starConversionRatePence,
          giftsEnabled: familyData.giftsEnabled ?? prev.giftsEnabled
        }))
        
        // Update streak settings immediately
        setStreakSettings((prev: any) => ({
          ...prev,
          protectionDays: familyData.streakProtectionDays ?? prev.protectionDays,
          bonusEnabled: familyData.bonusEnabled ?? prev.bonusEnabled,
          bonusDays: familyData.bonusDays ?? prev.bonusDays,
          bonusMoneyPence: familyData.bonusMoneyPence ?? prev.bonusMoneyPence,
          bonusStars: familyData.bonusStars ?? prev.bonusStars,
          bonusType: familyData.bonusType ?? prev.bonusType,
          penaltyEnabled: familyData.penaltyEnabled ?? prev.penaltyEnabled,
          firstMissPence: familyData.firstMissPence ?? prev.firstMissPence,
          firstMissStars: familyData.firstMissStars ?? prev.firstMissStars,
          secondMissPence: familyData.secondMissPence ?? prev.secondMissPence,
          secondMissStars: familyData.secondMissStars ?? prev.secondMissStars,
          thirdMissPence: familyData.thirdMissPence ?? prev.thirdMissPence,
          thirdMissStars: familyData.thirdMissStars ?? prev.thirdMissStars,
          penaltyType: familyData.penaltyType ?? prev.penaltyType,
          minBalancePence: familyData.minBalancePence ?? prev.minBalancePence,
          minBalanceStars: familyData.minBalanceStars ?? prev.minBalanceStars
        }))
        
        // Update holiday mode immediately - ONLY if modal is not open (to avoid overwriting user's changes)
        if (!showHolidayModal) {
          setHolidayMode((prev: any) => ({
            ...prev,
            familyHolidayMode: familyData.holidayMode ?? false,
            familyHolidayStartDate: familyData.holidayStartDate
              ? new Date(familyData.holidayStartDate).toISOString().split('T')[0]
              : '',
            familyHolidayEndDate: familyData.holidayEndDate
              ? new Date(familyData.holidayEndDate).toISOString().split('T')[0]
              : ''
          }))
        } else {
          console.log('⚠️ Holiday modal is open, skipping holiday mode state update to avoid overwriting user changes')
        }
      }
      
      // Don't call loadDashboard here - it will overwrite optimistic updates
      // The state has already been updated above, and loadDashboard will be called
      // by the fallback polling system if needed
    }

    // Listen for child pause status updated (individual child holiday mode)
    const handleChildPauseUpdated = (data: any) => {
      console.log('📢 WebSocket: child:pause:updated received', data)
      console.log('🔄 Refreshing parent dashboard...')
      loadDashboard()
    }

    // Register listeners
    on('completion:created', handleCompletionCreated)
    on('completion:approved', handleCompletionApproved)
    on('completion:rejected', handleCompletionRejected)
    on('chore:created', handleChoreCreated)
    on('assignment:created', handleAssignmentCreated)
    on('assignment:deleted', handleAssignmentDeleted)
    on('chore:updated', handleChoreUpdated)
    on('redemption:created', handleRedemptionCreated)
    on('redemption:fulfilled', handleRedemptionFulfilled)
    on('redemption:rejected', handleRedemptionRejected)
    on('gift:created', handleGiftCreated)
    on('gift:updated', handleGiftUpdated)
    on('starPurchase:created', handleStarPurchaseCreated)
    on('starPurchase:approved', handleStarPurchaseApproved)
    on('starPurchase:rejected', handleStarPurchaseRejected)
    on('family:settings:updated', handleFamilySettingsUpdated)
    on('child:pause:updated', handleChildPauseUpdated)

    // Cleanup
    return () => {
      off('completion:created', handleCompletionCreated)
      off('completion:approved', handleCompletionApproved)
      off('completion:rejected', handleCompletionRejected)
      off('chore:created', handleChoreCreated)
      off('assignment:created', handleAssignmentCreated)
      off('assignment:deleted', handleAssignmentDeleted)
      off('chore:updated', handleChoreUpdated)
      off('redemption:created', handleRedemptionCreated)
      off('redemption:fulfilled', handleRedemptionFulfilled)
      off('redemption:rejected', handleRedemptionRejected)
      off('gift:created', handleGiftCreated)
      off('gift:updated', handleGiftUpdated)
      off('starPurchase:created', handleStarPurchaseCreated)
      off('starPurchase:approved', handleStarPurchaseApproved)
      off('starPurchase:rejected', handleStarPurchaseRejected)
      off('family:settings:updated', handleFamilySettingsUpdated)
      off('child:pause:updated', handleChildPauseUpdated)
    }
  }, [socket, isConnected, on, off, loadDashboard])

  // Fallback: Keep existing client-side system as backup
  const handleCompletionUpdate = useCallback(() => {
    console.log('🔄 Completion update detected (fallback), refreshing parent dashboard...')
    loadDashboard()
  }, [loadDashboard])

  useRealtimeUpdates({
    eventTypes: ['completionUpdated'],
    onUpdate: handleCompletionUpdate,
    enablePolling: true,
    pollingInterval: 5000, // Poll every 5 seconds as fallback
    useVisibilityAPI: true
  })
  
  // Initialize holiday mode state when modal opens (only on open, not on family changes)
  const holidayModalInitializedRef = useRef(false)
  useEffect(() => {
    if (showHolidayModal && family && !holidayModalInitializedRef.current) {
      console.log('🌴 Holiday modal opened, initializing state from family data:', {
        holidayMode: family.holidayMode,
        holidayStartDate: family.holidayStartDate,
        holidayEndDate: family.holidayEndDate
      })
      setHolidayMode(prev => ({
        ...prev,
        familyHolidayMode: family.holidayMode ?? false,
        familyHolidayStartDate: family.holidayStartDate
          ? new Date(family.holidayStartDate).toISOString().split('T')[0]
          : '',
        familyHolidayEndDate: family.holidayEndDate
          ? new Date(family.holidayEndDate).toISOString().split('T')[0]
          : '',
      }))
      holidayModalInitializedRef.current = true
    } else if (!showHolidayModal) {
      // Reset flag when modal closes so it can initialize again next time
      holidayModalInitializedRef.current = false
    }
  }, [showHolidayModal, family])
  
  // Poll for child joins when there are active join codes
  useEffect(() => {
    if (joinCodes.length === 0) return // No active join codes, no need to poll
    
    console.log('🔄 Starting join code polling - checking for new children every 5 seconds')
    
    const checkForNewChildren = async () => {
      try {
        console.log('🔍 Checking for new children who joined via join codes...')
        const response = await apiClient.getFamilyMembers()
        const currentChildCount = response.children?.length || 0
        const previousChildCount = previousChildCountRef.current
        
        console.log(`🔍 Child count: previous=${previousChildCount}, current=${currentChildCount}`)
        
        if (currentChildCount > previousChildCount) {
          console.log('🎉 New child detected! Refreshing dashboard...')
          loadDashboard()
        }
        
        // Update the ref for next comparison
        previousChildCountRef.current = currentChildCount
      } catch (error) {
        handleApiError(error, 'Checking for new children')
      }
    }
    
    // Check immediately
    checkForNewChildren()
    
    // Then check every 5 seconds
    const joinPollInterval = setInterval(checkForNewChildren, 5000)
    console.log('👂 Parent dashboard polling for child joins every 5 seconds')
    
    return () => {
      clearInterval(joinPollInterval)
      console.log('🛑 Stopped join code polling')
    }
  }, [joinCodes.length, children.length, loadDashboard]) // Re-run when join codes or children change
  
  useEffect(() => {
    if (family) {
      setFamilyName(family.nameCipher || '')
      // Always update budget settings when family data changes
      setBudgetSettings({
        maxBudgetPence: family.maxBudgetPence || 0,
        budgetPeriod: family.budgetPeriod || 'weekly',
        showLifetimeEarnings: family.showLifetimeEarnings !== false, // Default to true
        buyStarsEnabled: family.buyStarsEnabled || false,
        starConversionRatePence: family.starConversionRatePence || 10
      })
      setBuyStarsEnabledTemp(false) // Reset temp state when family data loads
    }
  }, [family])

  const loadFamilyGifts = async () => {
    try {
      setLoadingGifts(true)
      const response = await apiClient.getFamilyGifts()
      setFamilyGifts(response.gifts || [])
    } catch (error) {
      const appError = handleApiError(error, 'Loading family gifts')
      console.error('Failed to load family gifts:', appError)
      setToast({ message: appError.message, type: 'error' })
    } finally {
      setLoadingGifts(false)
    }
  }

  const loadGiftTemplates = async () => {
    try {
      setLoadingGifts(true)
      const params: any = {}
      if (giftFilters.type) params.type = giftFilters.type
      if (giftFilters.category) params.category = giftFilters.category
      if (giftFilters.age) params.age = giftFilters.age
      if (giftFilters.gender) params.gender = giftFilters.gender
      
      const response = await apiClient.getGiftTemplates(params)
      setGiftTemplates(response.templates || [])
    } catch (error) {
      const appError = handleApiError(error, 'Loading gift templates')
      console.error('Failed to load gift templates:', appError)
      setToast({ message: appError.message, type: 'error' })
    } finally {
      setLoadingGifts(false)
    }
  }

  const loadRedemptions = async () => {
    try {
      const response = await apiClient.getRedemptions()
      setRedemptions(response.redemptions || [])
    } catch (error) {
      console.error('Failed to load redemptions:', error)
    }
  }

  useEffect(() => {
    loadFamilyGifts()
    loadRedemptions()
  }, [])

  useEffect(() => {
    if (showGiftModal) {
      loadGiftTemplates()
    }
  }, [showGiftModal, giftFilters])

  // Handle real name change and autofill nickname
  const handleRealNameChange = (realName: string) => {
    setInviteData((prev: any) => {
      const newData = { ...prev, realName }
      
      // Auto-fill nickname with first name if we have a name and user hasn't manually edited nickname
      if (realName.trim() && !nicknameManuallyEdited) {
        const firstName = realName.trim().split(' ')[0]
        newData.nickname = firstName
      }
      
      return newData
    })
  }

  // Handle nickname change and track manual edits
  const handleNicknameChange = (nickname: string) => {
    setInviteData((prev: any) => ({ ...prev, nickname }))
    setNicknameManuallyEdited(true)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteLoading(true)
    setInviteMessage('')

    // ADULT INVITE FLOW
    if (inviteType === 'adult') {
      try {
        if (!inviteData.email) {
          setInviteMessage('❌ Email is required for parent/relative invites')
          setInviteLoading(false)
          return
        }
        const result = await apiClient.inviteToFamily({
          email: inviteData.email,
          role: adultRole,
          nameCipher: family?.nameCipher || 'Family',
          nickname: adultName || 'Parent',
          sendEmail: true
        })
        const info = result?.emailSent ? ` – Sent to ${inviteData.email}` : (result?.token ? ` – Token: ${result.token}` : '')
        setInviteMessage(`✅ Invite created${info}`)
        setInviteLoading(false)
        return
      } catch (error: any) {
        setInviteMessage(`❌ ${error.message}`)
        setInviteLoading(false)
        return
      }
    }

    // CHILD INVITE FLOW
    if (!inviteData.realName.trim()) {
      setInviteMessage('❌ Name is required')
      setInviteLoading(false)
      return
    }

    if (!inviteData.birthYear) {
      setInviteMessage('❌ Birth year is required to calculate age group')
      setInviteLoading(false)
      return
    }

    try {
      // Calculate age group from birth year
      const currentYear = new Date().getFullYear()
      let age = currentYear - inviteData.birthYear
      
      // Adjust age if month is provided and birthday hasn't occurred this year
      if (inviteData.birthMonth !== null) {
        const currentMonth = new Date().getMonth() + 1
        if (currentMonth < inviteData.birthMonth) {
          age--
        }
      }
      
      let ageGroup = '5-8'
      if (age <= 8) ageGroup = '5-8'
      else if (age <= 11) ageGroup = '9-11'
      else if (age <= 15) ageGroup = '12-15'
      else ageGroup = '12-15' // Default to oldest group

      // Use nickname if provided, otherwise use first name from real name
      const nickname = inviteData.nickname.trim() || inviteData.realName.trim().split(' ')[0]

      const result = await apiClient.inviteToFamily({
        email: inviteData.email || undefined, // Make email optional
        role: 'child_player',
        nameCipher: family?.nameCipher || 'Family',
        nickname: nickname,
        ageGroup: ageGroup,
        birthYear: inviteData.birthYear || undefined,
        birthMonth: inviteData.birthMonth || undefined,
        sendEmail: !!inviteData.email // Only send email if provided
      })

      const emailMessage = inviteData.email ? ` – Sent to ${inviteData.email}` : ' – No email provided'
      setInviteMessage(`✅ Join code: ${result.joinCode}${emailMessage}`)
      // Refresh join codes list immediately
      try {
        const joinCodesResponse = await apiClient.getFamilyJoinCodes()
        console.log('Refreshed join codes:', joinCodesResponse.joinCodes)
        setJoinCodes(joinCodesResponse.joinCodes || [])
      } catch (error) {
        console.error('Failed to refresh join codes:', error)
      }
      setTimeout(() => {
        setShowInviteModal(false)
        setInviteMessage('')
        setInviteData({ email: '', realName: '', nickname: '', birthYear: null, birthMonth: null })
        setNicknameManuallyEdited(false)
        loadDashboard()
      }, 3000)
    } catch (error: any) {
      setInviteMessage(`❌ ${error.message}`)
    } finally {
      setInviteLoading(false)
    }
  }

  const handleUpdateFamily = async (e: React.FormEvent) => {
    e.preventDefault()
    setFamilyLoading(true)
    setFamilyMessage('')

    try {
      await apiClient.updateFamily({ nameCipher: familyName })
      setFamilyMessage('✅ Family name updated successfully!')
      if (family) {
        setFamily({ ...family, nameCipher: familyName })
      }
      setTimeout(() => {
        setShowFamilyModal(false)
        setFamilyMessage('')
      }, 2000)
    } catch (error: any) {
      setFamilyMessage(`❌ ${error.message}`)
    } finally {
      setFamilyLoading(false)
    }
  }

  const handleSelectChoreTemplate = (template: ChoreTemplate) => {
    // Calculate suggested reward based on weekly budget
    const weeklyBudgetPence = budget?.maxBudgetPence || 2000 // Default £20/week
    const budgetToUse = budget?.budgetPeriod === 'monthly' ? weeklyBudgetPence / 4 : weeklyBudgetPence
    const suggestedReward = calculateSuggestedReward(template, budgetToUse)

    // Populate the form with template data
    setNewChore({
      title: template.title,
      description: template.description,
      frequency: template.frequency,
      proof: 'none', // Parents can change this
      baseRewardPence: suggestedReward,
      starsOverride: null
    })

    // Close library and open custom form
    setShowChoreLibraryModal(false)
    setShowCreateChoreModal(true)
  }

  const handleCreateChore = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Prepare chore data - convert null to undefined for optional fields
      const choreData = {
        ...newChore,
        starsOverride: newChore.starsOverride ?? undefined
      }
      
      // Create the chore first
      const result = await apiClient.createChore(choreData)
      const choreId = result.chore.id

      // Create assignments for each selected child
      if (choreAssignments.childIds.length > 0) {
        const assignmentPromises = choreAssignments.childIds.map((childId: string) => {
          return apiClient.createAssignment({
            choreId,
            childId,
            biddingEnabled: choreAssignments.biddingEnabled
          })
        })
        await Promise.all(assignmentPromises)
      }

      // Notify child dashboards IMMEDIATELY after successful creation
      // This ensures child dashboards get the update even before parent dashboard reloads
      notifyChildDashboards()
      
      // Reset form and close modal
      setShowCreateChoreModal(false)
      setNewChore({
        title: '',
        description: '',
        frequency: 'daily',
        proof: 'none',
        baseRewardPence: 50,
        starsOverride: null
      })
      setChoreAssignments({
        childIds: [],
        biddingEnabled: false
      })
      
      // Small delay to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Reload dashboard
      await loadDashboard()
      
      // Notify again after reload to ensure child dashboards get the update
      notifyChildDashboards()
      
      // Force component refresh
      setRefreshKey((prev: number) => prev + 1)
      
      // Show success message
      setToast({ message: '✅ Chore created successfully!', type: 'success' })
    } catch (error) {
      console.error('❌ Error creating chore:', error)
      setToast({ message: 'Failed to create chore. Please try again.', type: 'error' })
    }
  }

  const handleApproveCompletion = async (completionId: string) => {
    try {
      const result = await apiClient.approveCompletion(completionId)
      
      // Notify child dashboards IMMEDIATELY after successful approval
      // This ensures instant update on child dashboard (wallet balance, completion status)
      console.log('📢 Notifying child dashboards of completion approval...')
      notifyChildDashboards()
      
      // Check for rivalry bonus (DOUBLE STARS!)
      if (result.rivalryBonus) {
        setShowConfetti(true)
        setToast({ 
          message: `🏆 RIVALRY WINNER! Earned £${(result.rivalryBonus.doubledReward / 100).toFixed(2)} + DOUBLE STARS (2⭐)!`, 
          type: 'success' 
        })
        setTimeout(() => setShowConfetti(false), 3000)
      }
      // Check for streak bonus
      else if (result.streakBonus) {
        setShowConfetti(true)
        setToast({ 
          message: `🎉 Approved! +${result.streakBonus.stars} BONUS stars for ${result.streakBonus.streakLength}-day streak!`, 
          type: 'success' 
        })
        setTimeout(() => setShowConfetti(false), 2000)
      } else {
        setToast({ message: '✅ Chore approved! Wallet credited', type: 'success' })
      }
      
      // Small delay to ensure DB is updated, then reload
      await new Promise(resolve => setTimeout(resolve, 300))
      await loadDashboard()
      
      // Notify again after reload to ensure child dashboards get the update
      console.log('📢 Notifying child dashboards again after reload...')
      notifyChildDashboards()
    } catch (error) {
      console.error('Error approving completion:', error)
      setToast({ message: 'Failed to approve. Please try again.', type: 'error' })
    }
  }

  const handleRejectCompletion = async (completionId: string) => {
    const reason = prompt('Why are you rejecting this? (optional)')
    try {
      await apiClient.rejectCompletion(completionId, reason || undefined)
      
      // Notify child dashboards IMMEDIATELY after rejection
      console.log('📢 Notifying child dashboards of completion rejection...')
      notifyChildDashboards()
      
      setToast({ message: 'Chore rejected', type: 'warning' })
      
      // Small delay to ensure DB is updated, then reload
      await new Promise(resolve => setTimeout(resolve, 300))
      await loadDashboard()
      
      // Notify again after reload
      notifyChildDashboards()
    } catch (error) {
      console.error('Error rejecting completion:', error)
      setToast({ message: 'Failed to reject. Please try again.', type: 'error' })
    }
  }

  const handleApproveRedemption = async (redemptionId: string) => {
    try {
      await apiClient.fulfillRedemption(redemptionId)
      setToast({ message: '✅ Gift approved!', type: 'success' })
      
      // Small delay to ensure DB is updated, then reload
      await new Promise(resolve => setTimeout(resolve, 300))
      await loadDashboard()
      
      // Notify child dashboards of the redemption update
      notifyChildDashboardsOfRedemption()
    } catch (error) {
      console.error('Error approving redemption:', error)
      setToast({ message: 'Failed to approve. Please try again.', type: 'error' })
    }
  }

  const handleRejectRedemption = async (redemptionId: string) => {
    const reason = prompt('Why are you rejecting this gift redemption? (optional)')
    try {
      await apiClient.rejectRedemption(redemptionId)
      setToast({ message: 'Gift redemption rejected. Stars refunded to child.', type: 'warning' })
      
      // Small delay to ensure DB is updated, then reload
      await new Promise(resolve => setTimeout(resolve, 300))
      await loadDashboard()
      
      // Notify child dashboards of the redemption update (stars refunded)
      notifyChildDashboardsOfRedemption()
    } catch (error) {
      console.error('Error rejecting redemption:', error)
      setToast({ message: 'Failed to reject. Please try again.', type: 'error' })
    }
  }

  const handleApproveStarPurchase = async (purchaseId: string) => {
    try {
      await apiClient.approveStarPurchase(purchaseId)
      setToast({ message: 'Star purchase approved! Stars added to child.', type: 'success' })
      
      // Small delay to ensure DB is updated, then reload
      await new Promise(resolve => setTimeout(resolve, 300))
      await loadDashboard()
      
      // Notify child dashboards of the update
      notifyChildDashboardsOfRedemption()
    } catch (error) {
      console.error('Error approving star purchase:', error)
      setToast({ message: 'Failed to approve. Please try again.', type: 'error' })
    }
  }

  const handleRejectStarPurchase = async (purchaseId: string) => {
    try {
      await apiClient.rejectStarPurchase(purchaseId)
      setToast({ message: 'Star purchase rejected. Money refunded to child.', type: 'warning' })
      
      // WebSocket will trigger dashboard refresh automatically
      // No need to manually reload or notify
    } catch (error) {
      console.error('Error rejecting star purchase:', error)
      setToast({ message: 'Failed to reject. Please try again.', type: 'error' })
    }
  }

  const handleFulfillRedemption = async (redemptionId: string) => {
    try {
      await apiClient.fulfillRedemption(redemptionId)
      setShowConfetti(true)
      setToast({ message: '🎁 Reward marked as delivered!', type: 'success' })
      setTimeout(() => setShowConfetti(false), 2000)
      await loadDashboard()
      
      // Notify child dashboards of the redemption fulfillment
      notifyChildDashboards()
    } catch (error) {
      console.error('Error fulfilling redemption:', error)
      setToast({ message: 'Failed to fulfill. Please try again.', type: 'error' })
    }
  }

  const handleProcessPayout = async (e: React.FormEvent) => {
    e.preventDefault()
    setProcessingPayout(true)
    
    try {
      const amountPence = Math.round(parseFloat(payoutAmount) * 100)
      const choreAmountPence = payoutChoreAmount ? Math.round(parseFloat(payoutChoreAmount) * 100) : 0
      
      if (isNaN(amountPence) || amountPence <= 0) {
        setToast({ message: 'Please enter a valid amount', type: 'error' })
        return
      }

      if (choreAmountPence < 0) {
        setToast({ message: 'Chore amount cannot be negative', type: 'error' })
        return
      }

      await apiClient.createPayout({
        childId: payoutChild.id,
        amountPence,
        choreAmountPence: choreAmountPence > 0 ? choreAmountPence : undefined,
        method: payoutMethod,
        note: payoutNote || undefined,
        giftIds: selectedGiftIds.length > 0 ? selectedGiftIds : undefined
      })

      setShowConfetti(true)
      setToast({ message: `💰 £${payoutAmount} paid out to ${payoutChild.nickname}!`, type: 'success' })
      setTimeout(() => setShowConfetti(false), 2000)
      
      // Reset form
      setShowPayoutModal(false)
      setPayoutAmount('')
      setPayoutChoreAmount('')
      setPayoutNote('')
      setPayoutMethod('cash')
      setPayoutChild(null)
      setSelectedGiftIds([])
      
      // Reload dashboard
      await loadDashboard()
      
      // Notify child dashboards of the payout
      notifyChildDashboards()
    } catch (error: any) {
      console.error('Error processing payout:', error)
      const errorMsg = error.message || 'Failed to process payout'
      setToast({ message: errorMsg, type: 'error' })
    } finally {
      setProcessingPayout(false)
    }
  }

  const handleProcessGift = async (e: React.FormEvent) => {
    e.preventDefault()
    setProcessingGift(true)
    
    try {
      const starsAmount = giftStars ? parseInt(giftStars) : 0
      const moneyPence = giftMoney ? Math.round(parseFloat(giftMoney) * 100) : 0
      
      if (starsAmount < 0 || moneyPence < 0) {
        setToast({ message: 'Gift amounts must be non-negative', type: 'error' })
        return
      }

      if (starsAmount === 0 && moneyPence === 0) {
        setToast({ message: 'Must gift either stars or money (or both)', type: 'error' })
        return
      }

      await apiClient.createGift({
        childId: giftChild.id,
        starsAmount: starsAmount || undefined,
        moneyPence: moneyPence || undefined,
        note: giftNote || undefined
      })

      setToast({ message: `🎁 Gift sent to ${giftChild.nickname}!`, type: 'success' })
      
      // Reset form
      setShowGiftStarsMoneyModal(false)
      setGiftStars('')
      setGiftMoney('')
      setGiftNote('')
      setGiftChild(null)
      
      // Reload dashboard
      await loadDashboard()
      
      // Notify child dashboards of the gift
      notifyChildDashboards()
    } catch (error: any) {
      console.error('Error creating gift:', error)
      const errorMsg = error.message || 'Failed to create gift'
      setToast({ message: errorMsg, type: 'error' })
    } finally {
      setProcessingGift(false)
    }
  }

  const filteredChores = chores.filter((chore: Chore) => {
    if (activeTab === 'all') return chore.active !== false // Show all active chores
    if (activeTab === 'recurring') return chore.frequency !== 'once' && chore.active !== false
    return true
  })

  // De-duplicate children array before rendering (defensive check)
  const uniqueChildren: Child[] = Array.from(
    new Map(children.map((child: Child) => [child.id, child])).values()
  ) as Child[]

  // For pending tab, show chores assigned but not yet completed
  const pendingChoresByChild = uniqueChildren.map((child: Child) => {
    if (activeTab !== 'pending') return { child, chores: [] }
    
    const childAssignments = assignments.filter((a: Assignment) => a.childId === child.id)
    
    // Get chores that have assignments but no approved completions
    // For weekly chores, check if the specific assignment has been approved
    // For daily chores, check if completed today
    const pendingChores: Array<{ chore: Chore; assignment: Assignment }> = childAssignments
      .filter((assignment: Assignment) => {
        const chore = assignment.chore
        if (!chore || !chore.active) return false
        
        // For weekly chores, check if THIS assignment has an approved completion
        // Weekly chores should show as pending until their specific assignment is approved
        if (chore.frequency === 'weekly') {
          const assignmentCompletions = recentCompletions.filter((c: Completion) => 
            c.childId === child.id && 
            c.assignmentId === assignment.id
          )
          const hasApprovedCompletion = assignmentCompletions.some((c: Completion) => c.status === 'approved')
          const hasPendingCompletion = pendingCompletions.some((c: Completion) => 
            c.childId === child.id && 
            c.assignmentId === assignment.id
          )
          
          // Show as pending chore if: no approved completion AND no pending completion (not yet submitted)
          // If there's a pending completion, it will show in "Pending Approvals" instead
          return !hasApprovedCompletion && !hasPendingCompletion
        }
        
        // For daily chores, check if completed today
        if (chore.frequency === 'daily') {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          
          const completedToday = recentCompletions.some((c: Completion) => 
            c.childId === child.id && 
            c.assignment?.choreId === chore.id &&
            new Date(c.timestamp) >= today &&
            c.status === 'approved'
          )
          return !completedToday
        }
        
        // For 'once' chores, check if THIS assignment has been approved
        const hasApprovedCompletion = recentCompletions.some((c: Completion) => 
          c.childId === child.id && 
          c.assignmentId === assignment.id &&
          c.status === 'approved'
        )
        return !hasApprovedCompletion
      })
      .map((assignment: Assignment) => ({
        chore: assignment.chore!,
        assignment
      }))
    
    // For weekly chores, deduplicate - only show the most recent assignment per chore
    const weeklyChoresMap = new Map<string, { chore: Chore; assignment: Assignment }>()
    const otherChores: Array<{ chore: Chore; assignment: Assignment }> = []
    
    pendingChores.forEach(({ chore, assignment }) => {
      if (chore.frequency === 'weekly') {
        const existing = weeklyChoresMap.get(chore.id)
        if (!existing || new Date(assignment.createdAt) > new Date(existing.assignment.createdAt)) {
          weeklyChoresMap.set(chore.id, { chore, assignment })
        }
      } else {
        otherChores.push({ chore, assignment })
      }
    })
    
    const deduplicatedChores = [...Array.from(weeklyChoresMap.values()), ...otherChores]
    
    return {
      child,
      chores: deduplicatedChores.map(({ chore }) => chore)
    }
  })

  // For completed tab, show all submissions (pending approval, approved, rejected)
  const completionsByChild = uniqueChildren.map((child: Child) => {
    if (activeTab !== 'completed') return { child, completions: [] }
    
    // Show all recent completions for this child
    const childCompletions = recentCompletions
      .filter((c: Completion) => c.childId === child.id)
      .slice(0, 10)
    
    return {
      child,
      completions: childCompletions
    }
  })

  const showChoresList = activeTab === 'all' || activeTab === 'recurring'
  const showPendingChores = activeTab === 'pending'
  const showCompletionsList = activeTab === 'completed'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--primary)] border-t-transparent mx-auto mb-4"></div>
          <p className="cb-body">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div key={refreshKey} className="min-h-screen bg-[var(--background)] pb-20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="cb-heading-xl mb-1">
                🏠 {family?.nameCipher || 'Family Dashboard'}
              </h1>
              <p className="text-white/90 text-sm sm:text-base">
                Turn chores into cheers! Welcome back, {user?.email?.split('@')[0]} 🎉
              </p>
              {/* Debug button for testing real-time updates */}
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button onClick={() => setShowStreakSettingsModal(true)} className="min-h-[44px] px-4 py-3 sm:px-4 sm:py-2 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full font-semibold text-sm sm:text-base transition-all flex items-center justify-center gap-2 touch-manipulation">
                🔥 Streaks
              </button>
              <button
                onClick={() => {
                  console.log('🌴 Holiday header button - current state:', {
                    familyHolidayMode: family?.holidayMode,
                    start: family?.holidayStartDate,
                    end: family?.holidayEndDate,
                  })
                  // Set optimistic window immediately to prevent background refreshes from interfering
                  setHolidayOptimisticUntil(Date.now() + 60000) // 60 seconds protection
                  setShowHolidayModal(true)
                }}
                className={`min-h-[44px] px-4 py-3 sm:px-4 sm:py-2 rounded-full font-semibold text-sm sm:text-base transition-all flex items-center justify-center gap-2 touch-manipulation ${
                  (() => {
                    // Check if holiday mode is active (enabled AND within date range if dates are set)
                    if (!family?.holidayMode) return false
                    const now = new Date()
                    const startDate = family.holidayStartDate ? new Date(family.holidayStartDate) : null
                    const endDate = family.holidayEndDate ? new Date(family.holidayEndDate) : null
                    const withinStart = !startDate || startDate <= now
                    const withinEnd = !endDate || endDate >= now
                    return withinStart && withinEnd
                  })()
                    ? 'bg-yellow-400/30 hover:bg-yellow-400/40 active:bg-yellow-400/50 text-yellow-50 border-2 border-yellow-300'
                    : 'bg-white/20 hover:bg-white/30 active:bg-white/40'
                }`}
              >
                🌴 Holiday Mode {(() => {
                  if (!family?.holidayMode) return ''
                  const now = new Date()
                  const startDate = family.holidayStartDate ? new Date(family.holidayStartDate) : null
                  const endDate = family.holidayEndDate ? new Date(family.holidayEndDate) : null
                  const withinStart = !startDate || startDate <= now
                  const withinEnd = !endDate || endDate >= now
                  return (withinStart && withinEnd) ? '☀️' : ''
                })()}
              </button>
              <button onClick={() => setShowSettingsModal(true)} className="min-h-[44px] px-4 py-3 sm:px-4 sm:py-2 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full font-semibold text-sm sm:text-base transition-all flex items-center justify-center touch-manipulation">
                ⚙️ Settings
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {(() => {
          // Check if holiday mode is active (enabled AND within date range if dates are set)
          if (!family?.holidayMode) return null
          const now = new Date()
          const startDate = family.holidayStartDate ? new Date(family.holidayStartDate) : null
          const endDate = family.holidayEndDate ? new Date(family.holidayEndDate) : null
          const withinStart = !startDate || startDate <= now
          const withinEnd = !endDate || endDate >= now
          const isActive = withinStart && withinEnd
          
          if (!isActive) return null
          
          return (
            <div className="cb-card bg-yellow-50 border-2 border-yellow-300 mb-6">
              <div className="flex items-center gap-3">
                <div className="text-2xl">🌴</div>
                <div className="flex-1">
                  <div className="font-semibold text-yellow-900">Family holiday mode is active</div>
                  <div className="text-sm text-yellow-800">Chores still appear, but streaks and penalties are paused. Manage settings from the holiday panel.</div>
                </div>
                <button
                  onClick={() => {
                    // Set optimistic window immediately to prevent background refreshes from interfering
                    setHolidayOptimisticUntil(Date.now() + 60000) // 60 seconds protection
                    setShowHolidayModal(true)
                  }}
                  className="min-h-[44px] px-4 py-3 sm:px-3 sm:py-1.5 bg-yellow-100 hover:bg-yellow-200 active:bg-yellow-300 border border-yellow-300 rounded-md text-yellow-900 text-sm sm:text-base font-semibold touch-manipulation whitespace-nowrap"
                >
                  Manage
                </button>
              </div>
            </div>
          )
        })()}
        {/* Main Content Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column: Manage Chores (2 cols on desktop) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pending Approvals Section */}
            {(pendingCompletions.length > 0 || pendingRedemptions.length > 0 || pendingStarPurchases.length > 0) && (
              <div className="cb-card p-6 border-4 border-[var(--warning)]">
                <h2 className="cb-heading-lg text-[var(--warning)] mb-6">⏳ Pending Approvals ({pendingCompletions.length + pendingRedemptions.length + pendingStarPurchases.length})</h2>
                <div className="space-y-4">
                  {/* Chore Completions */}
                  {pendingCompletions.map((completion: any) => (
                    <div
                      key={completion.id}
                      className="bg-[var(--background)] border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] p-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-full flex items-center justify-center text-2xl flex-shrink-0">
                          ✅
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-[var(--text-primary)] mb-1">
                                {completion.assignment?.chore?.title || 'Chore'}
                              </h4>
                              <p className="text-sm text-[var(--text-secondary)] mb-2">
                                Completed by <span className="font-semibold text-[var(--primary)]">{completion.child?.nickname || 'Unknown'}</span>
                              </p>
                              {completion.note && (
                                <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                                  <p className="text-sm text-gray-700">
                                    <span className="font-semibold">Note:</span> {completion.note}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-xl font-bold text-[var(--success)]">
                                {completion.bidAmountPence ? (
                                  <>
                                    <div className="text-sm text-orange-600 font-bold">⚔️ Challenge Bid</div>
                                    <div>💰 £{(completion.bidAmountPence / 100).toFixed(2)}</div>
                                    <div className="text-xs text-yellow-600">🏆 Gets 2⭐ (double!)</div>
                                  </>
                                ) : (
                                  <>💰 £{((completion.assignment?.chore?.baseRewardPence || 0) / 100).toFixed(2)}</>
                                )}
                              </div>
                              <div className="text-xs text-[var(--text-secondary)]">
                                {new Date(completion.timestamp).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
                            <button
                              onClick={() => handleApproveCompletion(completion.id)}
                              className="min-h-[44px] flex-1 px-4 py-3 sm:py-2 bg-[var(--success)] hover:bg-[var(--success)]/80 active:bg-[var(--success)]/70 text-white rounded-[var(--radius-md)] font-semibold text-base sm:text-sm transition-all touch-manipulation"
                            >
                              ✅ Approve & Pay
                            </button>
                            <button
                              onClick={() => handleRejectCompletion(completion.id)}
                              className="min-h-[44px] flex-1 px-4 py-3 sm:py-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-[var(--radius-md)] font-semibold text-base sm:text-sm transition-all touch-manipulation"
                            >
                              ❌ Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Gift Redemptions */}
                  {pendingRedemptions.map((redemption: any) => {
                    const gift = redemption.familyGift || redemption.reward
                    const addedBy = redemption.familyGift?.createdByUser
                    
                    return (
                      <div
                        key={redemption.id}
                        className="bg-[var(--background)] border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] p-4"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
                            🎁
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-[var(--text-primary)] mb-1">
                                  {gift?.title || 'Gift'}
                                </h4>
                                <p className="text-sm text-[var(--text-secondary)] mb-2">
                                  Redeemed by <span className="font-semibold text-[var(--primary)]">{redemption.child?.nickname || 'Unknown'}</span>
                                  {addedBy && (
                                    <> • Added by <span className="font-semibold text-purple-600">{addedBy.email?.split('@')[0] || 'Unknown'}</span></>
                                  )}
                                </p>
                                {gift?.description && (
                                  <p className="text-xs text-[var(--text-secondary)] mb-2">
                                    {gift.description}
                                  </p>
                                )}
                                {(gift?.affiliateUrl || gift?.sitestripeUrl) && (
                                  <a 
                                    href={gift.affiliateUrl || gift.sitestripeUrl || '#'} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-block mt-2 min-h-[44px] px-4 py-3 sm:px-3 sm:py-1.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-md text-base sm:text-sm font-semibold transition-colors touch-manipulation"
                                  >
                                    🔗 Purchase on Amazon
                                  </a>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-xl font-bold text-[var(--bonus-stars)]">
                                  ⭐ {redemption.costPaid || 0} stars
                                </div>
                                <div className="text-xs text-[var(--text-secondary)]">
                                  {new Date(redemption.createdAt).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
                              <button
                                onClick={() => handleApproveRedemption(redemption.id)}
                                className="min-h-[44px] flex-1 px-4 py-3 sm:py-2 bg-[var(--success)] hover:bg-[var(--success)]/80 active:bg-[var(--success)]/70 text-white rounded-[var(--radius-md)] font-semibold text-base sm:text-sm transition-all touch-manipulation"
                              >
                                ✅ Approve & Purchase
                              </button>
                              <button
                                onClick={() => handleRejectRedemption(redemption.id)}
                                className="min-h-[44px] flex-1 px-4 py-3 sm:py-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-[var(--radius-md)] font-semibold text-base sm:text-sm transition-all touch-manipulation"
                              >
                                ❌ Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  
                  {/* Star Purchases */}
                  {pendingStarPurchases.map((purchase: any) => (
                    <div
                      key={purchase.id}
                      className="bg-[var(--background)] border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] p-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
                          ⭐
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-[var(--text-primary)] mb-1">
                                Buy {purchase.starsRequested} Star{purchase.starsRequested !== 1 ? 's' : ''}
                              </h4>
                              <p className="text-sm text-[var(--text-secondary)] mb-2">
                                Requested by <span className="font-semibold text-[var(--primary)]">{purchase.child?.nickname || 'Unknown'}</span>
                              </p>
                              <p className="text-xs text-[var(--text-secondary)]">
                                Conversion rate: £{((purchase.conversionRatePence || 10) / 100).toFixed(2)} per star
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-xl font-bold text-[var(--bonus-stars)]">
                                ⭐ {purchase.starsRequested || 0} stars
                              </div>
                              <div className="text-sm text-[var(--text-secondary)]">
                                £{((purchase.amountPence || 0) / 100).toFixed(2)}
                              </div>
                              <div className="text-xs text-[var(--text-secondary)]">
                                {new Date(purchase.createdAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
                            <button
                              onClick={() => handleApproveStarPurchase(purchase.id)}
                              className="min-h-[44px] flex-1 px-4 py-3 sm:py-2 bg-[var(--success)] hover:bg-[var(--success)]/80 active:bg-[var(--success)]/70 text-white rounded-[var(--radius-md)] font-semibold text-base sm:text-sm transition-all touch-manipulation"
                            >
                              ✅ Approve
                            </button>
                            <button
                              onClick={() => handleRejectStarPurchase(purchase.id)}
                              className="min-h-[44px] flex-1 px-4 py-3 sm:py-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-[var(--radius-md)] font-semibold text-base sm:text-sm transition-all touch-manipulation"
                            >
                              ❌ Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Family Activity Feed */}
            <div className="cb-card p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="cb-heading-lg text-[var(--primary)]">📊 Family Activity</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActivityTab('recent')}
                    className={`min-h-[44px] px-4 py-3 sm:py-2 rounded-full font-semibold text-sm sm:text-base transition-all touch-manipulation ${
                      activityTab === 'recent'
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--primary)]/20 active:bg-[var(--primary)]/30'
                    }`}
                  >
                    Recent (2 days)
                  </button>
                  <button
                    onClick={() => setActivityTab('history')}
                    className={`min-h-[44px] px-4 py-3 sm:py-2 rounded-full font-semibold text-sm sm:text-base transition-all touch-manipulation ${
                      activityTab === 'history'
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--primary)]/20 active:bg-[var(--primary)]/30'
                    }`}
                  >
                    History (2 months)
                  </button>
                </div>
              </div>
              
              {activityTab === 'recent' && (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {/* Show completions from last 2 days */}
                  {(() => {
                    const twoDaysAgo = new Date()
                    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
                    
                    // Get recent completions
                    const recentItems = [...recentCompletions]
                      .filter((c: any) => new Date(c.timestamp) >= twoDaysAgo)
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((completion: any) => ({
                        type: 'completion',
                        data: completion,
                        timestamp: completion.timestamp
                      }))
                    
                    // Get recent gifts (created)
                    const recentGifts = gifts
                      .filter((g: any) => new Date(g.createdAt) >= twoDaysAgo)
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((gift: any) => ({
                        type: 'gift_created',
                        data: gift,
                        timestamp: gift.createdAt
                      }))
                    
                    // Get recent gift approvals (paid out)
                    const recentGiftApprovals = gifts
                      .filter((g: any) => g.status === 'paid_out' && g.paidOutAt && new Date(g.paidOutAt) >= twoDaysAgo)
                      .sort((a, b) => new Date(b.paidOutAt).getTime() - new Date(a.paidOutAt).getTime())
                      .map((gift: any) => ({
                        type: 'gift_approved',
                        data: gift,
                        timestamp: gift.paidOutAt
                      }))
                    
                    // Get recent payouts
                    const recentPayouts = payouts
                      .filter((p: any) => new Date(p.createdAt) >= twoDaysAgo)
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((payout: any) => ({
                        type: 'payout',
                        data: payout,
                        timestamp: payout.createdAt
                      }))
                    
                    // Get recent redemption fulfillments
                    const recentRedemptionFulfillments = redemptions
                      .filter((r: any) => r.status === 'fulfilled' && r.processedAt && new Date(r.processedAt) >= twoDaysAgo)
                      .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime())
                      .map((redemption: any) => ({
                        type: 'redemption_fulfilled',
                        data: redemption,
                        timestamp: redemption.processedAt
                      }))
                    
                    // Get recent redemption rejections
                    const recentRedemptionRejections = redemptions
                      .filter((r: any) => r.status === 'rejected' && r.processedAt && new Date(r.processedAt) >= twoDaysAgo)
                      .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime())
                      .map((redemption: any) => ({
                        type: 'redemption_rejected',
                        data: redemption,
                        timestamp: redemption.processedAt
                      }))
                    
                    // Get recent star purchase approvals
                    const recentStarPurchaseApprovals = starPurchases
                      .filter((p: any) => p.status === 'approved' && p.processedAt && new Date(p.processedAt) >= twoDaysAgo)
                      .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime())
                      .map((purchase: any) => ({
                        type: 'star_purchase_approved',
                        data: purchase,
                        timestamp: purchase.processedAt
                      }))
                    
                    // Combine and sort
                    const allRecent = [
                      ...recentItems, 
                      ...recentGifts, 
                      ...recentGiftApprovals, 
                      ...recentPayouts,
                      ...recentRedemptionFulfillments,
                      ...recentRedemptionRejections,
                      ...recentStarPurchaseApprovals
                    ]
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    
                    return allRecent.map((item: any) => {
                      if (item.type === 'completion') {
                        const completion = item.data
                        const timeAgo = getTimeAgo(new Date(completion.timestamp))
                        const icon = completion.status === 'approved' ? '✅' : completion.status === 'rejected' ? '❌' : '⏳'
                        const action = completion.status === 'approved' 
                          ? `completed "${completion.assignment?.chore?.title || 'a chore'}"` 
                          : completion.status === 'rejected'
                          ? `was rejected for "${completion.assignment?.chore?.title || 'a chore'}"`
                          : `submitted "${completion.assignment?.chore?.title || 'a chore'}"`
                        
                        let rewardAmount = 0
                        if (completion.status === 'approved') {
                          if (completion.bidAmountPence && completion.assignment?.biddingEnabled) {
                            rewardAmount = completion.bidAmountPence
                          } else {
                            rewardAmount = completion.assignment?.chore?.baseRewardPence || 0
                          }
                        }
                        const reward = rewardAmount > 0 
                          ? completion.bidAmountPence && completion.assignment?.biddingEnabled
                            ? `+£${(rewardAmount / 100).toFixed(2)} (2⭐)`
                            : `+£${(rewardAmount / 100).toFixed(2)}`
                          : ''

                        return (
                          <div key={completion.id} className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-[var(--radius-md)]">
                            <div className="w-10 h-10 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-full flex items-center justify-center text-xl">
                              {icon}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-bold text-[var(--text-primary)]">{completion.child?.nickname || 'Someone'}</span>{' '}
                                <span className="text-[var(--text-secondary)]">{action}</span>
                                {reward && (
                                  <span className="ml-2 cb-chip bg-[var(--success)]/10 text-[var(--success)]">
                                    {reward}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">{timeAgo}</p>
                            </div>
                          </div>
                        )
                      } else if (item.type === 'gift_created') {
                        // Gift created item
                        const gift = item.data
                        const timeAgo = getTimeAgo(new Date(gift.createdAt))
                        const child = uniqueChildren.find((c: any) => c.id === gift.childId)
                        const giver = members.find((m: any) => m.id === gift.givenBy)
                        const giverName = giver?.displayName || giver?.user?.email?.split('@')[0] || 'Unknown'
                        
                        return (
                          <div key={`gift-created-${gift.id}`} className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-[var(--radius-md)]">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-xl">
                              🎁
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-bold text-[var(--text-primary)]">{giverName}</span>{' '}
                                <span className="text-[var(--text-secondary)]">gifted</span>{' '}
                                <span className="font-bold text-[var(--text-primary)]">{child?.nickname || 'Unknown'}</span>
                                {gift.starsAmount > 0 && (
                                  <span className="ml-2 cb-chip bg-yellow-100 text-yellow-700">
                                    +{gift.starsAmount}⭐
                                  </span>
                                )}
                                {gift.moneyPence > 0 && (
                                  <span className="ml-2 cb-chip bg-[var(--success)]/10 text-[var(--success)]">
                                    +£{(gift.moneyPence / 100).toFixed(2)}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">{timeAgo}</p>
                            </div>
                          </div>
                        )
                      } else if (item.type === 'gift_approved') {
                        // Gift approved (paid out) item
                        const gift = item.data
                        const timeAgo = getTimeAgo(new Date(gift.paidOutAt))
                        const child = uniqueChildren.find((c: any) => c.id === gift.childId)
                        const giver = members.find((m: any) => m.id === gift.givenBy)
                        const giverName = giver?.displayName || giver?.user?.email?.split('@')[0] || 'Unknown'
                        
                        return (
                          <div key={`gift-approved-${gift.id}`} className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-[var(--radius-md)]">
                            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-xl">
                              ✅
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-bold text-[var(--text-primary)]">{giverName}</span>{' '}
                                <span className="text-[var(--text-secondary)]">approved gift for</span>{' '}
                                <span className="font-bold text-[var(--text-primary)]">{child?.nickname || 'Unknown'}</span>
                                {gift.starsAmount > 0 && (
                                  <span className="ml-2 cb-chip bg-yellow-100 text-yellow-700">
                                    {gift.starsAmount}⭐
                                  </span>
                                )}
                                {gift.moneyPence > 0 && (
                                  <span className="ml-2 cb-chip bg-[var(--success)]/10 text-[var(--success)]">
                                    £{(gift.moneyPence / 100).toFixed(2)}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">{timeAgo}</p>
                            </div>
                          </div>
                        )
                      } else if (item.type === 'payout') {
                        // Payout item
                        const payout = item.data
                        const timeAgo = getTimeAgo(new Date(payout.createdAt))
                        const child = uniqueChildren.find((c: any) => c.id === payout.childId)
                        const payer = members.find((m: any) => m.id === payout.paidBy)
                        const payerName = payer?.displayName || payer?.user?.email?.split('@')[0] || 'Parent'
                        
                        return (
                          <div key={`payout-${payout.id}`} className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-[var(--radius-md)]">
                            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center text-xl">
                              💸
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-bold text-[var(--text-primary)]">{payerName}</span>{' '}
                                <span className="text-[var(--text-secondary)]">paid out</span>{' '}
                                <span className="font-bold text-[var(--text-primary)]">£{(payout.amountPence / 100).toFixed(2)}</span>{' '}
                                <span className="text-[var(--text-secondary)]">to</span>{' '}
                                <span className="font-bold text-[var(--text-primary)]">{child?.nickname || 'Unknown'}</span>
                                {payout.method && (
                                  <span className="ml-2 cb-chip bg-blue-100 text-blue-700">
                                    {payout.method === 'cash' ? '💵 Cash' : payout.method === 'bank_transfer' ? '🏦 Transfer' : '📝 Other'}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">{timeAgo}</p>
                            </div>
                          </div>
                        )
                      } else if (item.type === 'redemption_fulfilled') {
                        // Redemption fulfilled item
                        const redemption = item.data
                        const timeAgo = getTimeAgo(new Date(redemption.processedAt))
                        const child = uniqueChildren.find((c: any) => c.id === redemption.childId)
                        const gift = redemption.familyGift || redemption.reward
                        
                        return (
                          <div key={`redemption-fulfilled-${redemption.id}`} className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-[var(--radius-md)]">
                            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-xl">
                              🎉
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-bold text-[var(--text-primary)]">{child?.nickname || 'Unknown'}</span>{' '}
                                <span className="text-[var(--text-secondary)]">received</span>{' '}
                                <span className="font-bold text-[var(--text-primary)]">{gift?.title || 'gift'}</span>
                                {redemption.costPaid > 0 && (
                                  <span className="ml-2 cb-chip bg-yellow-100 text-yellow-700">
                                    {redemption.costPaid}⭐
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">{timeAgo}</p>
                            </div>
                          </div>
                        )
                      } else if (item.type === 'redemption_rejected') {
                        // Redemption rejected item
                        const redemption = item.data
                        const timeAgo = getTimeAgo(new Date(redemption.processedAt))
                        const child = uniqueChildren.find((c: any) => c.id === redemption.childId)
                        const gift = redemption.familyGift || redemption.reward
                        
                        return (
                          <div key={`redemption-rejected-${redemption.id}`} className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-[var(--radius-md)]">
                            <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-orange-500 rounded-full flex items-center justify-center text-xl">
                              ❌
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-bold text-[var(--text-primary)]">{child?.nickname || 'Unknown'}</span>{' '}
                                <span className="text-[var(--text-secondary)]">redemption of</span>{' '}
                                <span className="font-bold text-[var(--text-primary)]">{gift?.title || 'gift'}</span>{' '}
                                <span className="text-[var(--text-secondary)]">was rejected</span>
                                {redemption.costPaid > 0 && (
                                  <span className="ml-2 cb-chip bg-yellow-100 text-yellow-700">
                                    {redemption.costPaid}⭐ refunded
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">{timeAgo}</p>
                            </div>
                          </div>
                        )
                      } else if (item.type === 'star_purchase_approved') {
                        // Star purchase approved item
                        const purchase = item.data
                        const timeAgo = getTimeAgo(new Date(purchase.processedAt))
                        const child = uniqueChildren.find((c: any) => c.id === purchase.childId)
                        const approver = members.find((m: any) => m.id === purchase.approvedBy)
                        const approverName = approver?.displayName || approver?.user?.email?.split('@')[0] || 'Parent'
                        
                        return (
                          <div key={`star-purchase-approved-${purchase.id}`} className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-[var(--radius-md)]">
                            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-xl">
                              ⭐
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-bold text-[var(--text-primary)]">{approverName}</span>{' '}
                                <span className="text-[var(--text-secondary)]">approved</span>{' '}
                                <span className="font-bold text-[var(--text-primary)]">{purchase.starsRequested} star{purchase.starsRequested !== 1 ? 's' : ''}</span>{' '}
                                <span className="text-[var(--text-secondary)]">for</span>{' '}
                                <span className="font-bold text-[var(--text-primary)]">{child?.nickname || 'Unknown'}</span>
                                <span className="ml-2 cb-chip bg-[var(--success)]/10 text-[var(--success)]">
                                  £{((purchase.amountPence || 0) / 100).toFixed(2)}
                                </span>
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">{timeAgo}</p>
                            </div>
                          </div>
                        )
                      }
                    })
                  })()}
                  
                  {(() => {
                    const twoDaysAgo = new Date()
                    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
                    const hasRecent = recentCompletions.some((c: any) => new Date(c.timestamp) >= twoDaysAgo) ||
                                     gifts.some((g: any) => new Date(g.createdAt) >= twoDaysAgo) ||
                                     gifts.some((g: any) => g.status === 'paid_out' && g.paidOutAt && new Date(g.paidOutAt) >= twoDaysAgo) ||
                                     payouts.some((p: any) => new Date(p.createdAt) >= twoDaysAgo) ||
                                     redemptions.some((r: any) => r.status === 'fulfilled' && r.processedAt && new Date(r.processedAt) >= twoDaysAgo) ||
                                     redemptions.some((r: any) => r.status === 'rejected' && r.processedAt && new Date(r.processedAt) >= twoDaysAgo) ||
                                     starPurchases.some((p: any) => p.status === 'approved' && p.processedAt && new Date(p.processedAt) >= twoDaysAgo)
                    
                    if (!hasRecent) {
                      return (
                        <div className="text-center py-8">
                          <div className="text-5xl mb-3">📊</div>
                          <p className="text-[var(--text-secondary)] font-medium">No recent activity</p>
                          <p className="text-sm text-[var(--text-secondary)] mt-1">Activity from the last 2 days will appear here</p>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              )}
              
              {activityTab === 'history' && (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {(() => {
                    const twoMonthsAgo = new Date()
                    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
                    
                    // Get all completions from last 2 months
                    const historyCompletions = [...recentCompletions]
                      .filter((c: any) => new Date(c.timestamp) >= twoMonthsAgo)
                      .map((completion: any) => ({
                        type: 'completion',
                        data: completion,
                        timestamp: completion.timestamp
                      }))
                    
                    // Get all gifts created from last 2 months
                    const historyGifts = gifts
                      .filter((g: any) => new Date(g.createdAt) >= twoMonthsAgo)
                      .map((gift: any) => ({
                        type: 'gift_created',
                        data: gift,
                        timestamp: gift.createdAt
                      }))
                    
                    // Get all gift approvals from last 2 months
                    const historyGiftApprovals = gifts
                      .filter((g: any) => g.status === 'paid_out' && g.paidOutAt && new Date(g.paidOutAt) >= twoMonthsAgo)
                      .map((gift: any) => ({
                        type: 'gift_approved',
                        data: gift,
                        timestamp: gift.paidOutAt
                      }))
                    
                    // Get all payouts from last 2 months
                    const historyPayouts = payouts
                      .filter((p: any) => new Date(p.createdAt) >= twoMonthsAgo)
                      .map((payout: any) => ({
                        type: 'payout',
                        data: payout,
                        timestamp: payout.createdAt
                      }))
                    
                    // Get all redemption fulfillments from last 2 months
                    const historyRedemptionFulfillments = redemptions
                      .filter((r: any) => r.status === 'fulfilled' && r.processedAt && new Date(r.processedAt) >= twoMonthsAgo)
                      .map((redemption: any) => ({
                        type: 'redemption_fulfilled',
                        data: redemption,
                        timestamp: redemption.processedAt
                      }))
                    
                    // Get all redemption rejections from last 2 months
                    const historyRedemptionRejections = redemptions
                      .filter((r: any) => r.status === 'rejected' && r.processedAt && new Date(r.processedAt) >= twoMonthsAgo)
                      .map((redemption: any) => ({
                        type: 'redemption_rejected',
                        data: redemption,
                        timestamp: redemption.processedAt
                      }))
                    
                    // Get all star purchase approvals from last 2 months
                    const historyStarPurchaseApprovals = starPurchases
                      .filter((p: any) => p.status === 'approved' && p.processedAt && new Date(p.processedAt) >= twoMonthsAgo)
                      .map((purchase: any) => ({
                        type: 'star_purchase_approved',
                        data: purchase,
                        timestamp: purchase.processedAt
                      }))
                    
                    // Combine and sort
                    const allHistory = [
                      ...historyCompletions, 
                      ...historyGifts, 
                      ...historyGiftApprovals, 
                      ...historyPayouts,
                      ...historyRedemptionFulfillments,
                      ...historyRedemptionRejections,
                      ...historyStarPurchaseApprovals
                    ]
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    
                    return allHistory.map((item: any) => {
                      if (item.type === 'completion') {
                        const completion = item.data
                        const timeAgo = getTimeAgo(new Date(completion.timestamp))
                        const icon = completion.status === 'approved' ? '✅' : completion.status === 'rejected' ? '❌' : '⏳'
                        const action = completion.status === 'approved' 
                          ? `completed "${completion.assignment?.chore?.title || 'a chore'}"` 
                          : completion.status === 'rejected'
                          ? `was rejected for "${completion.assignment?.chore?.title || 'a chore'}"`
                          : `submitted "${completion.assignment?.chore?.title || 'a chore'}"`
                        
                        let rewardAmount = 0
                        if (completion.status === 'approved') {
                          if (completion.bidAmountPence && completion.assignment?.biddingEnabled) {
                            rewardAmount = completion.bidAmountPence
                          } else {
                            rewardAmount = completion.assignment?.chore?.baseRewardPence || 0
                          }
                        }
                        const reward = rewardAmount > 0 
                          ? completion.bidAmountPence && completion.assignment?.biddingEnabled
                            ? `+£${(rewardAmount / 100).toFixed(2)} (2⭐)`
                            : `+£${(rewardAmount / 100).toFixed(2)}`
                          : ''

                        return (
                          <div key={completion.id} className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-[var(--radius-md)]">
                            <div className="w-10 h-10 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-full flex items-center justify-center text-xl">
                              {icon}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-bold text-[var(--text-primary)]">{completion.child?.nickname || 'Someone'}</span>{' '}
                                <span className="text-[var(--text-secondary)]">{action}</span>
                                {reward && (
                                  <span className="ml-2 cb-chip bg-[var(--success)]/10 text-[var(--success)]">
                                    {reward}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">{timeAgo} • {new Date(completion.timestamp).toLocaleDateString()}</p>
                            </div>
                          </div>
                        )
                      } else if (item.type === 'gift_created') {
                        // Gift created item
                        const gift = item.data
                        const timeAgo = getTimeAgo(new Date(gift.createdAt))
                        const child = uniqueChildren.find((c: any) => c.id === gift.childId)
                        const giver = members.find((m: any) => m.id === gift.givenBy)
                        const giverName = giver?.displayName || giver?.user?.email?.split('@')[0] || 'Unknown'
                        
                        return (
                          <div key={`gift-created-${gift.id}`} className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-[var(--radius-md)]">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-xl">
                              🎁
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-bold text-[var(--text-primary)]">{giverName}</span>{' '}
                                <span className="text-[var(--text-secondary)]">gifted</span>{' '}
                                <span className="font-bold text-[var(--text-primary)]">{child?.nickname || 'Unknown'}</span>
                                {gift.starsAmount > 0 && (
                                  <span className="ml-2 cb-chip bg-yellow-100 text-yellow-700">
                                    +{gift.starsAmount}⭐
                                  </span>
                                )}
                                {gift.moneyPence > 0 && (
                                  <span className="ml-2 cb-chip bg-[var(--success)]/10 text-[var(--success)]">
                                    +£{(gift.moneyPence / 100).toFixed(2)}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">{timeAgo} • {new Date(gift.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        )
                      } else if (item.type === 'gift_approved') {
                        // Gift approved (paid out) item
                        const gift = item.data
                        const timeAgo = getTimeAgo(new Date(gift.paidOutAt))
                        const child = uniqueChildren.find((c: any) => c.id === gift.childId)
                        const giver = members.find((m: any) => m.id === gift.givenBy)
                        const giverName = giver?.displayName || giver?.user?.email?.split('@')[0] || 'Unknown'
                        
                        return (
                          <div key={`gift-approved-${gift.id}`} className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-[var(--radius-md)]">
                            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-xl">
                              ✅
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-bold text-[var(--text-primary)]">{giverName}</span>{' '}
                                <span className="text-[var(--text-secondary)]">approved gift for</span>{' '}
                                <span className="font-bold text-[var(--text-primary)]">{child?.nickname || 'Unknown'}</span>
                                {gift.starsAmount > 0 && (
                                  <span className="ml-2 cb-chip bg-yellow-100 text-yellow-700">
                                    {gift.starsAmount}⭐
                                  </span>
                                )}
                                {gift.moneyPence > 0 && (
                                  <span className="ml-2 cb-chip bg-[var(--success)]/10 text-[var(--success)]">
                                    £{(gift.moneyPence / 100).toFixed(2)}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">{timeAgo} • {new Date(gift.paidOutAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        )
                      } else if (item.type === 'payout') {
                        // Payout item
                        const payout = item.data
                        const timeAgo = getTimeAgo(new Date(payout.createdAt))
                        const child = uniqueChildren.find((c: any) => c.id === payout.childId)
                        const payer = members.find((m: any) => m.id === payout.paidBy)
                        const payerName = payer?.displayName || payer?.user?.email?.split('@')[0] || 'Parent'
                        
                        return (
                          <div key={`payout-${payout.id}`} className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-[var(--radius-md)]">
                            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center text-xl">
                              💸
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-bold text-[var(--text-primary)]">{payerName}</span>{' '}
                                <span className="text-[var(--text-secondary)]">paid out</span>{' '}
                                <span className="font-bold text-[var(--text-primary)]">£{(payout.amountPence / 100).toFixed(2)}</span>{' '}
                                <span className="text-[var(--text-secondary)]">to</span>{' '}
                                <span className="font-bold text-[var(--text-primary)]">{child?.nickname || 'Unknown'}</span>
                                {payout.method && (
                                  <span className="ml-2 cb-chip bg-blue-100 text-blue-700">
                                    {payout.method === 'cash' ? '💵 Cash' : payout.method === 'bank_transfer' ? '🏦 Transfer' : '📝 Other'}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">{timeAgo} • {new Date(payout.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        )
                      } else if (item.type === 'redemption_fulfilled') {
                        // Redemption fulfilled item
                        const redemption = item.data
                        const timeAgo = getTimeAgo(new Date(redemption.processedAt))
                        const child = uniqueChildren.find((c: any) => c.id === redemption.childId)
                        const gift = redemption.familyGift || redemption.reward
                        
                        return (
                          <div key={`redemption-fulfilled-${redemption.id}`} className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-[var(--radius-md)]">
                            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-xl">
                              🎉
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-bold text-[var(--text-primary)]">{child?.nickname || 'Unknown'}</span>{' '}
                                <span className="text-[var(--text-secondary)]">received</span>{' '}
                                <span className="font-bold text-[var(--text-primary)]">{gift?.title || 'gift'}</span>
                                {redemption.costPaid > 0 && (
                                  <span className="ml-2 cb-chip bg-yellow-100 text-yellow-700">
                                    {redemption.costPaid}⭐
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">{timeAgo} • {new Date(redemption.processedAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        )
                      } else if (item.type === 'redemption_rejected') {
                        // Redemption rejected item
                        const redemption = item.data
                        const timeAgo = getTimeAgo(new Date(redemption.processedAt))
                        const child = uniqueChildren.find((c: any) => c.id === redemption.childId)
                        const gift = redemption.familyGift || redemption.reward
                        
                        return (
                          <div key={`redemption-rejected-${redemption.id}`} className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-[var(--radius-md)]">
                            <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-orange-500 rounded-full flex items-center justify-center text-xl">
                              ❌
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-bold text-[var(--text-primary)]">{child?.nickname || 'Unknown'}</span>{' '}
                                <span className="text-[var(--text-secondary)]">redemption of</span>{' '}
                                <span className="font-bold text-[var(--text-primary)]">{gift?.title || 'gift'}</span>{' '}
                                <span className="text-[var(--text-secondary)]">was rejected</span>
                                {redemption.costPaid > 0 && (
                                  <span className="ml-2 cb-chip bg-yellow-100 text-yellow-700">
                                    {redemption.costPaid}⭐ refunded
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">{timeAgo} • {new Date(redemption.processedAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        )
                      } else if (item.type === 'star_purchase_approved') {
                        // Star purchase approved item
                        const purchase = item.data
                        const timeAgo = getTimeAgo(new Date(purchase.processedAt))
                        const child = uniqueChildren.find((c: any) => c.id === purchase.childId)
                        const approver = members.find((m: any) => m.id === purchase.approvedBy)
                        const approverName = approver?.displayName || approver?.user?.email?.split('@')[0] || 'Parent'
                        
                        return (
                          <div key={`star-purchase-approved-${purchase.id}`} className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-[var(--radius-md)]">
                            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-xl">
                              ⭐
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">
                                <span className="font-bold text-[var(--text-primary)]">{approverName}</span>{' '}
                                <span className="text-[var(--text-secondary)]">approved</span>{' '}
                                <span className="font-bold text-[var(--text-primary)]">{purchase.starsRequested} star{purchase.starsRequested !== 1 ? 's' : ''}</span>{' '}
                                <span className="text-[var(--text-secondary)]">for</span>{' '}
                                <span className="font-bold text-[var(--text-primary)]">{child?.nickname || 'Unknown'}</span>
                                <span className="ml-2 cb-chip bg-[var(--success)]/10 text-[var(--success)]">
                                  £{((purchase.amountPence || 0) / 100).toFixed(2)}
                                </span>
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">{timeAgo} • {new Date(purchase.processedAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        )
                      }
                    })
                  })()}
                  
                  {(() => {
                    const twoMonthsAgo = new Date()
                    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
                    const hasHistory = recentCompletions.some((c: any) => new Date(c.timestamp) >= twoMonthsAgo) ||
                                      gifts.some((g: any) => new Date(g.createdAt) >= twoMonthsAgo) ||
                                      gifts.some((g: any) => g.status === 'paid_out' && g.paidOutAt && new Date(g.paidOutAt) >= twoMonthsAgo) ||
                                      payouts.some((p: any) => new Date(p.createdAt) >= twoMonthsAgo) ||
                                      redemptions.some((r: any) => r.status === 'fulfilled' && r.processedAt && new Date(r.processedAt) >= twoMonthsAgo) ||
                                      redemptions.some((r: any) => r.status === 'rejected' && r.processedAt && new Date(r.processedAt) >= twoMonthsAgo) ||
                                      starPurchases.some((p: any) => p.status === 'approved' && p.processedAt && new Date(p.processedAt) >= twoMonthsAgo)
                    
                    if (!hasHistory) {
                      return (
                        <div className="text-center py-8">
                          <div className="text-5xl mb-3">📊</div>
                          <p className="text-[var(--text-secondary)] font-medium">No activity in the last 2 months</p>
                          <p className="text-sm text-[var(--text-secondary)] mt-1">Activity from the last 60 days will appear here</p>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              )}
            </div>

            {/* Manage Chores Section */}
            <div className="cb-card p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="cb-heading-lg text-[var(--primary)]">🧹 Manage Chores</h2>
                <button
                  onClick={() => setShowChoreLibraryModal(true)}
                  className="cb-button-primary text-sm"
                >
                  ➕ Add Chore
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-6 flex-wrap">
                {['all', 'recurring', 'pending', 'completed'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`min-h-[44px] px-4 py-3 sm:py-2 rounded-full font-semibold text-sm sm:text-base transition-all touch-manipulation ${
                      activeTab === tab
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--primary)]/20 active:bg-[var(--primary)]/30'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Show chores grid for All/Recurring tabs */}
              {showChoresList && (
                <>
                  {filteredChores.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">🎯</div>
                      <p className="cb-body text-[var(--text-secondary)]">
                        No chores yet! Create one to get started.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {filteredChores.map((chore: Chore) => {
                        // Find assignments for this chore
                        const choreAssigns = assignments.filter((a: any) => a.chore?.id === chore.id)
                        const assignedChildren = Array.from(
                          new Map(
                            choreAssigns
                              .map((a: any) => a.child)
                              .filter(Boolean)
                              .map((child: any) => [child.id, child])
                          ).values()
                        )
                        const hasBidding = choreAssigns.some((a: any) => a.biddingEnabled)

                        return (
                          <div
                            key={chore.id}
                            className="bg-white border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] p-4 hover:shadow-lg transition-all cursor-pointer"
                            onClick={() => {
                              // Pre-populate current assignments
                              const currentAssignments = assignments.filter((a: any) => a.choreId === chore.id)
                              const assignedChildIds = currentAssignments.map((a: any) => a.childId).filter(Boolean)
                              const hasBidding = currentAssignments.some((a: any) => a.biddingEnabled)
                              
                              setSelectedChore(chore)
                              setChoreAssignments({
                                childIds: assignedChildIds,
                                biddingEnabled: hasBidding
                              })
                              setShowEditChoreModal(true)
                            }}
                          >
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-full flex items-center justify-center text-xl flex-shrink-0">
                                🧽
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-[var(--text-primary)] mb-1 truncate">
                                  {chore.title}
                                </h4>
                                <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                                  {chore.description || 'No description'}
                                </p>
                              </div>
                            </div>

                            {/* Assigned Children */}
                            {assignedChildren.length > 0 && (
                              <div className="mb-3 flex flex-wrap gap-2">
                                {assignedChildren.map((child: any) => (
                                  <span
                                    key={child.id}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full"
                                  >
                                    👤 {child.nickname}
                                  </span>
                                ))}
                                {hasBidding && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-full">
                                    ⚔️ Rivalry
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-3 border-t border-[var(--card-border)]">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="cb-chip bg-[var(--success)]/10 text-[var(--success)]">
                                  💰 £{((chore.baseRewardPence || 0) / 100).toFixed(2)}
                                </span>
                                <span className="cb-chip bg-yellow-100 text-yellow-700">
                                  ⭐ {chore.starsOverride || Math.max(1, Math.floor((chore.baseRewardPence || 0) / 10))}
                                </span>
                                <span className="cb-chip bg-[var(--secondary)]/10 text-[var(--secondary)]">
                                  {chore.frequency}
                                </span>
                                {chore.proof !== 'none' && (
                                  <span className="cb-chip bg-orange-50 text-orange-700">
                                    📸 {chore.proof}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation()
                                  
                                  // Pre-populate current assignments
                                  const currentAssignments = assignments.filter((a: any) => a.choreId === chore.id)
                                  const assignedChildIds = currentAssignments.map((a: any) => a.childId).filter(Boolean)
                                  const hasBidding = currentAssignments.some((a: any) => a.biddingEnabled)
                                  
                                  setSelectedChore(chore)
                                  setChoreAssignments({
                                    childIds: assignedChildIds,
                                    biddingEnabled: hasBidding
                                  })
                                  setShowEditChoreModal(true)
                                }}
                                className="text-[var(--primary)] hover:text-[var(--secondary)] transition-colors"
                              >
                                ⚙️
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {/* Show pending chores (not yet done) grouped by child */}
              {showPendingChores && (
                <div className="space-y-6">
                  {pendingChoresByChild.map(({ child, chores: pendingChores }) => {
                    if (pendingChores.length === 0) return null
                    
                    return (
                      <div key={child.id} className="space-y-3">
                        <div className="flex items-center gap-3 pb-2 border-b-2 border-orange-500">
                          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-xl font-bold text-white">
                            {child.nickname.charAt(0)}
                          </div>
                          <h3 className="cb-heading-md text-orange-600">{child.nickname}'s To Do</h3>
                          <span className="ml-auto text-sm font-semibold text-[var(--text-secondary)]">
                            {pendingChores.length} pending
                          </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          {pendingChores.map((chore: any) => {
                            return (
                              <div
                                key={chore.id}
                                className="bg-white border-2 border-orange-200 rounded-[var(--radius-lg)] p-4 hover:shadow-lg transition-all"
                              >
                                <div className="flex items-start gap-3 mb-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                                    ⏰
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-[var(--text-primary)] mb-1 truncate">
                                      {chore.title}
                                    </h4>
                                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                                      {chore.description || 'No description'}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-orange-200">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="cb-chip bg-[var(--success)]/10 text-[var(--success)]">
                                      💰 £{(chore.baseRewardPence / 100).toFixed(2)}
                                    </span>
                                    <span className="cb-chip bg-yellow-100 text-yellow-700">
                                      ⭐ {chore.starsOverride || Math.max(1, Math.floor(chore.baseRewardPence / 10))}
                                    </span>
                                    <span className="cb-chip bg-orange-50 text-orange-700">
                                      {chore.frequency}
                                    </span>
                                  </div>
                                  <span className="text-xs font-semibold text-orange-600">
                                    Not done yet
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}

                  {pendingChoresByChild.every(({ chores }) => chores.length === 0) && (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">🎉</div>
                      <p className="cb-body text-[var(--text-secondary)]">
                        All chores are done for today!
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Show completions grouped by child for Completed tab */}
              {showCompletionsList && (
                <div className="space-y-6">
                  {completionsByChild.map(({ child, completions: childCompletions }) => {
                    if (childCompletions.length === 0) return null
                    
                    return (
                      <div key={child.id} className="space-y-3">
                        <div className="flex items-center gap-3 pb-2 border-b-2 border-[var(--primary)]">
                          <div className="w-10 h-10 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-full flex items-center justify-center text-xl font-bold text-white">
                            {child.nickname.charAt(0)}
                          </div>
                          <h3 className="cb-heading-md text-[var(--primary)]">{child.nickname}'s Completed</h3>
                          <span className="ml-auto text-sm font-semibold text-[var(--text-secondary)]">
                            {childCompletions.length} item{childCompletions.length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        <div className="space-y-3">
                          {childCompletions.map((completion: any) => {
                            const timeAgo = getTimeAgo(new Date(completion.timestamp))
                            const icon = completion.status === 'approved' ? '✅' : completion.status === 'rejected' ? '❌' : '⏳'

                            return (
                              <div
                                key={completion.id}
                                className="bg-white border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] p-4"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-full flex items-center justify-center text-xl flex-shrink-0">
                                    {icon}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-[var(--text-primary)] mb-1">
                                      {completion.assignment?.chore?.title || 'Chore'}
                                    </h4>
                                    <p className="text-xs text-[var(--text-secondary)] mb-2">{timeAgo}</p>
                                    
                                    {completion.note && (
                                      <div className="mt-2 p-2 bg-blue-50 border-l-2 border-blue-400 rounded text-xs">
                                        <span className="font-semibold">Note:</span> {completion.note}
                                      </div>
                                    )}

                                    {completion.status === 'pending' && (
                                      <div className="flex gap-2 mt-3">
                                        <button
                                          onClick={() => handleApproveCompletion(completion.id)}
                                          className="min-h-[44px] flex-1 px-4 py-3 sm:px-3 sm:py-2 bg-[var(--success)] hover:bg-[var(--success)]/80 active:bg-[var(--success)]/70 text-white rounded-[var(--radius-md)] font-semibold text-base sm:text-sm transition-all touch-manipulation"
                                        >
                                          ✅ Approve
                                        </button>
                                        <button
                                          onClick={() => handleRejectCompletion(completion.id)}
                                          className="min-h-[44px] flex-1 px-4 py-3 sm:px-3 sm:py-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-[var(--radius-md)] font-semibold text-base sm:text-sm transition-all touch-manipulation"
                                        >
                                          ❌ Reject
                                        </button>
                                      </div>
                                    )}

                                    {completion.status === 'approved' && (
                                      <div className="mt-2">
                                        <span className="cb-chip bg-[var(--success)]/10 text-[var(--success)]">
                                          +£{((completion.assignment?.chore?.baseRewardPence || 0) / 100).toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}

                  {completionsByChild.every(({ completions }) => completions.length === 0) && (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">✅</div>
                      <p className="cb-body text-[var(--text-secondary)]">
                        No completed chores yet!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Streak Rewards Section */}
            <div className="cb-card p-6">
            <div className="flex justify-between items-center mb-6 gap-4">
              <h2 className="cb-heading-lg text-[var(--primary)]">🎁 Streak Rewards</h2>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Enable Shop</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={family?.giftsEnabled !== false}
                    aria-label={family?.giftsEnabled !== false ? 'Disable gift shop' : 'Enable gift shop'}
                    title={family?.giftsEnabled !== false ? 'Disable gift shop' : 'Enable gift shop'}
                    onClick={() => {
                      const newValue = !(family?.giftsEnabled !== false)
                      apiClient.updateFamily({ giftsEnabled: newValue })
                        .then(() => {
                          setFamily({ ...family!, giftsEnabled: newValue })
                          setToast({ message: 'Gift shop setting updated', type: 'success' })
                        })
                        .catch(() => {
                          setToast({ message: 'Failed to update gift shop setting', type: 'error' })
                        })
                    }}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 ${
                      family?.giftsEnabled !== false ? 'bg-[var(--primary)]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        family?.giftsEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                        <button
                          onClick={() => {
                            setSelectedTemplate(null)
                            selectedTemplateRef.current = null
                            setShowAddGiftModal(true)
                          }}
                  className="min-h-[44px] px-4 py-3 sm:py-2 text-base sm:text-sm font-semibold rounded-full border-2 border-orange-500 text-orange-500 bg-white hover:bg-orange-500 hover:text-white active:bg-orange-600 active:text-white transition-all shadow-sm hover:shadow-md active:shadow-sm whitespace-nowrap touch-manipulation"
                >
                  ➕ Add Custom Gift
                </button>
                <button
                  onClick={() => {
                    // Close Add Gift Modal first to prevent flash
                    if (showAddGiftModal) {
                      setShowAddGiftModal(false)
                      setSelectedTemplate(null)
                      // Small delay to ensure modal closes before opening new one
                      setTimeout(() => {
                        setShowGiftModal(true)
                      }, 100)
                    } else {
                      setShowGiftModal(true)
                    }
                  }}
                  className="cb-button-primary text-sm whitespace-nowrap"
                  style={{ backgroundColor: '#FF8A00' }}
                >
                  ➕ Browse Gifts
                </button>
              </div>
            </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-6 flex-wrap">
                {['all', 'pending', 'history'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setGiftsTab(tab as any)}
                    className={`min-h-[44px] px-4 py-3 sm:py-2 rounded-full font-semibold text-sm sm:text-base transition-all touch-manipulation ${
                      giftsTab === tab
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--primary)]/20 active:bg-[var(--primary)]/30'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* All Gifts Tab */}
              {giftsTab === 'all' && (
                <div>
                  {loadingGifts ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto"></div>
                      <p className="mt-4 text-[var(--text-secondary)]">Loading gifts...</p>
                    </div>
                  ) : familyGifts.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">🎁</div>
                      <p className="text-[var(--text-secondary)] font-medium mb-2">No gifts yet</p>
                      <p className="text-sm text-[var(--text-secondary)] mb-4">
                        Add gifts for children to redeem with their stars
                      </p>
                      <button
                        onClick={() => setShowGiftModal(true)}
                        className="cb-button-primary"
                      >
                        Add Your First Gift
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {familyGifts.filter((g: any) => g.active).map((gift: any) => (
                        <div 
                          key={gift.id} 
                          className="bg-[var(--background)] border-2 border-[var(--card-border)] rounded-lg p-4 hover:shadow-md transition-all cursor-pointer relative"
                          onClick={async () => {
                            // Reload gift to ensure we have fresh data (especially after redemption)
                            try {
                              const freshGiftResponse = await apiClient.getFamilyGift(gift.id)
                              setSelectedGift(freshGiftResponse.gift)
                            } catch (error) {
                              // Fallback to current gift data if API call fails
                              setSelectedGift(gift)
                            }
                            setShowEditGiftModal(true)
                          }}
                        >
                          {/* Purchased Badge */}
                          {(() => {
                            const hasBeenRedeemed = redemptions.some((r: any) => 
                              r.familyGiftId === gift.id && 
                              (r.status === 'pending' || r.status === 'fulfilled')
                            )
                            return hasBeenRedeemed && (
                              <div className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded-full z-10 shadow-md">
                                ✓ Purchased
                              </div>
                            )
                          })()}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedGift(gift)
                              setShowEditGiftModal(true)
                            }}
                            className="absolute top-2 right-2 text-[var(--primary)] hover:text-[var(--secondary)] transition-colors text-xl z-10"
                            title="Edit gift"
                          >
                            ⚙️
                          </button>
                          {gift.imageUrl && (
                            <a
                              href={gift.affiliateUrl || gift.sitestripeUrl || undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="block"
                            >
                              <img src={gift.imageUrl} alt={gift.title} className="w-full h-32 object-cover rounded mb-3 hover:opacity-90 transition-opacity cursor-pointer" />
                            </a>
                          )}
                          <h4 
                            className={`font-bold text-[var(--text-primary)] mb-1 pr-6 ${gift.affiliateUrl || gift.sitestripeUrl ? 'cursor-pointer hover:text-[var(--primary)] transition-colors' : ''}`}
                            onClick={(e) => {
                              if (gift.affiliateUrl || gift.sitestripeUrl) {
                                e.stopPropagation()
                                window.open(gift.affiliateUrl || gift.sitestripeUrl, '_blank', 'noopener,noreferrer')
                              }
                            }}
                          >
                            {gift.title}
                          </h4>
                          {gift.description && (
                            <p className="text-sm text-[var(--text-secondary)] mb-2 line-clamp-2">{gift.description}</p>
                          )}
                          {/* Assigned Children */}
                          {(() => {
                            const assignedChildren = gift.availableForAll 
                              ? children 
                              : children.filter((child: Child) => 
                                  gift.availableForChildIds && Array.isArray(gift.availableForChildIds) 
                                    ? gift.availableForChildIds.includes(child.id)
                                    : false
                                )
                            
                            return assignedChildren.length > 0 && (
                              <div className="mb-3 flex flex-wrap gap-2">
                                {assignedChildren.map((child: Child) => (
                                  <span
                                    key={child.id}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full"
                                  >
                                    👤 {child.nickname}
                                  </span>
                                ))}
                              </div>
                            )
                          })()}

                          <div className="flex items-center justify-between pt-3 border-t border-[var(--card-border)]">
                            <div className="flex items-center gap-2 flex-wrap">
                              {gift.type === 'amazon_product' && gift.pricePence && (
                                <span className="cb-chip bg-[var(--success)]/10 text-[var(--success)]">
                                  💰 {formatCurrency(gift.pricePence, family?.currency || 'GBP')}
                                </span>
                              )}
                              <span className="cb-chip bg-yellow-100 text-yellow-700">
                                ⭐ {gift.starsRequired}
                              </span>
                              <span className="cb-chip bg-blue-100 text-blue-700">
                                {gift.type}
                              </span>
                            </div>
                          </div>
                          {gift.createdByUser && (
                            <div className="mt-2 text-xs text-[var(--text-secondary)] italic">
                              Added by {gift.createdByUser.email?.split('@')[0] || 'Unknown'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Pending Redemptions Tab */}
              {giftsTab === 'pending' && (
                <div>
                  {(() => {
                    const pending = redemptions.filter((r: any) => r.status === 'pending' && r.familyGiftId)
                    if (pending.length === 0) {
                      return (
                        <div className="text-center py-12">
                          <div className="text-6xl mb-4">📦</div>
                          <p className="text-[var(--text-secondary)] font-medium">No pending redemptions</p>
                          <p className="text-sm text-[var(--text-secondary)] mt-2">Children's gift requests will appear here</p>
                        </div>
                      )
                    }
                    return (
                      <div className="space-y-3">
                        {pending.map((redemption: any) => {
                          const child = uniqueChildren.find((c: Child) => c.id === redemption.childId)
                          const gift = familyGifts.find((g: any) => g.id === redemption.familyGiftId) || redemption.familyGift
                          const giftCreator = gift?.createdByUser || redemption.familyGift?.createdByUser
                          const isMyGift = giftCreator && user?.id === giftCreator.id
                          
                          return (
                            <div 
                              key={redemption.id} 
                              className={`border-2 rounded-lg p-4 ${
                                isMyGift 
                                  ? 'bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-300 shadow-md' 
                                  : 'bg-[var(--background)] border-[var(--card-border)]'
                              }`}
                            >
                              {isMyGift && (
                                <div className="mb-2 flex items-center gap-2">
                                  <span className="px-2 py-1 bg-orange-500 text-white text-xs font-semibold rounded-full">
                                    ✨ Your Gift
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-3">
                                {gift?.imageUrl && (
                                  <img src={gift.imageUrl} alt={gift.title} className="w-16 h-16 object-cover rounded" />
                                )}
                                <div className="flex-1">
                                  <h4 className="font-bold text-[var(--text-primary)]">{gift?.title || 'Unknown Gift'}</h4>
                                  <p className="text-sm text-[var(--text-secondary)]">
                                    Requested by <span className="font-semibold">{child?.nickname || 'Unknown'}</span>
                                  </p>
                                  {giftCreator && (
                                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                                      Added by <span className={isMyGift ? 'font-semibold text-orange-600' : 'font-medium'}>{giftCreator.email?.split('@')[0] || 'Unknown'}</span>
                                    </p>
                                  )}
                                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                                    {new Date(redemption.createdAt).toLocaleDateString()} • {redemption.costPaid} ⭐ spent
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={async () => {
                                      try {
                                        await apiClient.fulfillRedemption(redemption.id)
                                        setToast({ message: 'Gift marked as fulfilled!', type: 'success' })
                                        loadRedemptions()
                                      } catch (error: any) {
                                        setToast({ message: error.message || 'Failed to fulfill redemption', type: 'error' })
                                      }
                                    }}
                                    className="min-h-[44px] px-4 py-3 sm:py-2 bg-green-100 text-green-700 rounded text-base sm:text-sm hover:bg-green-200 active:bg-green-300 touch-manipulation"
                                  >
                                    Fulfill
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Gift History Tab */}
              {giftsTab === 'history' && (
                <div>
                  {(() => {
                    const fulfilled = redemptions.filter((r: any) => r.status === 'fulfilled' && r.familyGiftId)
                    if (fulfilled.length === 0) {
                      return (
                        <div className="text-center py-12">
                          <div className="text-6xl mb-4">📜</div>
                          <p className="text-[var(--text-secondary)] font-medium">No gift history</p>
                          <p className="text-sm text-[var(--text-secondary)] mt-2">Fulfilled gift redemptions will appear here</p>
                        </div>
                      )
                    }
                    return (
                      <div className="space-y-3">
                        {fulfilled.map((redemption: any) => {
                          const child = uniqueChildren.find((c: Child) => c.id === redemption.childId)
                          const gift = familyGifts.find((g: any) => g.id === redemption.familyGiftId) || redemption.familyGift
                          const giftCreator = gift?.createdByUser || redemption.familyGift?.createdByUser
                          return (
                            <div key={redemption.id} className="bg-[var(--background)] border-2 border-[var(--card-border)] rounded-lg p-4">
                              <div className="flex items-center gap-3">
                                {gift?.imageUrl && (
                                  <img src={gift.imageUrl} alt={gift.title} className="w-16 h-16 object-cover rounded" />
                                )}
                                <div className="flex-1">
                                  <h4 className="font-bold text-[var(--text-primary)]">{gift?.title || 'Unknown Gift'}</h4>
                                  <p className="text-sm text-[var(--text-secondary)]">
                                    Redeemed by <span className="font-semibold">{child?.nickname || 'Unknown'}</span>
                                  </p>
                                  {giftCreator && (
                                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                                      Added by <span className="font-medium">{giftCreator.email?.split('@')[0] || 'Unknown'}</span>
                                    </p>
                                  )}
                                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                                    {new Date(redemption.createdAt).toLocaleDateString()} • {redemption.costPaid} ⭐
                                  </p>
                                  {/* Show Amazon link for approved Amazon products */}
                                  {gift && (gift.affiliateUrl || gift.sitestripeUrl) && (
                                    <div className="mt-2">
                                      <a 
                                        href={gift.affiliateUrl || gift.sitestripeUrl || '#'} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-block px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-semibold transition-colors"
                                      >
                                        🔗 Purchase on Amazon
                                      </a>
                                    </div>
                                  )}
                                </div>
                                <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Fulfilled</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Chat, Family & Leaderboard */}
          <div className="space-y-6">
            {/* Family Chat (Compact) - Only show if enabled for current user */}
            {(() => {
              const currentMember = members.find((m: any) => m.user?.id === user?.id || m.userId === user?.id)
              const chatEnabled = currentMember?.chatEnabled !== false // Default to true if not set
              
              if (!chatEnabled) return null
              
              return (
                <FamilyChat 
                  compact={true} 
                  maxMessages={6}
                  days={2}
                  onOpenFull={() => setShowChatModal(true)}
                />
              )
            })()}

            {/* Pocket Money & Payouts */}
            <div className="cb-card p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="cb-heading-md text-[var(--primary)]">💰 Pocket Money</h3>
              </div>

              {children.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-4xl mb-2">💵</p>
                  <p className="cb-body text-[var(--text-secondary)]">No children yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {uniqueChildren.map((child: any) => {
                    const childWallet = wallets.find((w: any) => w.childId === child.id)
                    const balancePence = childWallet?.balancePence || 0

                    // Calculate total paid out
                    const childPayouts = payouts.filter((p: any) => p.childId === child.id)
                    const totalPaidPence = childPayouts.reduce((sum: number, p: any) => sum + p.amountPence, 0)

                    // Get pending gifts for this child
                    const childGifts = gifts.filter((g: any) => g.childId === child.id && g.status === 'pending' && g.moneyPence > 0)
                    const totalGiftMoney = childGifts.reduce((sum: number, g: any) => sum + g.moneyPence, 0)

                    return (
                      <div key={child.id} className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-200 rounded-[var(--radius-lg)] p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-full flex items-center justify-center text-xl">
                              {child.nickname.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-bold text-[var(--text-primary)]">{child.nickname}</h4>
                              <p className="text-xs text-[var(--text-secondary)]">{childWallet?.stars || 0}⭐ available</p>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                            <button
                              onClick={() => {
                                setGiftChild(child)
                                setShowGiftStarsMoneyModal(true)
                              }}
                              className="min-h-[44px] flex-1 px-4 py-3 sm:px-3 sm:py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-bold hover:shadow-lg active:shadow-md active:scale-95 transition-all text-base sm:text-sm touch-manipulation"
                              title="Gift stars or money"
                            >
                              🎁 Gift
                            </button>
                            <button
                              onClick={() => {
                                setPayoutChild(child)
                                setPayoutAmount((balancePence / 100).toFixed(2))
                                setPayoutChoreAmount((balancePence / 100).toFixed(2))
                                setSelectedGiftIds([])
                                setShowPayoutModal(true)
                              }}
                              disabled={balancePence <= 0}
                              className="min-h-[44px] flex-1 px-4 py-3 sm:py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg font-bold hover:shadow-lg active:shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base sm:text-sm touch-manipulation"
                            >
                              💸 Pay Out
                            </button>
                          </div>
                        </div>

                        {(() => {
                          const childStats = walletStats.get(child.id)
                          const lifetimeEarningsPence = childStats?.lifetimeEarningsPence || 0
                          const showLifetime = budgetSettings?.showLifetimeEarnings !== false
                          const gridCols = showLifetime ? 'grid-cols-3' : 'grid-cols-2'
                          
                          return (
                            <div className={`grid ${gridCols} gap-2 text-sm mb-3`}>
                              <div className="bg-white/60 rounded-lg p-2">
                                <p className="text-xs text-[var(--text-secondary)]">Unpaid</p>
                                <p className="font-bold text-green-700">£{(balancePence / 100).toFixed(2)}</p>
                              </div>
                              <div className="bg-white/60 rounded-lg p-2">
                                <p className="text-xs text-[var(--text-secondary)]">Paid Out</p>
                                <p className="font-bold text-gray-600">£{(totalPaidPence / 100).toFixed(2)}</p>
                              </div>
                              {showLifetime && (
                                <div className="bg-white/60 rounded-lg p-2">
                                  <p className="text-xs text-[var(--text-secondary)]">Lifetime Earned</p>
                                  <p className="font-bold text-blue-700">£{(lifetimeEarningsPence / 100).toFixed(2)}</p>
                                </div>
                              )}
                            </div>
                          )
                        })()}

                        {/* Show split gifts if any */}
                        {childGifts.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-green-300">
                            <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Gifts from:</p>
                            <div className="space-y-1">
                              {childGifts.map((gift: any) => {
                                const giver = members.find((m: any) => m.id === gift.givenBy)
                                const giverName = giver?.displayName || giver?.user?.email?.split('@')[0] || 'Unknown'
                                return (
                                  <div key={gift.id} className="flex items-center justify-between text-xs bg-white/60 rounded px-2 py-1">
                                    <span className="text-[var(--text-secondary)]">
                                      {giverName} gift
                                    </span>
                                    <span className="font-bold text-green-700">
                                      £{(gift.moneyPence / 100).toFixed(2)}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Recent Payouts */}
              {payouts.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold text-[var(--text-primary)] mb-3 text-sm">📝 Recent Payouts</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {payouts.slice(0, 5).map((payout: any) => {
                      // Get the name to display - try to get from family members first, fallback to email
                      const paidByName = payout.paidByUser 
                        ? members.find((m: any) => m.userId === payout.paidBy)?.user?.email?.split('@')[0] || payout.paidByUser.email?.split('@')[0] || 'Parent'
                        : 'Parent'
                      
                      return (
                        <div key={payout.id} className="flex items-center justify-between p-2 bg-[var(--background)] rounded-lg text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">💵</span>
                            <div>
                              <p className="font-medium text-[var(--text-primary)]">{payout.child?.nickname}</p>
                              <p className="text-xs text-[var(--text-secondary)]">
                                {new Date(payout.createdAt).toLocaleDateString()} • {payout.method || 'cash'} • Paid by {paidByName}
                              </p>
                            </div>
                          </div>
                          <p className="font-bold text-green-600">£{(payout.amountPence / 100).toFixed(2)}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Weekly Leaderboard */}
            <div className="cb-card p-6">
              <h3 className="cb-heading-md text-[var(--primary)] mb-4">🏆 Weekly Leaders</h3>
              <div className="space-y-3">
                {leaderboard.slice(0, 5).map((entry, index) => (
                  <div key={entry.childId} className="bg-white border-2 border-[var(--card-border)] rounded-[var(--radius-md)] p-3 hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                        index === 0 ? 'bg-gradient-to-br from-[var(--bonus-stars)] to-yellow-500 text-white shadow-lg' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700' :
                        index === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-orange-900' :
                        'bg-[var(--card-border)] text-[var(--text-secondary)]'
                      }`}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[var(--text-primary)] truncate">{entry.nickname}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {entry.completedChores} chore{entry.completedChores !== 1 ? 's' : ''} • £{((entry.totalRewardPence || 0) / 100).toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-xl text-[var(--bonus-stars)]">{entry.totalStars || 0}⭐</p>
                      </div>
                    </div>
                  </div>
                ))}
                {leaderboard.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-5xl mb-3">🏆</div>
                    <p className="text-[var(--text-secondary)] font-medium">No activity yet this week</p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">Complete chores to appear on the leaderboard!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Family Members - Moved to bottom */}
            <div className="cb-card p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="cb-heading-md text-[var(--primary)]">👨‍👩‍👧‍👦 Family</h3>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="cb-button-primary text-sm"
                >
                  ➕ Invite
                </button>
              </div>

              {/* Outstanding Join Codes */}
              {joinCodes.length > 0 && (
                <div className="mb-4 p-4 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-[var(--radius-lg)]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🎟️</span>
                    <h4 className="font-bold text-[var(--text-primary)]">Active Join Codes</h4>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mb-3">
                    Share these codes with your kids to join the family!
                  </p>
                  <div className="space-y-2">
                    {joinCodes.map((joinCode) => (
                      <div
                        key={joinCode.id}
                        className="flex items-center gap-2 p-3 bg-white rounded-[var(--radius-md)] border-2 border-[var(--card-border)]"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-mono text-2xl font-bold text-[var(--primary)] tracking-wider">
                              {joinCode.code}
                            </div>
                            {joinCode.intendedNickname && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                                For {joinCode.intendedNickname}
                              </span>
                            )}
                            {joinCode.usedByChild && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                Used by {joinCode.usedByChild.nickname}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] mt-1">
                            Expires {new Date(joinCode.expiresAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(joinCode.code)
                            setToast({ message: '📋 Code copied to clipboard!', type: 'info' })
                          }}
                          className="min-h-[44px] px-4 py-3 sm:py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] hover:bg-[var(--secondary)] active:bg-[var(--secondary)]/90 transition-all font-semibold text-base sm:text-sm touch-manipulation"
                        >
                          📋 Copy
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-3 italic text-center">
                    Kids can enter this code on the join page or http://localhost:1500/child-join
                  </p>
                </div>
              )}

              {/* Adults/Parents List */}
              {(() => {
                // Filter out children (child_player role) to get only adults
                const adultMembers = members.filter((m: any) => m.role !== 'child_player')
                
                const getRoleDisplayName = (role: string) => {
                  const roleMap: Record<string, string> = {
                    'parent_admin': '👑 Family Admin',
                    'parent_co_parent': '👨‍👩‍👧 Co-Parent',
                    'parent_viewer': '👀 Viewer',
                    'grandparent': '👴👵 Grandparent',
                    'uncle_aunt': '👨‍👩 Uncle/Aunt',
                    'relative_contributor': '🎁 Contributor'
                  }
                  return roleMap[role] || role
                }
                
                if (adultMembers.length > 0) {
                  return (
                    <div className="mb-6">
                      <h4 className="font-semibold text-[var(--text-primary)] mb-3 text-sm">👨‍👩‍👧 Adults & Parents</h4>
                      <div className="space-y-2">
                        {adultMembers.map((member: any) => (
                          <button
                            key={member.id}
                            onClick={async () => {
                              setSelectedAdult(member)
                              setAdultProfileTab('info')
                              setShowAdultProfileModal(true)
                              // Load stats when opening modal
                              try {
                                setLoadingAdultStats(true)
                                const statsResponse = await apiClient.getMemberStats(member.id)
                                setAdultStats(statsResponse.stats)
                              } catch (error) {
                                console.error('Failed to load member stats:', error)
                              } finally {
                                setLoadingAdultStats(false)
                              }
                            }}
                            className="w-full flex items-center gap-3 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-[var(--radius-md)] hover:shadow-md hover:border-blue-400 transition-all cursor-pointer text-left"
                          >
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0">
                              {member.user?.email?.charAt(0).toUpperCase() || 'P'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-[var(--text-primary)] truncate">
                                  {member.displayName || member.user?.email?.split('@')[0] || member.user?.email || 'Parent'}
                                </h4>
                                {member.paused && (
                                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                                    ⏸️ Paused
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[var(--text-secondary)] truncate">
                                {getRoleDisplayName(member.role)} • {member.user?.email || 'No email'}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">
                                Joined {new Date(member.joinedAt || member.user?.createdAt || member.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors shrink-0">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                }
                return null
              })()}

              {/* Children List */}
              <div className="space-y-3">
                {uniqueChildren.map((child) => {
                  // Get this child's wallet to show total stars
                  const childWallet = wallets.find((w: any) => w.childId === child.id)
                  const totalStars = childWallet?.stars || 0
                  
                  // Also get weekly stars for comparison
                  const leaderboardEntry = leaderboard.find((entry: any) => entry.childId === child.id)
                  const weeklyStars = leaderboardEntry?.totalStars || 0

                  return (
                    <button
                      key={child.id}
                      onClick={async () => {
                        // Fetch fresh child data to ensure we have the latest pause status
                        try {
                          const response = await apiClient.getFamilyMembers()
                          const freshChild = response.children?.find((c: any) => c.id === child.id)
                          if (freshChild) {
                            setSelectedChild(freshChild)
                          } else {
                            setSelectedChild(child)
                          }
                        } catch (error) {
                          console.error('Failed to fetch fresh child data:', error)
                          setSelectedChild(child)
                        }
                        setNewJoinCode(null)
                        setShowChildProfileModal(true)
                      }}
                      className="w-full flex items-center gap-3 p-3 bg-[var(--background)] rounded-[var(--radius-md)] hover:shadow-md hover:border-2 hover:border-[var(--primary)] transition-all cursor-pointer"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-full flex items-center justify-center text-2xl shrink-0">
                        {child.nickname.charAt(0)}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-[var(--text-primary)]">{child.nickname}</h4>
                          {child.paused && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                              ⏸️ Paused
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">{child.ageGroup} years</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="font-bold text-[var(--primary)]">{totalStars}⭐</p>
                          <p className="text-xs text-[var(--text-secondary)]">total</p>
                          {weeklyStars > 0 && (
                            <p className="text-xs text-[var(--success)]">+{weeklyStars} this week</p>
                          )}
                        </div>
                        <div className="text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  )
                })}
                {children.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-6xl mb-2">👨‍👩‍👧</p>
                    <p className="cb-body text-[var(--text-secondary)]">Invite children to join!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overscroll-contain">
          <div className="cb-card w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <h3 className="cb-heading-lg text-center mb-6 text-[var(--primary)]">⚙️ Family Settings</h3>
            
            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
              <button
                onClick={() => setSettingsTab('rivalry')}
                className={`min-h-[44px] px-4 py-3 sm:py-2 rounded-lg font-semibold whitespace-nowrap transition-all touch-manipulation flex-shrink-0 ${
                  settingsTab === 'rivalry'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background)] text-[var(--text-secondary)] hover:bg-[var(--card-border)] active:bg-[var(--card-border)]'
                }`}
              >
                ⚔️ Rivalry
              </button>
              <button
                onClick={() => setSettingsTab('budget')}
                className={`min-h-[44px] px-4 py-3 sm:py-2 rounded-lg font-semibold whitespace-nowrap transition-all touch-manipulation flex-shrink-0 ${
                  settingsTab === 'budget'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background)] text-[var(--text-secondary)] hover:bg-[var(--card-border)] active:bg-[var(--card-border)]'
                }`}
              >
                💰 Budget
              </button>
              <button
                onClick={() => setSettingsTab('account')}
                className={`min-h-[44px] px-4 py-3 sm:py-2 rounded-lg font-semibold whitespace-nowrap transition-all touch-manipulation flex-shrink-0 ${
                  settingsTab === 'account'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background)] text-[var(--text-secondary)] hover:bg-[var(--card-border)] active:bg-[var(--card-border)]'
                }`}
              >
                🔧 Account
              </button>
            </div>

            <div className="space-y-6">
              {/* Rivalry Tab */}
              {settingsTab === 'rivalry' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-[var(--background)] rounded-[var(--radius-md)]">
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] mb-1">⚔️ Sibling Rivalry</h4>
                    <p className="text-sm text-[var(--text-secondary)]">Let kids compete for chores</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rivalrySettings.enabled}
                      onChange={(e) => setRivalrySettings(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--primary)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                  </label>
                </div>

                {rivalrySettings.enabled && (
                  <div className="space-y-4 pl-6 border-l-4 border-[var(--primary)]">
                    <div>
                      <label className="block font-semibold text-[var(--text-primary)] mb-2">
                        Minimum underbid: {rivalrySettings.minUnderbidDifference}p
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={rivalrySettings.minUnderbidDifference}
                        onChange={(e) => setRivalrySettings(prev => ({ ...prev, minUnderbidDifference: parseInt(e.target.value) }))}
                        className="w-full accent-[var(--primary)]"
                      />
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rivalrySettings.friendlyMode}
                        onChange={(e) => setRivalrySettings(prev => ({ ...prev, friendlyMode: e.target.checked }))}
                        className="w-5 h-5 accent-[var(--primary)]"
                      />
                      <div>
                        <span className="font-semibold text-[var(--text-primary)]">Friendly Mode</span>
                        <p className="text-xs text-[var(--text-secondary)]">Use humorous wording only</p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
              )}

              {/* Budget Tab */}
              {settingsTab === 'budget' && (
              <div className="space-y-4">
                <div className="p-4 bg-[var(--background)] rounded-[var(--radius-md)]">
                  <h4 className="font-bold text-[var(--text-primary)] mb-3">💰 Budget Management</h4>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Set a max pocket money budget to control spending
                  </p>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-[var(--text-primary)] mb-2 text-sm">
                          Budget Period
                        </label>
                        <select
                          value={budgetSettings.budgetPeriod}
                          onChange={(e) => setBudgetSettings(prev => ({ ...prev, budgetPeriod: e.target.value as 'weekly' | 'monthly' }))}
                          className="w-full min-h-[44px] px-4 py-3 sm:py-2 text-base sm:text-sm border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none touch-manipulation"
                        >
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block font-semibold text-[var(--text-primary)] mb-2 text-sm">
                          Max Budget (£)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={(budgetSettings.maxBudgetPence / 100).toFixed(2)}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0
                            setBudgetSettings(prev => ({ ...prev, maxBudgetPence: Math.round(value * 100) }))
                          }}
                          className="w-full min-h-[44px] px-4 py-3 sm:py-2 text-base sm:text-sm border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none touch-manipulation"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    
                    {budgetSettings.maxBudgetPence > 0 && (() => {
                      // Calculate allocated budget using current budgetSettings.budgetPeriod (not database value)
                      // This matches the "Estimated Monthly Earnings Per Child" calculation
                      let totalWeeklyEarnings = 0
                      uniqueChildren.forEach((child: any) => {
                        const childAssignments = assignments.filter((a: any) => 
                          a.childId === child.id && a.chore?.active
                        )
                        
                        // De-duplicate by choreId to avoid counting the same chore multiple times
                        const uniqueChoreIds = new Set<string>()
                        const deduplicatedAssignments = childAssignments.filter((a: any) => {
                          if (uniqueChoreIds.has(a.choreId)) {
                            return false // Skip duplicate
                          }
                          uniqueChoreIds.add(a.choreId)
                          return true
                        })
                        
                        deduplicatedAssignments.forEach((a: any) => {
                          if (a.chore?.frequency === 'daily') {
                            totalWeeklyEarnings += (a.chore.baseRewardPence || 0) * 7
                          } else if (a.chore?.frequency === 'weekly') {
                            totalWeeklyEarnings += (a.chore.baseRewardPence || 0)
                          }
                          // 'once' chores don't count towards regular budget
                        })
                      })

                      // Convert to monthly if needed
                      const calculatedAllocatedPence = budgetSettings.budgetPeriod === 'monthly' 
                        ? totalWeeklyEarnings * 4 
                        : totalWeeklyEarnings

                      const calculatedRemainingPence = budgetSettings.maxBudgetPence - calculatedAllocatedPence
                      const calculatedPercentUsed = budgetSettings.maxBudgetPence 
                        ? Math.round((calculatedAllocatedPence / budgetSettings.maxBudgetPence) * 100) 
                        : 0

                      return (
                        <>
                        <div className="p-3 bg-white rounded-[var(--radius-md)] border-2 border-[var(--card-border)]">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-[var(--text-secondary)]">Currently Allocated:</span>
                            <span className="font-bold text-[var(--text-primary)]">£{(calculatedAllocatedPence / 100).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-[var(--text-secondary)]">Remaining:</span>
                            <span className={`font-bold ${calculatedRemainingPence < 0 ? 'text-red-600' : 'text-[var(--success)]'}`}>
                              £{(calculatedRemainingPence / 100).toFixed(2)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 mt-3">
                            <div 
                              className={`h-3 rounded-full transition-all ${
                                calculatedPercentUsed > 90 ? 'bg-red-500' : 
                                calculatedPercentUsed > 70 ? 'bg-orange-500' : 
                                'bg-[var(--success)]'
                              }`}
                              style={{ width: `${Math.min(calculatedPercentUsed, 100)}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] mt-2 text-center">
                            {calculatedPercentUsed}% of budget allocated
                          </p>
                        </div>

                        {/* Per-Child Breakdown */}
                        {children.length > 0 && (
                          <div className="mt-4 p-3 bg-gradient-to-br from-blue-50 to-purple-50 rounded-[var(--radius-md)] border-2 border-blue-200">
                            <h5 className="font-bold text-[var(--text-primary)] mb-3 text-sm">
                              📊 Estimated {budgetSettings.budgetPeriod === 'monthly' ? 'Monthly' : 'Weekly'} Earnings Per Child
                            </h5>
                            <div className="space-y-2">
                              {uniqueChildren.map((child: any) => {
                                // Calculate this child's potential earnings from active assignments
                                // Filter to only assignments for this child with active chores
                                const childAssignments = assignments.filter((a: any) => 
                                  a.childId === child.id && a.chore?.active
                                )
                                
                                // De-duplicate by choreId to avoid counting the same chore multiple times
                                // (in case there are duplicate assignments for the same chore)
                                const uniqueChoreIds = new Set<string>()
                                const deduplicatedAssignments = childAssignments.filter((a: any) => {
                                  if (!a.choreId) return false // Skip if no choreId
                                  if (uniqueChoreIds.has(a.choreId)) {
                                    return false // Skip duplicate
                                  }
                                  uniqueChoreIds.add(a.choreId)
                                  return true
                                })
                                
                                let weeklyEarnings = 0
                                deduplicatedAssignments.forEach((a: any) => {
                                  if (!a.chore) return // Skip if no chore data
                                  if (a.chore?.frequency === 'daily') {
                                    weeklyEarnings += (a.chore.baseRewardPence || 0) * 7
                                  } else if (a.chore?.frequency === 'weekly') {
                                    weeklyEarnings += (a.chore.baseRewardPence || 0)
                                  }
                                  // 'once' chores don't count towards regular budget
                                })

                                // Convert to monthly if needed
                                const earnings = budgetSettings.budgetPeriod === 'monthly' 
                                  ? weeklyEarnings * 4 
                                  : weeklyEarnings

                                return (
                                  <div key={child.id} className="flex justify-between items-center text-sm bg-white/70 px-3 py-2 rounded-lg">
                                    <span className="font-medium text-[var(--text-primary)]">
                                      {child.nickname}
                                    </span>
                                    <span className="font-bold text-[var(--secondary)]">
                                      £{(earnings / 100).toFixed(2)}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] mt-3 italic">
                              * Based on assigned chores at base reward (no bonuses or bidding)
                            </p>
                          </div>
                        )}
                      </>
                      )
                    })()}
                    
                    {/* Lifetime Earnings Toggle */}
                    <div className="border-t-2 border-[var(--card-border)] pt-4 mt-4">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={budgetSettings.showLifetimeEarnings}
                          onChange={(e) => setBudgetSettings(prev => ({ ...prev, showLifetimeEarnings: e.target.checked }))}
                          className="w-5 h-5 mt-1 text-[var(--primary)] rounded focus:ring-2 focus:ring-[var(--primary)]"
                        />
                        <div>
                          <div className="font-bold text-[var(--text-primary)]">💰 Show Lifetime Earnings</div>
                          <p className="text-sm text-[var(--text-secondary)] mt-1">
                            Display total earned money (lifetime) on children's portal at the top next to their current balance.
                          </p>
                        </div>
                      </label>
                    </div>
                    
                    {/* Buy Stars Feature */}
                    <div className="border-t-2 border-[var(--card-border)] pt-4 mt-4">
                      <h4 className="font-bold text-[var(--text-primary)] mb-3">⭐ Buy Stars Feature</h4>
                      <p className="text-sm text-[var(--text-secondary)] mb-4">
                        Allow children to buy stars using their pocket money
                      </p>
                      
                      <div className="space-y-4">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={buyStarsEnabledTemp || budgetSettings.buyStarsEnabled}
                            onChange={(e) => {
                              const newValue = e.target.checked
                              setBudgetSettings(prev => ({ ...prev, buyStarsEnabled: newValue }))
                              setBuyStarsEnabledTemp(newValue)
                              
                              // Clear existing timeout
                              if (buyStarsEnabledTimeoutRef.current) {
                                clearTimeout(buyStarsEnabledTimeoutRef.current)
                              }
                              
                              // Set timeout to clear temp state after 60 seconds
                              buyStarsEnabledTimeoutRef.current = setTimeout(() => {
                                setBuyStarsEnabledTemp(false)
                              }, 60000)
                            }}
                            className="w-5 h-5 text-[var(--primary)] border-2 border-[var(--card-border)] rounded focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
                          />
                          <span className="font-semibold text-[var(--text-primary)]">
                            Enable Buy Stars
                          </span>
                        </label>
                        
                        {budgetSettings.buyStarsEnabled && (
                          <div className="ml-8 space-y-3">
                            <div>
                              <label className="block font-semibold text-[var(--text-primary)] mb-2 text-sm">
                                Star Conversion Rate: £{((budgetSettings.starConversionRatePence) / 100).toFixed(2)} per star
                              </label>
                              <input
                                type="range"
                                min="5"
                                max="30"
                                step="1"
                                value={budgetSettings.starConversionRatePence}
                                onChange={(e) => setBudgetSettings(prev => ({ ...prev, starConversionRatePence: parseInt(e.target.value) }))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
                              />
                              <div className="flex justify-between text-xs text-[var(--text-secondary)] mt-1">
                                <span>5p</span>
                                <span>30p</span>
                              </div>
                              <p className="text-xs text-[var(--text-secondary)] mt-2">
                                Current rate: {budgetSettings.starConversionRatePence}p per star
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
              </div>
            </div>
              )}

              {/* Account Tab */}
              {settingsTab === 'account' && (
              <div className="space-y-6">
                {/* Parent Email Management Section */}
                <div className="border-t-2 border-blue-200 pt-6">
                  <h4 className="font-bold text-blue-600 mb-4">📧 Email Management</h4>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-[var(--radius-md)]">
                      <h5 className="font-semibold text-blue-800 mb-2">Current Email Address</h5>
                      <p className="text-sm text-blue-700 mb-3">{user?.email}</p>
                      <button
                        onClick={() => setShowEmailChangeModal(true)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold text-sm"
                      >
                        Change Email
                      </button>
                    </div>
                  </div>
                </div>

                {/* Account Management Section */}
                <div className="border-t-2 border-red-200 pt-6">
                  <h4 className="font-bold text-red-600 mb-4">⚠️ Account Management</h4>
                  
                  <div className="space-y-4">
                    {/* Suspend Account */}
                    <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-[var(--radius-md)]">
                      <div>
                        <h5 className="font-semibold text-yellow-800 mb-1">⏸️ Suspend Account</h5>
                        <p className="text-sm text-yellow-700">Prevent automatic deletion for 12 months</p>
                      </div>
                      <button
                        onClick={() => setShowSuspendAccountModal(true)}
                        className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-semibold"
                      >
                        Suspend
                      </button>
                    </div>

                    {/* Delete Account */}
                    <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-[var(--radius-md)]">
                      <div>
                        <h5 className="font-semibold text-red-800 mb-1">🗑️ Delete Account</h5>
                        <p className="text-sm text-red-700">Permanently delete all family data</p>
                      </div>
                      <button
                        onClick={() => setShowDeleteAccountModal(true)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Account Actions Section */}
                  <div className="pt-6 border-t-2 border-[var(--card-border)]">
                    <h4 className="font-bold text-[var(--text-primary)] mb-4">🔧 Account Actions</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          setShowSettingsModal(false)
                          setShowFamilyModal(true)
                        }}
                        className="px-4 py-3 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 hover:border-blue-400 rounded-[var(--radius-lg)] font-semibold text-blue-900 transition-all flex items-center justify-center gap-2"
                      >
                        ✏️ Edit Family
                      </button>
                      <button
                        onClick={() => {
                          setShowSettingsModal(false)
                          logout()
                        }}
                        className="px-4 py-3 bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 hover:border-orange-400 rounded-[var(--radius-lg)] font-semibold text-orange-900 transition-all flex items-center justify-center gap-2"
                      >
                        👋 Logout
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="min-h-[44px] flex-1 px-6 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] font-semibold hover:bg-[var(--background)] active:bg-[var(--card-border)] transition-all touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    // Update state optimistically BEFORE API call
                    if (family) {
                      setFamily((prev: Family | null) => {
                        if (!prev) return prev
                        return {
                          ...prev,
                          maxBudgetPence: budgetSettings.maxBudgetPence,
                          budgetPeriod: budgetSettings.budgetPeriod,
                          showLifetimeEarnings: budgetSettings.showLifetimeEarnings,
                          buyStarsEnabled: budgetSettings.buyStarsEnabled,
                          starConversionRatePence: budgetSettings.starConversionRatePence
                        }
                      })
                    }
                    
                    // Save budget settings
                    await apiClient.updateFamily({
                      maxBudgetPence: budgetSettings.maxBudgetPence,
                      budgetPeriod: budgetSettings.budgetPeriod,
                      showLifetimeEarnings: budgetSettings.showLifetimeEarnings,
                      buyStarsEnabled: budgetSettings.buyStarsEnabled,
                      starConversionRatePence: budgetSettings.starConversionRatePence
                    })
                    // TODO: Save rivalry settings when backend is ready
                    
                    // WebSocket will update state automatically, but update here too for immediate feedback
                    setToast({ message: '✅ Settings saved successfully!', type: 'success' })
                    // Don't wait for loadDashboard - WebSocket will handle the refresh
                  } catch (error) {
                    console.error('Failed to save settings:', error)
                    // Revert optimistic update on error
                    loadDashboard()
                    setToast({ message: 'Failed to save settings. Please try again.', type: 'error' })
                  } finally {
                    // Always close the modal
                    setShowSettingsModal(false)
                  }
                }}
                className="min-h-[44px] flex-1 cb-button-primary touch-manipulation"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Streak Settings Modal */}
      {showStreakSettingsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overscroll-contain">
          <div className="cb-card w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <div className="text-center mb-6">
              <h3 className="cb-heading-xl text-[var(--primary)] mb-2">🔥 Streak Settings</h3>
              <p className="text-[var(--text-secondary)]">Set up rewards and penalties to keep the momentum going!</p>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <button
                onClick={() => setStreakSettingsTab('overview')}
                className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  streakSettingsTab === 'overview'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background)] text-[var(--text-secondary)] hover:bg-[var(--card-border)]'
                }`}
              >
                📊 Overview
              </button>
              <button
                onClick={() => setStreakSettingsTab('bonuses')}
                className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  streakSettingsTab === 'bonuses'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background)] text-[var(--text-secondary)] hover:bg-[var(--card-border)]'
                }`}
              >
                🎁 Bonuses
              </button>
              <button
                onClick={() => setStreakSettingsTab('penalties')}
                className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  streakSettingsTab === 'penalties'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background)] text-[var(--text-secondary)] hover:bg-[var(--card-border)]'
                }`}
              >
                ⚠️ Penalties
              </button>
              <button
                onClick={() => setStreakSettingsTab('protection')}
                className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  streakSettingsTab === 'protection'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background)] text-[var(--text-secondary)] hover:bg-[var(--card-border)]'
                }`}
              >
                🛡️ Protection
              </button>
            </div>

            <div className="space-y-8">
              {/* Overview Tab */}
              {streakSettingsTab === 'overview' && (
                <>
                  {/* Streak Summary */}
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-[var(--radius-lg)] border-2 border-indigo-200">
                    <h4 className="font-bold text-lg text-indigo-900 mb-4 flex items-center gap-2">
                      <span className="text-2xl">📊</span> Your Streak System Summary
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="text-blue-500">🛡️</span>
                        <p className="text-indigo-800">
                          <strong>{streakSettings.protectionDays} {streakSettings.protectionDays === 1 ? 'day' : 'days'}</strong> grace period before penalties
                        </p>
                      </div>
                      {streakSettings.bonusEnabled && (
                        <div className="flex items-start gap-2">
                          <span className="text-green-500">🎁</span>
                          <p className="text-indigo-800">
                            <strong>Bonus after {streakSettings.bonusDays} days:</strong> {' '}
                            {streakSettings.bonusType === 'money' && `£${(streakSettings.bonusMoneyPence / 100).toFixed(2)}`}
                            {streakSettings.bonusType === 'stars' && `${streakSettings.bonusStars} ⭐`}
                            {streakSettings.bonusType === 'both' && `£${(streakSettings.bonusMoneyPence / 100).toFixed(2)} + ${streakSettings.bonusStars} ⭐`}
                          </p>
                        </div>
                      )}
                      {streakSettings.penaltyEnabled && (
                        <>
                          <div className="flex items-start gap-2">
                            <span className="text-yellow-500">1️⃣</span>
                            <p className="text-indigo-800">
                              <strong>1st miss:</strong> {' '}
                              {streakSettings.penaltyType === 'money' && `£${(streakSettings.firstMissPence / 100).toFixed(2)}`}
                              {streakSettings.penaltyType === 'stars' && `${streakSettings.firstMissStars} ⭐`}
                              {streakSettings.penaltyType === 'both' && `£${(streakSettings.firstMissPence / 100).toFixed(2)} + ${streakSettings.firstMissStars} ⭐`}
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-orange-500">2️⃣</span>
                            <p className="text-indigo-800">
                              <strong>2nd miss:</strong> {' '}
                              {streakSettings.penaltyType === 'money' && `£${(streakSettings.secondMissPence / 100).toFixed(2)}`}
                              {streakSettings.penaltyType === 'stars' && `${streakSettings.secondMissStars} ⭐`}
                              {streakSettings.penaltyType === 'both' && `£${(streakSettings.secondMissPence / 100).toFixed(2)} + ${streakSettings.secondMissStars} ⭐`}
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-red-500">3️⃣</span>
                            <p className="text-indigo-800">
                              <strong>3rd+ miss:</strong> {' '}
                              {streakSettings.penaltyType === 'money' && `£${(streakSettings.thirdMissPence / 100).toFixed(2)}`}
                              {streakSettings.penaltyType === 'stars' && `${streakSettings.thirdMissStars} ⭐`}
                              {streakSettings.penaltyType === 'both' && `£${(streakSettings.thirdMissPence / 100).toFixed(2)} + ${streakSettings.thirdMissStars} ⭐`}
                            </p>
                          </div>
                        </>
                      )}
                      <div className="flex items-start gap-2">
                        <span className="text-purple-500">🛡️</span>
                        <p className="text-indigo-800">
                          <strong>Minimum balance:</strong> £{(streakSettings.minBalancePence / 100).toFixed(2)} + {streakSettings.minBalanceStars} ⭐
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Streak Protection */}
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-[var(--radius-lg)] border-2 border-blue-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-2xl">
                    🛡️
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-blue-900">Streak Protection</h4>
                    <p className="text-sm text-blue-700">Grace period before penalties kick in</p>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-blue-900 mb-3">
                    Protection Days: <span className="text-blue-600 text-2xl">{streakSettings.protectionDays}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="7"
                    value={streakSettings.protectionDays}
                    onChange={(e) => setStreakSettings(prev => ({ ...prev, protectionDays: parseInt(e.target.value) }))}
                    className="w-full h-3 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-blue-600 mt-1">
                    <span>None</span>
                    <span>1 week</span>
                  </div>
                  <p className="text-sm text-blue-700 mt-3">
                    💡 Children get <strong>{streakSettings.protectionDays} {streakSettings.protectionDays === 1 ? 'day' : 'days'}</strong> to miss a chore before penalties apply.
                    {streakSettings.protectionDays === 0 && ' Penalties start immediately!'}
                  </p>
                </div>
              </div>
                </>
              )}

              {/* Bonuses Tab */}
              {streakSettingsTab === 'bonuses' && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-[var(--radius-lg)] border-2 border-green-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-2xl">
                      🎁
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-green-900">Streak Bonuses</h4>
                      <p className="text-sm text-green-700">Reward consecutive completions!</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={streakSettings.bonusEnabled}
                      onChange={(e) => setStreakSettings(prev => ({ ...prev, bonusEnabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>

                {streakSettings.bonusEnabled && (
                  <div className="space-y-4 pl-6 border-l-4 border-green-500">
                    <div>
                      <label className="block font-semibold text-green-900 mb-3">
                        Bonus after: <span className="text-green-600 text-2xl">{streakSettings.bonusDays}</span> days in a row
                      </label>
                      <input
                        type="range"
                        min="3"
                        max="30"
                        value={streakSettings.bonusDays}
                        onChange={(e) => {
                          const value = parseInt(e.target.value)
                          if (isNaN(value)) {
                            console.error('Invalid bonusDays value:', e.target.value)
                            return
                          }
                          setStreakSettings(prev => ({ ...prev, bonusDays: value }))
                        }}
                        className="w-full h-3 bg-green-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                      />
                      <div className="flex justify-between text-xs text-green-600 mt-1">
                        <span>3 days</span>
                        <span>30 days</span>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-green-900 mb-2">Bonus Type</label>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setStreakSettings(prev => ({ ...prev, bonusType: 'money' }))}
                          className={`p-3 rounded-lg border-2 font-semibold transition-all ${
                            streakSettings.bonusType === 'money' 
                              ? 'bg-yellow-500 border-yellow-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-700 hover:border-yellow-400'
                          }`}
                        >
                          💰 Money
                        </button>
                        <button
                          type="button"
                          onClick={() => setStreakSettings(prev => ({ ...prev, bonusType: 'stars' }))}
                          className={`p-3 rounded-lg border-2 font-semibold transition-all ${
                            streakSettings.bonusType === 'stars' 
                              ? 'bg-purple-500 border-purple-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-700 hover:border-purple-400'
                          }`}
                        >
                          ⭐ Stars
                        </button>
                        <button
                          type="button"
                          onClick={() => setStreakSettings(prev => ({ ...prev, bonusType: 'both' }))}
                          className={`p-3 rounded-lg border-2 font-semibold transition-all ${
                            streakSettings.bonusType === 'both' 
                              ? 'bg-gradient-to-r from-yellow-500 to-purple-500 border-purple-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-700 hover:border-green-400'
                          }`}
                        >
                          💎 Both!
                        </button>
                      </div>
                    </div>

                    {(streakSettings.bonusType === 'money' || streakSettings.bonusType === 'both') && (
                      <div>
                        <label className="block font-semibold text-green-900 mb-2">
                          Money Bonus: £{(streakSettings.bonusMoneyPence / 100).toFixed(2)}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={streakSettings.bonusMoneyPence}
                          onChange={(e) => setStreakSettings(prev => ({ ...prev, bonusMoneyPence: parseInt(e.target.value) || 0 }))}
                          className="w-full min-h-[44px] px-4 py-3 sm:py-2 text-base sm:text-sm border-2 border-green-300 rounded-lg focus:border-green-500 focus:outline-none touch-manipulation"
                          placeholder="Bonus in pence"
                        />
                      </div>
                    )}

                    {(streakSettings.bonusType === 'stars' || streakSettings.bonusType === 'both') && (
                      <div>
                        <label className="block font-semibold text-green-900 mb-2">
                          Star Bonus: {streakSettings.bonusStars} ⭐
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={streakSettings.bonusStars}
                          onChange={(e) => setStreakSettings(prev => ({ ...prev, bonusStars: parseInt(e.target.value) || 0 }))}
                          className="w-full min-h-[44px] px-4 py-3 sm:py-2 text-base sm:text-sm border-2 border-green-300 rounded-lg focus:border-green-500 focus:outline-none touch-manipulation"
                          placeholder="Bonus stars"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* Penalties Tab */}
              {streakSettingsTab === 'penalties' && (
              <div className="bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-[var(--radius-lg)] border-2 border-orange-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-2xl">
                      ⚠️
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-orange-900">Streak Penalties</h4>
                      <p className="text-sm text-orange-700">Escalating consequences for missed chores</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={streakSettings.penaltyEnabled}
                      onChange={(e) => setStreakSettings(prev => ({ ...prev, penaltyEnabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                </div>

                {streakSettings.penaltyEnabled && (
                  <div className="space-y-6 pl-6 border-l-4 border-orange-500">
                    <div>
                      <label className="block font-semibold text-orange-900 mb-2">Penalty Type</label>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setStreakSettings(prev => ({ ...prev, penaltyType: 'money' }))}
                          className={`p-3 rounded-lg border-2 font-semibold transition-all ${
                            streakSettings.penaltyType === 'money' 
                              ? 'bg-yellow-500 border-yellow-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-700 hover:border-yellow-400'
                          }`}
                        >
                          💰 Money
                        </button>
                        <button
                          type="button"
                          onClick={() => setStreakSettings(prev => ({ ...prev, penaltyType: 'stars' }))}
                          className={`p-3 rounded-lg border-2 font-semibold transition-all ${
                            streakSettings.penaltyType === 'stars' 
                              ? 'bg-purple-500 border-purple-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-700 hover:border-purple-400'
                          }`}
                        >
                          ⭐ Stars
                        </button>
                        <button
                          type="button"
                          onClick={() => setStreakSettings(prev => ({ ...prev, penaltyType: 'both' }))}
                          className={`p-3 rounded-lg border-2 font-semibold transition-all ${
                            streakSettings.penaltyType === 'both' 
                              ? 'bg-gradient-to-r from-yellow-500 to-purple-500 border-purple-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-700 hover:border-orange-400'
                          }`}
                        >
                          💎 Both!
                        </button>
                      </div>
                    </div>

                    {/* First Miss */}
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-300">
                      <h5 className="font-bold text-yellow-900 mb-3 flex items-center gap-2">
                        <span className="text-xl">1️⃣</span> First Miss (Gentle Warning)
                      </h5>
                      <div className="grid grid-cols-2 gap-3">
                        {(streakSettings.penaltyType === 'money' || streakSettings.penaltyType === 'both') && (
                          <div>
                            <label className="block text-sm font-semibold text-yellow-800 mb-1">
                              Money: £{(streakSettings.firstMissPence / 100).toFixed(2)}
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={streakSettings.firstMissPence}
                              onChange={(e) => setStreakSettings(prev => ({ ...prev, firstMissPence: parseInt(e.target.value) || 0 }))}
                              className="w-full px-3 py-2 border-2 border-yellow-300 rounded-lg focus:border-yellow-500 focus:outline-none"
                            />
                          </div>
                        )}
                        {(streakSettings.penaltyType === 'stars' || streakSettings.penaltyType === 'both') && (
                          <div>
                            <label className="block text-sm font-semibold text-yellow-800 mb-1">
                              Stars: {streakSettings.firstMissStars} ⭐
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={streakSettings.firstMissStars}
                              onChange={(e) => setStreakSettings(prev => ({ ...prev, firstMissStars: parseInt(e.target.value) || 0 }))}
                              className="w-full px-3 py-2 border-2 border-yellow-300 rounded-lg focus:border-yellow-500 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Second Miss */}
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-300">
                      <h5 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
                        <span className="text-xl">2️⃣</span> Second Miss (Getting Serious)
                      </h5>
                      <div className="grid grid-cols-2 gap-3">
                        {(streakSettings.penaltyType === 'money' || streakSettings.penaltyType === 'both') && (
                          <div>
                            <label className="block text-sm font-semibold text-orange-800 mb-1">
                              Money: £{(streakSettings.secondMissPence / 100).toFixed(2)}
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="200"
                              value={streakSettings.secondMissPence}
                              onChange={(e) => setStreakSettings(prev => ({ ...prev, secondMissPence: parseInt(e.target.value) || 0 }))}
                              className="w-full px-3 py-2 border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:outline-none"
                            />
                          </div>
                        )}
                        {(streakSettings.penaltyType === 'stars' || streakSettings.penaltyType === 'both') && (
                          <div>
                            <label className="block text-sm font-semibold text-orange-800 mb-1">
                              Stars: {streakSettings.secondMissStars} ⭐
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={streakSettings.secondMissStars}
                              onChange={(e) => setStreakSettings(prev => ({ ...prev, secondMissStars: parseInt(e.target.value) || 0 }))}
                              className="w-full px-3 py-2 border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Third Miss */}
                    <div className="bg-red-50 p-4 rounded-lg border border-red-300">
                      <h5 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                        <span className="text-xl">3️⃣</span> Third Miss (Maximum Penalty)
                      </h5>
                      <div className="grid grid-cols-2 gap-3">
                        {(streakSettings.penaltyType === 'money' || streakSettings.penaltyType === 'both') && (
                          <div>
                            <label className="block text-sm font-semibold text-red-800 mb-1">
                              Money: £{(streakSettings.thirdMissPence / 100).toFixed(2)}
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="500"
                              value={streakSettings.thirdMissPence}
                              onChange={(e) => setStreakSettings(prev => ({ ...prev, thirdMissPence: parseInt(e.target.value) || 0 }))}
                              className="w-full px-3 py-2 border-2 border-red-300 rounded-lg focus:border-red-500 focus:outline-none"
                            />
                          </div>
                        )}
                        {(streakSettings.penaltyType === 'stars' || streakSettings.penaltyType === 'both') && (
                          <div>
                            <label className="block text-sm font-semibold text-red-800 mb-1">
                              Stars: {streakSettings.thirdMissStars} ⭐
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="50"
                              value={streakSettings.thirdMissStars}
                              onChange={(e) => setStreakSettings(prev => ({ ...prev, thirdMissStars: parseInt(e.target.value) || 0 }))}
                              className="w-full px-3 py-2 border-2 border-red-300 rounded-lg focus:border-red-500 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* Protection Tab */}
              {streakSettingsTab === 'protection' && (
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-[var(--radius-lg)] border-2 border-purple-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-2xl">
                    🛡️
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-purple-900">Minimum Balance Protection</h4>
                    <p className="text-sm text-purple-700">Kids always keep at least this much</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block font-semibold text-purple-900 mb-3">
                      Minimum Money Balance: £{(streakSettings.minBalancePence / 100).toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="500"
                      step="10"
                      value={streakSettings.minBalancePence}
                      onChange={(e) => setStreakSettings(prev => ({ ...prev, minBalancePence: parseInt(e.target.value) }))}
                      className="w-full h-3 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <div className="flex justify-between text-xs text-purple-600 mt-1">
                      <span>£0 (No protection)</span>
                      <span>£5.00</span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-purple-900 mb-3">
                      Minimum Stars Balance: {streakSettings.minBalanceStars} ⭐
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={streakSettings.minBalanceStars}
                      onChange={(e) => setStreakSettings(prev => ({ ...prev, minBalanceStars: parseInt(e.target.value) }))}
                      className="w-full h-3 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <div className="flex justify-between text-xs text-purple-600 mt-1">
                      <span>0 (No protection)</span>
                      <span>50 stars</span>
                    </div>
                  </div>

                  <p className="text-sm text-purple-700 bg-purple-100 p-3 rounded-lg">
                    💡 <strong>Protection Tip:</strong> Even with penalties, children will NEVER drop below these amounts. Set to £0/0⭐ if you want no minimum balance protection.
                    {streakSettings.minBalancePence > 0 && <><br/>💰 They'll always have at least £{(streakSettings.minBalancePence / 100).toFixed(2)} pocket money!</>}
                    {streakSettings.minBalanceStars > 0 && <><br/>⭐ They'll always have at least {streakSettings.minBalanceStars} stars!</>}
                  </p>
                </div>
              </div>
              )}
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowStreakSettingsModal(false)}
                className="flex-1 px-6 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] font-semibold hover:bg-[var(--background)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    // Validate all values before sending
                    const settingsToSave = {
                      streakProtectionDays: streakSettings.protectionDays,
                      bonusEnabled: streakSettings.bonusEnabled,
                      bonusDays: streakSettings.bonusDays,
                      bonusMoneyPence: streakSettings.bonusMoneyPence,
                      bonusStars: streakSettings.bonusStars,
                      bonusType: streakSettings.bonusType,
                      penaltyEnabled: streakSettings.penaltyEnabled,
                      firstMissPence: streakSettings.firstMissPence,
                      firstMissStars: streakSettings.firstMissStars,
                      secondMissPence: streakSettings.secondMissPence,
                      secondMissStars: streakSettings.secondMissStars,
                      thirdMissPence: streakSettings.thirdMissPence,
                      thirdMissStars: streakSettings.thirdMissStars,
                      penaltyType: streakSettings.penaltyType,
                      minBalancePence: streakSettings.minBalancePence,
                      minBalanceStars: streakSettings.minBalanceStars
                    }
                    console.log('Saving streak settings:', settingsToSave)
                    
                    // Update state optimistically BEFORE API call
                    if (family) {
                      setFamily((prev: Family | null) => {
                        if (!prev) return prev
                        return {
                          ...prev,
                          ...settingsToSave
                        }
                      })
                    }
                    // Also update streak settings state optimistically
                    setStreakSettings((prev: any) => ({
                      ...prev,
                      protectionDays: settingsToSave.streakProtectionDays ?? prev.protectionDays,
                      bonusEnabled: settingsToSave.bonusEnabled ?? prev.bonusEnabled,
                      bonusDays: settingsToSave.bonusDays ?? prev.bonusDays,
                      bonusMoneyPence: settingsToSave.bonusMoneyPence ?? prev.bonusMoneyPence,
                      bonusStars: settingsToSave.bonusStars ?? prev.bonusStars,
                      bonusType: settingsToSave.bonusType ?? prev.bonusType,
                      penaltyEnabled: settingsToSave.penaltyEnabled ?? prev.penaltyEnabled,
                      firstMissPence: settingsToSave.firstMissPence ?? prev.firstMissPence,
                      firstMissStars: settingsToSave.firstMissStars ?? prev.firstMissStars,
                      secondMissPence: settingsToSave.secondMissPence ?? prev.secondMissPence,
                      secondMissStars: settingsToSave.secondMissStars ?? prev.secondMissStars,
                      thirdMissPence: settingsToSave.thirdMissPence ?? prev.thirdMissPence,
                      thirdMissStars: settingsToSave.thirdMissStars ?? prev.thirdMissStars,
                      penaltyType: settingsToSave.penaltyType ?? prev.penaltyType,
                      minBalancePence: settingsToSave.minBalancePence ?? prev.minBalancePence,
                      minBalanceStars: settingsToSave.minBalanceStars ?? prev.minBalanceStars
                    }))
                    
                    // Save streak settings to backend
                    await apiClient.updateFamily(settingsToSave)
                    console.log('Streak settings saved')
                    
                    // WebSocket will update state automatically, but update here too for immediate feedback
                    setToast({ message: '🔥 Streak settings saved successfully!', type: 'success' })
                    setShowStreakSettingsModal(false)
                    // Don't wait for loadDashboard - WebSocket will handle the refresh
                  } catch (error: any) {
                    console.error('Failed to save streak settings:', error)
                    
                    // Handle different error types
                    let errorMessage = 'Failed to save streak settings. Please try again.'
                    
                    if (error?.response?.data?.error) {
                      // API error with error message
                      errorMessage = error.response.data.error
                    } else if (error?.response?.data) {
                      // API error but no error field, stringify the data
                      errorMessage = typeof error.response.data === 'string' 
                        ? error.response.data 
                        : JSON.stringify(error.response.data)
                    } else if (error?.message) {
                      // Standard error message
                      errorMessage = error.message
                    }
                    
                    console.error('Error details:', {
                      message: error?.message,
                      response: error?.response,
                      responseData: error?.response?.data,
                      status: error?.response?.status,
                      errorMessage
                    })
                    
                    setToast({ message: errorMessage, type: 'error' })
                  }
                }}
                className="flex-1 cb-button-primary flex items-center justify-center gap-2"
              >
                <span className="text-xl">🔥</span>
                Save Streak Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Holiday Mode Modal */}
      {showHolidayModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overscroll-contain">
          <div className="cb-card w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <div className="text-center mb-6">
              <h3 className="cb-heading-xl text-[var(--primary)] mb-2">🌴 Holiday Mode</h3>
              <p className="text-[var(--text-secondary)]">
                Pause chores and streaks when your family takes a break.
              </p>
            </div>

            <div className="space-y-6">
              {/* Family-wide Holiday Mode */}
              <div className="cb-card p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
                <h4 className="cb-heading-lg text-blue-600 mb-4 flex items-center gap-2">
                  🌍 Family Holiday Mode
                </h4>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Pause all chores, streaks, and penalties for the whole family.
                </p>

                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={holidayMode.familyHolidayMode}
                      onChange={(e) => {
                        const newValue = e.target.checked
                        setHolidayMode((prev) => ({
                          ...prev,
                          familyHolidayMode: newValue,
                          familyHolidayStartDate: newValue ? prev.familyHolidayStartDate : '',
                          familyHolidayEndDate: newValue ? prev.familyHolidayEndDate : '',
                        }))
                        // Don't update family state here - only update on save
                        // The optimistic window was already set when modal opened
                      }}
                      className="w-5 h-5 accent-[var(--primary)]"
                    />
                    <div>
                      <span className="font-semibold text-[var(--text-primary)]">Enable family holiday mode</span>
                      <p className="text-xs text-[var(--text-secondary)]">Every child will be paused.</p>
                    </div>
                  </label>

                  {holidayMode.familyHolidayMode && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Start Date</label>
                        <input
                          type="date"
                          value={holidayMode.familyHolidayStartDate}
                          onChange={(e) =>
                            setHolidayMode((prev) => ({
                              ...prev,
                              familyHolidayStartDate: e.target.value,
                            }))
                          }
                          className="w-full min-h-[44px] px-4 py-3 sm:py-2 text-base sm:text-sm border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none touch-manipulation"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">End Date (optional)</label>
                        <input
                          type="date"
                          value={holidayMode.familyHolidayEndDate}
                          onChange={(e) =>
                            setHolidayMode((prev) => ({
                              ...prev,
                              familyHolidayEndDate: e.target.value,
                            }))
                          }
                          className="w-full min-h-[44px] px-4 py-3 sm:py-2 text-base sm:text-sm border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none touch-manipulation"
                        />
                        <p className="text-xs text-[var(--text-secondary)] mt-1">Leave empty to end manually.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Individual Child Holiday Mode */}
              <div className="cb-card p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
                <h4 className="cb-heading-lg text-green-600 mb-4 flex items-center gap-2">
                  👧 Individual Child Holiday Mode
                </h4>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Pause chores for specific children while others continue as normal.
                </p>

                <div className="space-y-4">
                  {children.map((child: any) => (
                    <div key={child.id} className="bg-white rounded-lg p-4 border border-green-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold">
                            {child.nickname?.charAt(0)?.toUpperCase() || 'C'}
                          </div>
                          <div>
                            <h5 className="font-semibold text-[var(--text-primary)]">{child.nickname}</h5>
                            <p className="text-xs text-[var(--text-secondary)]">Child account</p>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={holidayMode.childHolidayModes[child.id]?.enabled || false}
                            onChange={(e) =>
                              setHolidayMode((prev) => ({
                                ...prev,
                                childHolidayModes: {
                                  ...prev.childHolidayModes,
                                  [child.id]: {
                                    ...prev.childHolidayModes[child.id],
                                    enabled: e.target.checked,
                                    startDate: e.target.checked
                                      ? prev.childHolidayModes[child.id]?.startDate || new Date().toISOString().split('T')[0]
                                      : '',
                                    endDate: e.target.checked ? prev.childHolidayModes[child.id]?.endDate || '' : '',
                                  },
                                },
                              }))
                            }
                            className="w-5 h-5 accent-green-500"
                          />
                          <span className="text-sm font-semibold">Holiday mode</span>
                          {holidayMode.childHolidayModes[child.id]?.enabled && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Active</span>
                          )}
                        </label>
                      </div>

                      {holidayMode.childHolidayModes[child.id]?.enabled && (
                        <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-sm text-green-700 mb-3">
                            This child is paused even if family holiday mode is off.
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Start Date (optional)</label>
                              <input
                                type="date"
                                value={holidayMode.childHolidayModes[child.id]?.startDate || ''}
                                onChange={(e) =>
                                  setHolidayMode((prev) => ({
                                    ...prev,
                                    childHolidayModes: {
                                      ...prev.childHolidayModes,
                                      [child.id]: {
                                        ...prev.childHolidayModes[child.id],
                                        startDate: e.target.value,
                                      },
                                    },
                                  }))
                                }
                                className="w-full px-3 py-2 border border-green-300 rounded-md focus:border-green-500 focus:outline-none text-sm"
                              />
                              <p className="text-xs text-green-600 mt-1">Leave empty to start right away.</p>
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">End Date (optional)</label>
                              <input
                                type="date"
                                value={holidayMode.childHolidayModes[child.id]?.endDate || ''}
                                onChange={(e) =>
                                  setHolidayMode((prev) => ({
                                    ...prev,
                                    childHolidayModes: {
                                      ...prev.childHolidayModes,
                                      [child.id]: {
                                        ...prev.childHolidayModes[child.id],
                                        endDate: e.target.value,
                                      },
                                    },
                                  }))
                                }
                                className="w-full px-3 py-2 border border-green-300 rounded-md focus:border-green-500 focus:outline-none text-sm"
                              />
                              <p className="text-xs text-green-600 mt-1">Leave empty to end manually.</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Holiday Mode Info */}
              <div className="cb-card p-6 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200">
                <h4 className="cb-heading-lg text-orange-600 mb-4 flex items-center gap-2">
                  ℹ️ What happens during holiday mode?
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h5 className="font-semibold text-orange-700 mb-2">Paused while active:</h5>
                    <ul className="space-y-1 text-[var(--text-secondary)]">
                      <li>• New streak days and bonuses</li>
                      <li>• Penalties and deductions</li>
                      <li>• Streak break checks</li>
                      <li>• Mission penalties</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-orange-700 mb-2">Still available:</h5>
                    <ul className="space-y-1 text-[var(--text-secondary)]">
                      <li>• Existing wallet balances</li>
                      <li>• Rewards shop</li>
                      <li>• Dashboard access</li>
                      <li>• Parent controls</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                type="button"
                onClick={() => {
                  // Restore holiday mode state from family data when canceling
                  if (family) {
                    setHolidayMode(prev => ({
                      ...prev,
                      familyHolidayMode: family.holidayMode ?? false,
                      familyHolidayStartDate: family.holidayStartDate
                        ? new Date(family.holidayStartDate).toISOString().split('T')[0]
                        : '',
                      familyHolidayEndDate: family.holidayEndDate
                        ? new Date(family.holidayEndDate).toISOString().split('T')[0]
                        : '',
                    }))
                  }
                  setShowHolidayModal(false)
                  // Clear optimistic window on cancel so next refresh updates normally
                  setHolidayOptimisticUntil(0)
                }}
                className="flex-1 px-6 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] font-semibold hover:bg-[var(--background)] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={uiBusyRef.current}
                onClick={debounce(async () => {
                  if (uiBusyRef.current) return
                  uiBusyRef.current = true
                  try {
                    const updateData = {
                      holidayMode: holidayMode.familyHolidayMode,
                      holidayStartDate: holidayMode.familyHolidayMode ? holidayMode.familyHolidayStartDate || undefined : null,
                      holidayEndDate: holidayMode.familyHolidayMode ? holidayMode.familyHolidayEndDate || undefined : null,
                    }
                    
                    console.log('💾 Saving holiday settings:', updateData)
                    
                    // Update state optimistically BEFORE API call
                    setFamily((prev) => {
                      if (!prev) return prev
                      console.log('🔄 Optimistically updating family state:', {
                        holidayMode: holidayMode.familyHolidayMode,
                        holidayStartDate: holidayMode.familyHolidayMode ? holidayMode.familyHolidayStartDate || null : null,
                        holidayEndDate: holidayMode.familyHolidayMode ? holidayMode.familyHolidayEndDate || null : null,
                      })
                      return {
                        ...prev,
                        holidayMode: holidayMode.familyHolidayMode,
                        holidayStartDate: holidayMode.familyHolidayMode ? holidayMode.familyHolidayStartDate || null : null,
                        holidayEndDate: holidayMode.familyHolidayMode ? holidayMode.familyHolidayEndDate || null : null,
                      }
                    })
                    
                    // Set optimistic window BEFORE API call to prevent loadDashboard from overwriting
                    setHolidayOptimisticUntil(Date.now() + 60000) // 60 seconds protection
                    
                    // Save to API - WebSocket will broadcast to all dashboards
                    await apiClient.updateFamily(updateData)
                    
                    setShowHolidayModal(false)
                    setToast({ message: 'Holiday settings saved', type: 'success' })
                    // Don't wait for loadDashboard - WebSocket will handle the refresh
                  } catch (error: any) {
                    console.error('Failed to save holiday mode settings:', error)
                    // Revert optimistic update on error
                    loadDashboard()
                    setToast({ message: error.message || 'Failed to save holiday settings', type: 'error' })
                  } finally {
                    uiBusyRef.current = false
                  }
                })}
                className="flex-1 cb-button-primary flex items-center justify-center gap-2"
              >
                <span className="text-xl">🌴</span>
                Save Holiday Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overscroll-contain">
          <div className="cb-card w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <h3 className="cb-heading-lg text-center mb-2 text-[var(--primary)]">➕ Invite to Family</h3>
            <div className="flex justify-center gap-2 mb-4">
              <button type="button" onClick={() => setInviteType('child')} className={`px-3 py-1 rounded-full text-sm border ${inviteType==='child' ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-[var(--card-border)]'}`}>Child</button>
              <button type="button" onClick={() => setInviteType('adult')} className={`px-3 py-1 rounded-full text-sm border ${inviteType==='adult' ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-[var(--card-border)]'}`}>Parent/Relative</button>
            </div>
            <form onSubmit={handleInvite} className="space-y-5">
              {inviteType === 'adult' ? (
                <>
                  <div>
                    <label className="block font-semibold text-[var(--text-primary)] mb-2">Email <span className="text-red-500">*</span></label>
                    <input
                      name="email"
                      type="email"
                      value={inviteData.email}
                      onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all"
                      placeholder="parent@example.com"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[var(--text-primary)] mb-2">Name (optional)</label>
                      <input
                        value={adultName}
                        onChange={(e) => setAdultName(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all"
                        placeholder="e.g., Sam Jones"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[var(--text-primary)] mb-2">Role</label>
                      <select
                        value={adultRole}
                        onChange={(e) => setAdultRole(e.target.value as any)}
                        className="w-full px-3 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none"
                      >
                        <option value="parent_co_parent">Co‑parent</option>
                        <option value="parent_viewer">Parent (viewer)</option>
                        <option value="grandparent">Grandparent</option>
                        <option value="uncle_aunt">Uncle/Aunt</option>
                        <option value="relative_contributor">Contributor</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <>
              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-2">Email (Optional)</label>
                <input
                  name="email"
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all"
                  placeholder="child@example.com (optional)"
                />
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Some children don't have email addresses - that's okay!
                </p>
              </div>
            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-2">Name <span className="text-red-500">*</span></label>
              <input
                name="realName"
                required
                value={inviteData.realName}
                onChange={(e) => handleRealNameChange(e.target.value)}
                className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all"
                placeholder="e.g., Ellie Johnson"
              />
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                This is the child's full name for family records
              </p>
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-2">Nickname (Optional)</label>
              <input
                name="nickname"
                value={inviteData.nickname}
                onChange={(e) => handleNicknameChange(e.target.value)}
                className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all"
                placeholder="e.g., Super Ellie"
              />
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Auto-filled from first name, but you can customize it
              </p>
            </div>
              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-2">
                  Birthday <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">Month (Optional)</label>
                    <select
                      value={inviteData.birthMonth || ''}
                      onChange={(e) => setInviteData(prev => ({ ...prev, birthMonth: e.target.value ? parseInt(e.target.value) : null }))}
                      className="w-full px-3 py-2 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none"
                    >
                      <option value="">Select month</option>
                      <option value="1">January</option>
                      <option value="2">February</option>
                      <option value="3">March</option>
                      <option value="4">April</option>
                      <option value="5">May</option>
                      <option value="6">June</option>
                      <option value="7">July</option>
                      <option value="8">August</option>
                      <option value="9">September</option>
                      <option value="10">October</option>
                      <option value="11">November</option>
                      <option value="12">December</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">Year <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      placeholder="e.g., 2015"
                      value={inviteData.birthYear || ''}
                      onChange={(e) => setInviteData(prev => ({ ...prev, birthYear: e.target.value ? parseInt(e.target.value) : null }))}
                      className="w-full px-3 py-2 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none"
                      min="2000"
                      max="2025"
                      required
                    />
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-2">
                  Year is required to calculate age group. Month is optional for more precise age calculation.
                </p>
              </div>
              </>
              )}

              {inviteMessage && (
                <div className={`p-4 rounded-[var(--radius-md)] text-sm font-semibold ${
                  inviteMessage.includes('✅')
                    ? 'bg-[var(--success)]/10 text-[var(--success)] border-2 border-[var(--success)]/30'
                    : 'bg-red-50 text-red-600 border-2 border-red-200'
                }`}>
                  {inviteMessage}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false)
                    setInviteMessage('')
                    setInviteType('child')
                    setAdultName('')
                    setInviteData({ email: '', realName: '', nickname: '', birthYear: null, birthMonth: null })
                  }}
                  className="flex-1 px-6 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] font-semibold hover:bg-[var(--background)] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="flex-1 cb-button-primary disabled:opacity-50"
                >
                  {inviteLoading ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Family Modal */}
      {showFamilyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overscroll-contain">
          <div className="cb-card w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <h3 className="cb-heading-lg text-center mb-6 text-[var(--primary)]">✏️ Edit Family Name</h3>
            <form onSubmit={handleUpdateFamily} className="space-y-5">
              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-2">Family name</label>
                <input
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all"
                  placeholder="The Sparkles"
                  disabled={familyLoading}
                />
              </div>
              {familyMessage && (
                <div className={`p-4 rounded-[var(--radius-md)] text-sm font-semibold ${
                  familyMessage.includes('✅')
                    ? 'bg-[var(--success)]/10 text-[var(--success)] border-2 border-[var(--success)]/30'
                    : 'bg-red-50 text-red-600 border-2 border-red-200'
                }`}>
                  {familyMessage}
                </div>
              )}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowFamilyModal(false)
                    setFamilyMessage('')
                    setFamilyName(family?.nameCipher || '')
                  }}
                  className="flex-1 px-6 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] font-semibold hover:bg-[var(--background)] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={familyLoading || !familyName}
                  className="flex-1 cb-button-primary disabled:opacity-50"
                >
                  {familyLoading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chore Library Modal */}
      {showChoreLibraryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="cb-card w-full max-w-4xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="cb-heading-lg text-[var(--primary)]">📚 Chore Library</h3>
              <button
                onClick={() => setShowChoreLibraryModal(false)}
                className="text-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background)] text-[var(--text-secondary)]'
                }`}
              >
                ✨ All
              </button>
              {Object.entries(categoryLabels).map(([key, { label, icon }]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === key
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--background)] text-[var(--text-secondary)]'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            {/* Chore Templates Grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[60vh] overflow-y-auto p-1">
              {(() => {
                const filteredTemplates = choreTemplates.filter(template => {
                  // Filter by category
                  const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
                  
                  // Exclude chores that already exist (case-insensitive title comparison)
                  const alreadyExists = chores.some(chore => 
                    chore.title.toLowerCase().trim() === template.title.toLowerCase().trim()
                  )
                  
                  return matchesCategory && !alreadyExists
                })

                if (filteredTemplates.length === 0) {
                  return (
                    <div className="col-span-full text-center py-12">
                      <div className="text-6xl mb-4">✅</div>
                      <h4 className="font-bold text-[var(--text-primary)] mb-2">All set!</h4>
                      <p className="text-[var(--text-secondary)]">
                        You've already created all the chores in this category.
                        <br />
                        Try a different category or create a custom chore below!
                      </p>
                    </div>
                  )
                }

                return filteredTemplates.map((template) => {
                  const weeklyBudgetPence = budget?.maxBudgetPence || 2000
                  const budgetToUse = budget?.budgetPeriod === 'monthly' ? weeklyBudgetPence / 4 : weeklyBudgetPence
                  const suggestedReward = calculateSuggestedReward(template, budgetToUse)

                  return (
                    <button
                      key={template.id}
                      onClick={() => handleSelectChoreTemplate(template)}
                      className="text-left p-4 bg-white border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] hover:border-[var(--primary)] hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <span className="text-3xl">{template.icon}</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1">
                            {template.title}
                          </h4>
                          <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                            {template.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs cb-chip bg-[var(--success)]/10 text-[var(--success)]">
                          💰 £{(suggestedReward / 100).toFixed(2)}
                        </span>
                        <span className="text-xs cb-chip bg-[var(--secondary)]/10 text-[var(--secondary)]">
                          {template.frequency === 'daily' ? '📅 Daily' : template.frequency === 'weekly' ? '📆 Weekly' : '🎯 Once'}
                        </span>
                        {template.ageGroup && (
                          <span className="text-xs cb-chip bg-purple-50 text-purple-700">
                            {template.ageGroup}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })
              })()}
            </div>

            {/* Custom Chore Option */}
            <div className="mt-6 p-4 bg-gradient-to-r from-[var(--primary)]/10 to-[var(--secondary)]/10 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--primary)]/30">
              <button
                onClick={() => {
                  setShowChoreLibraryModal(false)
                  setShowCreateChoreModal(true)
                }}
                className="w-full text-center"
              >
                <div className="text-4xl mb-2">➕</div>
                <h4 className="font-bold text-[var(--text-primary)] mb-1">Create Custom Chore</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  Build your own chore from scratch
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Chore Modal */}
      {showCreateChoreModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="cb-card w-full max-w-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="cb-heading-lg text-[var(--primary)]">➕ Create New Chore</h3>
              <button
                onClick={() => setShowChoreLibraryModal(true)}
                className="text-sm text-[var(--secondary)] hover:underline"
              >
                ← Back to Library
              </button>
            </div>
            <form onSubmit={handleCreateChore} className="space-y-5">
              {/* Chore Details */}
              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-2">Chore title *</label>
                <input
                  value={newChore.title}
                  onChange={(e) => setNewChore(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all"
                  placeholder="Make your bed"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-2">Description</label>
                <textarea
                  value={newChore.description}
                  onChange={(e) => setNewChore(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all resize-none"
                  rows={3}
                  placeholder="Optional details..."
                />
              </div>
              
              {/* Frequency and Proof Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[var(--text-primary)] mb-2">Frequency</label>
                  <select
                    value={newChore.frequency}
                    onChange={(e) => setNewChore(prev => ({ ...prev, frequency: e.target.value as any }))}
                    className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="once">One-time</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-primary)] mb-2">Completion Proof</label>
                  <select
                    value={newChore.proof}
                    onChange={(e) => setNewChore(prev => ({ ...prev, proof: e.target.value as any }))}
                    className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all"
                  >
                    <option value="none">Trust-based (No proof needed)</option>
                    <option value="note">Ask for explanation note</option>
                  </select>
                </div>
              </div>

              {/* Reward and Stars Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[var(--text-primary)] mb-2">Reward (£)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={(newChore.baseRewardPence / 100).toFixed(2)}
                    onChange={(e) => setNewChore(prev => ({ ...prev, baseRewardPence: Math.round(parseFloat(e.target.value) * 100) }))}
                    className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all"
                    placeholder="0.50"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-primary)] mb-2">Stars (⭐)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={newChore.starsOverride || Math.max(1, Math.floor(newChore.baseRewardPence / 10))}
                    onChange={(e) => setNewChore(prev => ({ ...prev, starsOverride: parseInt(e.target.value) || null }))}
                    className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all"
                    placeholder="1"
                  />
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Auto-calculated: {Math.max(1, Math.floor(newChore.baseRewardPence / 10))} stars (1 per £0.10)
                  </p>
                </div>
              </div>

              {/* Assignment Section */}
              <div className="border-t-2 border-[var(--card-border)] pt-5">
                <h4 className="font-bold text-[var(--text-primary)] mb-3">👥 Assign to Children</h4>
                {children.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)] italic">
                    No children in family yet. Invite children to assign chores!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {uniqueChildren.map((child: any) => (
                      <label
                        key={child.id}
                        className="flex items-center gap-3 p-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] hover:border-[var(--primary)] transition-all cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={choreAssignments.childIds.includes(child.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setChoreAssignments(prev => ({
                                ...prev,
                                childIds: [...prev.childIds, child.id]
                              }))
                            } else {
                              setChoreAssignments(prev => ({
                                ...prev,
                                childIds: prev.childIds.filter(id => id !== child.id)
                              }))
                            }
                          }}
                          className="w-5 h-5 text-[var(--primary)] rounded focus:ring-2 focus:ring-[var(--primary)]"
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-[var(--text-primary)]">{child.nickname}</div>
                          {child.ageGroup && (
                            <div className="text-xs text-[var(--text-secondary)]">Age: {child.ageGroup}</div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Bidding Toggle */}
              {choreAssignments.childIds.length > 1 && (
                <div className="border-t-2 border-[var(--card-border)] pt-5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={choreAssignments.biddingEnabled}
                      onChange={(e) => setChoreAssignments(prev => ({ ...prev, biddingEnabled: e.target.checked }))}
                      className="w-5 h-5 mt-1 text-[var(--primary)] rounded focus:ring-2 focus:ring-[var(--primary)]"
                    />
                    <div>
                      <div className="font-bold text-[var(--text-primary)]">⚔️ Enable Sibling Rivalry (Underbid)</div>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">
                        Allow siblings to compete for this chore by bidding lower amounts
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateChoreModal(false)
                    setNewChore({
                      title: '',
                      description: '',
                      frequency: 'daily',
                      proof: 'none',
                      baseRewardPence: 50,
                      starsOverride: null
                    })
                    setChoreAssignments({
                      childIds: [],
                      biddingEnabled: false
                    })
                  }}
                  className="flex-1 px-6 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] font-semibold hover:bg-[var(--background)] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] flex-1 cb-button-primary touch-manipulation"
                >
                  Create Chore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Chore Modal */}
      {showEditChoreModal && selectedChore && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="cb-card w-full max-w-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="cb-heading-lg text-[var(--primary)]">✏️ Edit Chore</h3>
              <button
                onClick={() => {
                  setShowEditChoreModal(false)
                  setSelectedChore(null)
                  setChoreAssignments({ childIds: [], biddingEnabled: false })
                }}
                className="text-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                // 1. Update the chore details
                await apiClient.updateChore(selectedChore.id, {
                  title: selectedChore.title,
                  description: selectedChore.description,
                  frequency: selectedChore.frequency,
                  proof: selectedChore.proof,
                  baseRewardPence: Number(selectedChore.baseRewardPence),
                  starsOverride: selectedChore.starsOverride ? Number(selectedChore.starsOverride) : undefined,
                  active: selectedChore.active
                })
                
                // 2. Get existing assignments for this chore
                const existingAssignments = assignments.filter((a: any) => a.choreId === selectedChore.id)
                const existingChildIds = existingAssignments.map((a: any) => a.childId).filter(Boolean)
                
                // 3. Determine which assignments to add/remove
                const childIdsToAdd = choreAssignments.childIds.filter(id => !existingChildIds.includes(id))
                const childIdsToRemove = existingChildIds.filter(id => !choreAssignments.childIds.includes(id))
                
                // 4. Remove old assignments
                for (const assignment of existingAssignments) {
                  if (assignment.childId && childIdsToRemove.includes(assignment.childId)) {
                    await apiClient.deleteAssignment(assignment.id)
                  }
                }
                
                // 5. Add new assignments
                for (const childId of childIdsToAdd) {
                  await apiClient.createAssignment({
                    choreId: selectedChore.id,
                    childId,
                    biddingEnabled: choreAssignments.biddingEnabled && choreAssignments.childIds.length > 1
                  })
                }
                
                setToast({ message: '✅ Chore updated successfully!', type: 'success' })
                setShowEditChoreModal(false)
                setSelectedChore(null)
                setChoreAssignments({ childIds: [], biddingEnabled: false })
                
                // Reload to show changes
                await new Promise(resolve => setTimeout(resolve, 300))
                await loadDashboard()
                
                // Notify child dashboards of the update
                notifyChildDashboards()
              } catch (error) {
                console.error('Failed to update chore:', error)
                setToast({ message: 'Failed to update chore. Please try again.', type: 'error' })
              }
            }} className="space-y-5">
              {/* Chore Details */}
              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-2">Chore title *</label>
                <input
                  value={selectedChore.title}
                  onChange={(e) => setSelectedChore({ ...selectedChore, title: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all"
                  placeholder="Make your bed"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-2">Description</label>
                <textarea
                  value={selectedChore.description || ''}
                  onChange={(e) => setSelectedChore({ ...selectedChore, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all resize-none"
                  rows={3}
                  placeholder="Optional details..."
                />
              </div>
              
              {/* Frequency and Proof Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[var(--text-primary)] mb-2">Frequency</label>
                  <select
                    value={selectedChore.frequency}
                    onChange={(e) => setSelectedChore({ ...selectedChore, frequency: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="once">One-time</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-primary)] mb-2">Completion Proof</label>
                  <select
                    value={selectedChore.proof}
                    onChange={(e) => setSelectedChore({ ...selectedChore, proof: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all"
                  >
                    <option value="none">Trust-based (No proof needed)</option>
                    <option value="note">Ask for explanation note</option>
                  </select>
                </div>
              </div>

              {/* Reward and Stars Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[var(--text-primary)] mb-2">Reward (£)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={(selectedChore.baseRewardPence / 100).toFixed(2)}
                    onChange={(e) => setSelectedChore({ ...selectedChore, baseRewardPence: Math.round(parseFloat(e.target.value) * 100) })}
                    className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all"
                    placeholder="0.50"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-primary)] mb-2">Stars (⭐)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={selectedChore.starsOverride || Math.max(1, Math.floor(selectedChore.baseRewardPence / 10))}
                    onChange={(e) => setSelectedChore({ ...selectedChore, starsOverride: parseInt(e.target.value) || null })}
                    className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all"
                    placeholder="1"
                  />
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Auto-calculated: {Math.max(1, Math.floor(selectedChore.baseRewardPence / 10))} stars (1 per £0.10)
                  </p>
                </div>
              </div>

              {/* Assignment Section */}
              <div className="border-t-2 border-[var(--card-border)] pt-5">
                <h4 className="font-bold text-[var(--text-primary)] mb-3">👥 Assigned to Children</h4>
                {children.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)] italic">
                    No children in family yet. Invite children to assign chores!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {uniqueChildren.map((child: any) => (
                      <label
                        key={child.id}
                        className="flex items-center gap-3 p-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] hover:border-[var(--primary)] transition-all cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={choreAssignments.childIds.includes(child.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setChoreAssignments(prev => ({
                                ...prev,
                                childIds: [...prev.childIds, child.id]
                              }))
                            } else {
                              setChoreAssignments(prev => ({
                                ...prev,
                                childIds: prev.childIds.filter(id => id !== child.id)
                              }))
                            }
                          }}
                          className="w-5 h-5 text-[var(--primary)] rounded focus:ring-2 focus:ring-[var(--primary)]"
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-[var(--text-primary)]">{child.nickname}</div>
                          {child.ageGroup && (
                            <div className="text-xs text-[var(--text-secondary)]">Age: {child.ageGroup}</div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Bidding Toggle */}
              {choreAssignments.childIds.length > 1 && (
                <div className="border-t-2 border-[var(--card-border)] pt-5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={choreAssignments.biddingEnabled}
                      onChange={(e) => setChoreAssignments(prev => ({ ...prev, biddingEnabled: e.target.checked }))}
                      className="w-5 h-5 mt-1 text-[var(--primary)] rounded focus:ring-2 focus:ring-[var(--primary)]"
                    />
                    <div>
                      <div className="font-bold text-[var(--text-primary)]">⚔️ Enable Sibling Rivalry (Underbid)</div>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">
                        Allow siblings to compete for this chore by bidding lower amounts
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Active Toggle */}
              <div className="border-t-2 border-[var(--card-border)] pt-5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedChore.active !== false}
                    onChange={(e) => setSelectedChore({ ...selectedChore, active: e.target.checked })}
                    className="w-5 h-5 mt-1 text-[var(--primary)] rounded focus:ring-2 focus:ring-[var(--primary)]"
                  />
                  <div>
                    <div className="font-bold text-[var(--text-primary)]">✅ Active</div>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      Inactive chores won't appear in children's task lists
                    </p>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditChoreModal(false)
                    setSelectedChore(null)
                  }}
                  className="flex-1 px-6 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] font-semibold hover:bg-[var(--background)] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] flex-1 cb-button-primary touch-manipulation"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Child Profile Modal */}
      {showChildProfileModal && selectedChild && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="cb-card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="cb-heading-lg text-[var(--primary)]">👤 {selectedChild.nickname}'s Profile</h3>
              <button
                onClick={() => {
                  setShowChildProfileModal(false)
                  setSelectedChild(null)
                  setNewJoinCode(null)
                  setChildProfileTab('info')
                }}
                className="text-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            {/* Profile Header */}
            <div className="flex items-center gap-4 p-6 bg-gradient-to-br from-[var(--primary)]/10 to-[var(--secondary)]/10 rounded-[var(--radius-lg)] mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-full flex items-center justify-center text-4xl">
                {selectedChild.nickname.charAt(0)}
              </div>
              <div className="flex-1">
                <h4 className="text-2xl font-bold text-[var(--text-primary)]">{selectedChild.nickname}</h4>
                <p className="text-[var(--text-secondary)]">{selectedChild.ageGroup} years</p>
                {selectedChild.gender && (
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Gender: {selectedChild.gender.charAt(0).toUpperCase() + selectedChild.gender.slice(1)}
                  </p>
                )}
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-[var(--card-border)] mb-6">
              <button 
                onClick={() => setChildProfileTab('info')} 
                className={`px-4 py-3 font-semibold text-sm transition-all ${
                  childProfileTab === 'info' 
                    ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                📝 Basic Info
              </button>
              <button 
                onClick={() => setChildProfileTab('device')} 
                className={`px-4 py-3 font-semibold text-sm transition-all ${
                  childProfileTab === 'device' 
                    ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                📱 Device Access
              </button>
              <button 
                onClick={() => setChildProfileTab('stats')} 
                className={`px-4 py-3 font-semibold text-sm transition-all ${
                  childProfileTab === 'stats' 
                    ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                📊 Stats
              </button>
              <button 
                onClick={() => setChildProfileTab('management')} 
                className={`px-4 py-3 font-semibold text-sm transition-all ${
                  childProfileTab === 'management' 
                    ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                🔧 Management
              </button>
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px] overflow-y-auto">
              {childProfileTab === 'info' && (
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] mb-4">📝 Basic Information</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Nickname</label>
                    <input
                      type="text"
                      value={selectedChild.nickname}
                      onChange={(e) => setSelectedChild({ ...selectedChild, nickname: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Age Group</label>
                    <div className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] bg-gray-50 text-gray-600">
                      {selectedChild.ageGroup || 'Not set'} 
                      {selectedChild.birthYear ? 
                        (selectedChild.birthMonth ? 
                          ' (Auto-calculated from birthday)' : 
                          ' (Auto-calculated from birth year)') : 
                        ' (Set birth year to auto-calculate)'
                      }
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      Age group is automatically calculated from birth year (month optional for precision)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Gender</label>
                    <select
                      value={selectedChild.gender || 'other'}
                      onChange={(e) => setSelectedChild({ ...selectedChild, gender: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other/Prefer not to say</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Email Address (Optional)</label>
                    <input
                      type="email"
                      value={selectedChild.email || ''}
                      onChange={(e) => setSelectedChild({ ...selectedChild, email: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none"
                      placeholder="child@example.com (optional)"
                    />
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      Optional - can be added later if the child gets an email address
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                      Birthday <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[var(--text-secondary)] mb-1">Month (Optional)</label>
                        <select
                          value={selectedChild.birthMonth || ''}
                          onChange={(e) => setSelectedChild({ ...selectedChild, birthMonth: e.target.value ? parseInt(e.target.value) : null })}
                          className="w-full px-3 py-2 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none"
                        >
                          <option value="">Select month</option>
                          <option value="1">January</option>
                          <option value="2">February</option>
                          <option value="3">March</option>
                          <option value="4">April</option>
                          <option value="5">May</option>
                          <option value="6">June</option>
                          <option value="7">July</option>
                          <option value="8">August</option>
                          <option value="9">September</option>
                          <option value="10">October</option>
                          <option value="11">November</option>
                          <option value="12">December</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-secondary)] mb-1">Year <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          placeholder="e.g., 2015"
                          value={selectedChild.birthYear || ''}
                          onChange={(e) => setSelectedChild({ ...selectedChild, birthYear: e.target.value ? parseInt(e.target.value) : null })}
                          className="w-full px-3 py-2 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none"
                          min="2000"
                          max="2025"
                          required
                        />
                      </div>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-2">
                      Year is required to calculate age group. Month is optional for more precise age calculation.
                    </p>
                  </div>
                </div>
              </div>
                </div>
              )}

              {childProfileTab === 'device' && (
                <div className="space-y-6">
                  {/* Device Access */}
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] mb-4">📱 Device Access</h4>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Generate a new join code if your child needs to access ChoreBlimey from another device (tablet, phone, etc.)
                </p>
                
                {newJoinCode ? (
                  <div className="p-6 bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-300 rounded-[var(--radius-lg)]">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">✅</span>
                      <h5 className="font-bold text-green-800">New Code Generated!</h5>
                    </div>
                    <div className="bg-white p-4 rounded-lg mb-3">
                      <div className="font-mono text-4xl font-bold text-[var(--primary)] text-center tracking-wider">
                        {newJoinCode}
                      </div>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mb-4">
                      Your child can use this code on their new device at <strong>http://localhost:1500/child-join</strong>
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newJoinCode)
                        setToast({ message: '📋 Code copied to clipboard!', type: 'info' })
                      }}
                      className="w-full cb-button-primary"
                    >
                      📋 Copy Code
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      setGeneratingCode(true)
                      try {
                        const response = await apiClient.generateChildJoinCode({
                          nickname: selectedChild.nickname,
                          ageGroup: selectedChild.ageGroup || '5-8', // Default for join code
                          gender: selectedChild.gender || 'other'
                        })
                        setNewJoinCode(response.joinCode.code)
                        setToast({ message: '✅ New join code generated!', type: 'success' })
                        // Refresh join codes list immediately
                        const joinCodesResponse = await apiClient.getFamilyJoinCodes()
                        setJoinCodes(joinCodesResponse.joinCodes || [])
                      } catch (error) {
                        console.error('Failed to generate join code:', error)
                        setToast({ message: 'Failed to generate code. Please try again.', type: 'error' })
                      } finally {
                        setGeneratingCode(false)
                      }
                    }}
                    disabled={generatingCode}
                    className="w-full px-6 py-3 bg-gradient-to-r from-[var(--secondary)] to-[var(--primary)] text-white rounded-[var(--radius-lg)] font-bold hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {generatingCode ? '⏳ Generating...' : '🔄 Generate New Join Code'}
                  </button>
                )}
                  </div>
                </div>
              )}

              {childProfileTab === 'stats' && (
                <div className="space-y-6">
                  {/* Stats */}
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] mb-4">📊 Stats</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-br from-[var(--success)]/10 to-green-100 rounded-[var(--radius-lg)] border-2 border-[var(--success)]/30">
                    <div className="text-3xl font-bold text-[var(--success)] mb-1">
                      {wallets.find((w: any) => w.childId === selectedChild.id)?.stars || 0}⭐
                    </div>
                    <div className="text-sm text-[var(--text-secondary)]">Total Stars</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-[var(--primary)]/10 to-orange-100 rounded-[var(--radius-lg)] border-2 border-[var(--primary)]/30">
                    <div className="text-3xl font-bold text-[var(--primary)] mb-1">
                      £{((wallets.find((w: any) => w.childId === selectedChild.id)?.balancePence || 0) / 100).toFixed(2)}
                    </div>
                    <div className="text-sm text-[var(--text-secondary)]">Wallet Balance</div>
                  </div>
                </div>
                  </div>
                </div>
              )}

              {childProfileTab === 'management' && (
                <div className="space-y-6">
                  {/* Management Actions */}
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] mb-4">🔧 Account Management</h4>
                    <p className="text-sm text-[var(--text-secondary)] mb-6">
                      Manage your child's account settings and access.
                    </p>
                    
                    <div className="space-y-4">
                      {/* Pause Child Button */}
                      <div className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-[var(--radius-lg)]">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl">{selectedChild.paused ? '▶️' : '⏸️'}</span>
                          <div>
                            <h5 className="font-bold text-[var(--text-primary)]">
                              {selectedChild.paused ? 'Account is Paused' : 'Temporarily Pause Account'}
                            </h5>
                            <p className="text-sm text-[var(--text-secondary)]">
                              {selectedChild.paused 
                                ? 'This child\'s account is currently paused. They cannot access ChoreBlimey or complete chores.'
                                : 'Temporarily disable your child\'s access to ChoreBlimey'
                              }
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            const action = selectedChild.paused ? 'unpause' : 'pause'
                            const actionText = selectedChild.paused ? 'unpause' : 'pause'
                            
                            if (confirm(`${selectedChild.paused ? '▶️' : '⏸️'} ${actionText.charAt(0).toUpperCase() + actionText.slice(1)} ${selectedChild.nickname}'s account?\n\n${
                              selectedChild.paused 
                                ? 'This will restore their access to ChoreBlimey and allow them to complete chores again.'
                                : 'This will temporarily disable their access to ChoreBlimey. They won\'t be able to complete chores or earn rewards until you reactivate their account.'
                            }\n\nYou can ${actionText} their account anytime from this page.`)) {
                              try {
                                const response = await apiClient.toggleChildPause(selectedChild.id)
                                
                                // Update the selected child state
                                setSelectedChild({ ...selectedChild, paused: response.paused })
                                
                                setToast({ 
                                  message: `✅ Account ${response.paused ? 'paused' : 'unpaused'} successfully!`, 
                                  type: 'success' 
                                })
                                
                                // Reload dashboard to reflect changes
                                await loadDashboard()
                              } catch (error) {
                                console.error('Failed to toggle pause status:', error)
                                setToast({ message: 'Failed to toggle pause status. Please try again.', type: 'error' })
                              }
                            }
                          }}
                          className={`w-full px-4 py-3 text-white rounded-lg font-semibold transition-colors text-sm ${
                            selectedChild.paused 
                              ? 'bg-green-500 hover:bg-green-600' 
                              : 'bg-yellow-500 hover:bg-yellow-600'
                          }`}
                        >
                          {selectedChild.paused ? '▶️ Unpause Account' : '⏸️ Pause Account'}
                        </button>
                      </div>

                      {/* Remove Child Button */}
                      <div className="p-4 bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-200 rounded-[var(--radius-lg)]">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl">👋</span>
                          <div>
                            <h5 className="font-bold text-[var(--text-primary)]">Remove Child from Family</h5>
                            <p className="text-sm text-[var(--text-secondary)]">
                              Permanently remove this child from your family account
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            console.log('Remove Child button clicked for:', selectedChild.nickname, 'ID:', selectedChild.id)
                            if (confirm(`👋 Remove ${selectedChild.nickname} from your family?\n\nThis will permanently delete their account and ALL their data including:\n• All chore completions and history\n• All earned stars and wallet balance\n• All progress and achievements\n\nThis action cannot be undone!\n\nType "${selectedChild.nickname}" to confirm:`)) {
                              const confirmation = prompt(`Type "${selectedChild.nickname}" to confirm removal:`)
                              console.log('Confirmation entered:', confirmation)
                              if (confirmation === selectedChild.nickname) {
                                try {
                                  console.log('Calling apiClient.removeChild with ID:', selectedChild.id)
                                  await apiClient.removeChild(selectedChild.id)
                                  console.log('Child removed successfully')
                                  setToast({ message: '👋 Child removed successfully!', type: 'success' })
                                  setShowChildProfileModal(false)
                                  setSelectedChild(null)
                                  await loadDashboard()
                                } catch (error) {
                                  console.error('Failed to remove child:', error)
                                  setToast({ message: 'Failed to remove child. Please try again.', type: 'error' })
                                }
                              } else {
                                console.log('Confirmation failed - name did not match')
                                setToast({ message: '❌ Removal cancelled - name did not match', type: 'error' })
                              }
                            } else {
                              console.log('User cancelled the removal')
                            }
                          }}
                          className="w-full px-4 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors text-sm"
                        >
                          👋 Remove Child
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mt-8 pt-6 border-t-2 border-[var(--card-border)]">
              <button
                onClick={() => {
                  setShowChildProfileModal(false)
                  setSelectedChild(null)
                  setNewJoinCode(null)
                  setChildProfileTab('info')
                }}
                className="flex-1 px-6 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] font-semibold hover:bg-[var(--background)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    // Get birthYear from state - it should be preserved from when modal was opened
                    // If it's missing, we can't save (but this shouldn't happen if child already has a birthYear)
                    const birthYear = selectedChild.birthYear
                    
                    // Validate required fields - only check if birthYear is null/undefined (not 0 or empty string)
                    if (birthYear === null || birthYear === undefined) {
                      setToast({ message: '❌ Birth year is required to calculate age group', type: 'error' })
                      return
                    }

                    // Ensure birthYear is a number
                    const birthYearNum = typeof birthYear === 'number' ? birthYear : parseInt(String(birthYear))
                    if (isNaN(birthYearNum) || birthYearNum <= 0) {
                      setToast({ message: '❌ Birth year must be a valid number', type: 'error' })
                      return
                    }

                    // Update child info (ageGroup is auto-calculated from birthday)
                    await apiClient.updateChild(selectedChild.id, {
                      nickname: selectedChild.nickname,
                      gender: selectedChild.gender,
                      birthMonth: selectedChild.birthMonth ?? undefined,
                      birthYear: birthYearNum
                    })
                    setToast({ message: '✅ Profile updated successfully!', type: 'success' })
                    setShowChildProfileModal(false)
                    setSelectedChild(null)
                    setNewJoinCode(null)
                    setChildProfileTab('info')
                    await loadDashboard()
                  } catch (error) {
                    console.error('Failed to update child profile:', error)
                    setToast({ message: 'Failed to update profile. Please try again.', type: 'error' })
                  }
                }}
                className="min-h-[44px] flex-1 cb-button-primary touch-manipulation"
              >
                💾 Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payout Modal */}
      {showPayoutModal && payoutChild && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overscroll-contain">
          <div className="cb-card w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <h3 className="cb-heading-lg text-center mb-6 text-[var(--primary)]">💸 Pay Out Pocket Money</h3>
            
            <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-[var(--radius-lg)] border-2 border-green-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-full flex items-center justify-center text-xl">
                  {payoutChild.nickname.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-[var(--text-primary)]">{payoutChild.nickname}</h4>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {wallets.find((w: any) => w.childId === payoutChild.id)?.stars || 0}⭐ available
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleProcessPayout} className="space-y-5">
              {(() => {
                const childWallet = wallets.find((w: any) => w.childId === payoutChild.id)
                const walletBalancePence = childWallet?.balancePence || 0
                const childGifts = gifts.filter((g: any) => g.childId === payoutChild.id && g.status === 'pending' && g.moneyPence > 0)
                const totalGiftMoney = childGifts.reduce((sum: number, g: any) => sum + g.moneyPence, 0)
                const selectedGiftTotal = selectedGiftIds.reduce((sum, id) => {
                  const g = childGifts.find((g: any) => g.id === id)
                  return sum + (g?.moneyPence || 0)
                }, 0)
                const currentChoreAmount = payoutChoreAmount ? parseFloat(payoutChoreAmount) * 100 : 0
                const maxPayoutPence = walletBalancePence + totalGiftMoney
                const maxChoreAmountPence = walletBalancePence

                // Calculate total when gifts or chore amount changes
                const calculatedTotal = selectedGiftTotal + currentChoreAmount
                const calculatedTotalPounds = (calculatedTotal / 100).toFixed(2)

                return (
                  <>
                    {/* Show pending gifts if any */}
                    {childGifts.length > 0 && (
                      <div className="mb-4 p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
                        <p className="text-sm font-semibold text-purple-800 mb-3">Select gifts to pay out:</p>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {childGifts.map((gift: any) => {
                            const giver = members.find((m: any) => m.id === gift.givenBy)
                            const giverName = giver?.displayName || giver?.user?.email?.split('@')[0] || 'Unknown'
                            const isSelected = selectedGiftIds.includes(gift.id)
                            return (
                              <label
                                key={gift.id}
                                className={`flex items-center justify-between p-2 rounded border-2 cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-purple-100 border-purple-400'
                                    : 'bg-white border-purple-200 hover:border-purple-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      let newSelected: string[]
                                      if (e.target.checked) {
                                        newSelected = [...selectedGiftIds, gift.id]
                                      } else {
                                        newSelected = selectedGiftIds.filter((id) => id !== gift.id)
                                      }
                                      setSelectedGiftIds(newSelected)
                                      
                                      // Recalculate total
                                      const newGiftTotal = newSelected.reduce((sum, id) => {
                                        const g = childGifts.find((g: any) => g.id === id)
                                        return sum + (g?.moneyPence || 0)
                                      }, 0)
                                      const newTotal = newGiftTotal + currentChoreAmount
                                      setPayoutAmount((newTotal / 100).toFixed(2))
                                    }}
                                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                  />
                                  <span className="text-sm text-gray-700">
                                    {giverName} gift
                                  </span>
                                </div>
                                <span className="text-sm font-bold text-purple-700">
                                  £{(gift.moneyPence / 100).toFixed(2)}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                        {selectedGiftIds.length > 0 && (
                          <p className="text-xs text-purple-600 mt-2 font-semibold">
                            Selected gifts: £{(selectedGiftTotal / 100).toFixed(2)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Chore earnings amount */}
                    {maxChoreAmountPence > 0 && (
                      <div className="mb-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                        <label className="block font-semibold text-green-800 mb-2">
                          💰 Amount from chores (£)
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="0"
                            max={maxChoreAmountPence}
                            step="1"
                            value={currentChoreAmount}
                            onChange={(e) => {
                              const newChoreAmount = parseInt(e.target.value)
                              setPayoutChoreAmount((newChoreAmount / 100).toFixed(2))
                              const newTotal = selectedGiftTotal + newChoreAmount
                              setPayoutAmount((newTotal / 100).toFixed(2))
                            }}
                            className="flex-1 h-2 bg-green-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                          />
                          <input
                            type="number"
                            min="0"
                            max={(maxChoreAmountPence / 100).toFixed(2)}
                            step="0.01"
                            value={payoutChoreAmount}
                            onChange={(e) => {
                              const newChoreAmount = Math.max(0, Math.min(maxChoreAmountPence, Math.round(parseFloat(e.target.value || '0') * 100)))
                              setPayoutChoreAmount((newChoreAmount / 100).toFixed(2))
                              const newTotal = selectedGiftTotal + newChoreAmount
                              setPayoutAmount((newTotal / 100).toFixed(2))
                            }}
                            className="w-24 px-3 py-2 border-2 border-green-300 rounded-lg focus:border-green-500 focus:outline-none text-sm font-bold"
                            placeholder="0.00"
                          />
                        </div>
                        <p className="text-xs text-green-600 mt-1">
                          Max from chores: £{(maxChoreAmountPence / 100).toFixed(2)}
                        </p>
                      </div>
                    )}

                    {/* Total amount display */}
                    <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-blue-800">Total Payout:</span>
                        <span className="text-2xl font-bold text-blue-900">£{calculatedTotalPounds}</span>
                      </div>
                      <div className="text-xs text-blue-600 space-y-1">
                        {selectedGiftTotal > 0 && (
                          <div className="flex justify-between">
                            <span>From gifts:</span>
                            <span>£{(selectedGiftTotal / 100).toFixed(2)}</span>
                          </div>
                        )}
                        {currentChoreAmount > 0 && (
                          <div className="flex justify-between">
                            <span>From chores:</span>
                            <span>£{(currentChoreAmount / 100).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-blue-600 mt-2">
                        Max available: £{(maxPayoutPence / 100).toFixed(2)} (chores: £{(walletBalancePence / 100).toFixed(2)} + gifts: £{(totalGiftMoney / 100).toFixed(2)})
                      </p>
                    </div>

                    {/* Hidden total amount input for form submission */}
                    <input type="hidden" value={calculatedTotalPounds} />
                  </>
                )
              })()}

              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-2">Payment Method *</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setPayoutMethod('cash')}
                    className={`px-4 py-3 rounded-[var(--radius-md)] font-semibold transition-all ${
                      payoutMethod === 'cash'
                        ? 'bg-[var(--primary)] text-white shadow-lg'
                        : 'bg-[var(--background)] text-[var(--text-secondary)] border-2 border-[var(--card-border)]'
                    }`}
                  >
                    💵 Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutMethod('bank_transfer')}
                    className={`px-4 py-3 rounded-[var(--radius-md)] font-semibold transition-all ${
                      payoutMethod === 'bank_transfer'
                        ? 'bg-[var(--primary)] text-white shadow-lg'
                        : 'bg-[var(--background)] text-[var(--text-secondary)] border-2 border-[var(--card-border)]'
                    }`}
                  >
                    🏦 Transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutMethod('other')}
                    className={`px-4 py-3 rounded-[var(--radius-md)] font-semibold transition-all ${
                      payoutMethod === 'other'
                        ? 'bg-[var(--primary)] text-white shadow-lg'
                        : 'bg-[var(--background)] text-[var(--text-secondary)] border-2 border-[var(--card-border)]'
                    }`}
                  >
                    📝 Other
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-2">Note (optional)</label>
                <textarea
                  value={payoutNote}
                  onChange={(e) => setPayoutNote(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all resize-none"
                  rows={2}
                  placeholder="e.g., Paid for cinema trip"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPayoutModal(false)
                    setPayoutAmount('')
                    setPayoutChoreAmount('')
                    setPayoutNote('')
                    setPayoutMethod('cash')
                    setPayoutChild(null)
                    setSelectedGiftIds([])
                  }}
                  className="flex-1 px-6 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] font-semibold hover:bg-[var(--background)] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingPayout}
                  className="flex-1 cb-button-primary disabled:opacity-50"
                >
                  {processingPayout ? '⏳ Processing...' : '💸 Confirm Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gift Stars/Money Modal */}
      {showGiftStarsMoneyModal && giftChild && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overscroll-contain">
          <div className="cb-card w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <h3 className="cb-heading-lg text-center mb-6 text-[var(--primary)]">🎁 Gift Stars or Money</h3>
            
            <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-[var(--radius-lg)] border-2 border-purple-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-full flex items-center justify-center text-xl">
                  {giftChild.nickname.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-[var(--text-primary)]">{giftChild.nickname}</h4>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {wallets.find((w: any) => w.childId === giftChild.id)?.stars || 0}⭐ available
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleProcessGift} className="space-y-5">
              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-2">Stars (optional)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={giftStars}
                  onChange={(e) => setGiftStars(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all text-lg"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-2">Money (£) (optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={giftMoney}
                  onChange={(e) => setGiftMoney(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all text-lg"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-2">Note (optional)</label>
                <textarea
                  value={giftNote}
                  onChange={(e) => setGiftNote(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all resize-none"
                  rows={3}
                  placeholder="e.g., Happy birthday! 🎉"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowGiftStarsMoneyModal(false)
                    setGiftStars('')
                    setGiftMoney('')
                    setGiftNote('')
                    setGiftChild(null)
                  }}
                  className="flex-1 px-6 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] font-semibold hover:bg-[var(--background)] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingGift || (!giftStars && !giftMoney)}
                  className="flex-1 cb-button-primary disabled:opacity-50"
                >
                  {processingGift ? '⏳ Sending...' : '🎁 Send Gift'}
                </button>
              </div>
            </form>
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

      {/* Delete Account Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overscroll-contain">
          <div className="cb-card w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⚠️</span>
              </div>
              <h3 className="text-2xl font-bold text-red-600 mb-2">Delete Family Account</h3>
              <p className="text-gray-600">
                This action cannot be undone. All family data will be permanently deleted.
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-red-800 mb-2">What will be deleted:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• All family information and settings</li>
                <li>• All child profiles and progress data</li>
                <li>• All chore history and completion records</li>
                <li>• All wallet balances and transaction history</li>
                <li>• All account data permanently deleted within 30 days</li>
              </ul>
            </div>

            <div className="mb-6">
              <label className="block font-semibold text-gray-700 mb-2">
                Type "DELETE" to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
                placeholder="Type DELETE here"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowDeleteAccountModal(false)
                  setDeleteConfirmation('')
                }}
                className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (deleteConfirmation !== 'DELETE') {
                    setToast({ message: 'Please type DELETE to confirm', type: 'error' })
                    return
                  }
                  
                  try {
                    // TODO: Implement account deletion API call
                    setToast({ message: 'Account deletion initiated. You will be logged out.', type: 'success' })
                    setShowDeleteAccountModal(false)
                    setDeleteConfirmation('')
                    // Logout user after deletion
                    setTimeout(() => {
                      logout()
                    }, 2000)
                  } catch (error) {
                    console.error('Failed to delete account:', error)
                    setToast({ message: 'Failed to delete account. Please try again.', type: 'error' })
                  }
                }}
                disabled={deleteConfirmation !== 'DELETE'}
                className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Account Modal */}
      {showSuspendAccountModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overscroll-contain">
          <div className="cb-card w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⏸️</span>
              </div>
              <h3 className="text-2xl font-bold text-yellow-600 mb-2">Suspend Family Account</h3>
              <p className="text-gray-600">
                Suspend your account to prevent automatic deletion for 12 months.
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-yellow-800 mb-2">What happens when suspended:</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Account will not be automatically deleted for 12 months</li>
                <li>• You can reactivate by logging in anytime</li>
                <li>• All data is preserved during suspension</li>
                <li>• You'll receive email reminders before final deletion</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowSuspendAccountModal(false)}
                className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    // TODO: Implement account suspension API call
                    setToast({ message: 'Account suspended successfully. You can reactivate by logging in.', type: 'success' })
                    setShowSuspendAccountModal(false)
                    setAccountSuspended(true)
                    // Logout user after suspension
                    setTimeout(() => {
                      logout()
                    }, 2000)
                  } catch (error) {
                    console.error('Failed to suspend account:', error)
                    setToast({ message: 'Failed to suspend account. Please try again.', type: 'error' })
                  }
                }}
                className="flex-1 px-6 py-3 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 transition-all"
              >
                Suspend Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adult Profile Modal */}
      {showAdultProfileModal && selectedAdult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="cb-card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="cb-heading-lg text-[var(--primary)]">👤 {(selectedAdult.displayName || selectedAdult.user?.email?.split('@')[0] || selectedAdult.user?.email || 'Parent')}'s Profile</h3>
              <button
              onClick={() => {
                setShowAdultProfileModal(false)
                setSelectedAdult(null)
                setAdultProfileTab('info')
                setAdultDeviceToken(null)
                setDeviceTokenEmailSent(false)
                setAdultStats(null)
              }}
                className="text-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            {/* Profile Header */}
            <div className="flex items-center gap-4 p-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-[var(--radius-lg)] mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-4xl font-bold text-white">
                {selectedAdult.user?.email?.charAt(0).toUpperCase() || 'P'}
              </div>
              <div className="flex-1">
                <h4 className="text-2xl font-bold text-[var(--text-primary)]">
                  {selectedAdult.displayName || selectedAdult.user?.email?.split('@')[0] || selectedAdult.user?.email || 'Parent'}
                </h4>
                <p className="text-[var(--text-secondary)]">{selectedAdult.user?.email || 'No email'}</p>
                {(() => {
                  const roleMap: Record<string, string> = {
                    'parent_admin': '👑 Family Admin',
                    'parent_co_parent': '👨‍👩‍👧 Co-Parent',
                    'parent_viewer': '👀 Viewer',
                    'grandparent': '👴👵 Grandparent',
                    'uncle_aunt': '👨‍👩 Uncle/Aunt',
                    'relative_contributor': '🎁 Contributor'
                  }
                  return (
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      Role: {roleMap[selectedAdult.role] || selectedAdult.role}
                    </p>
                  )
                })()}
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-[var(--card-border)] mb-6 overflow-x-auto">
              <button 
                onClick={() => setAdultProfileTab('info')} 
                className={`px-4 py-3 font-semibold text-sm transition-all whitespace-nowrap ${
                  adultProfileTab === 'info' 
                    ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                📝 Basic Info
              </button>
              <button 
                onClick={() => setAdultProfileTab('device')} 
                className={`px-4 py-3 font-semibold text-sm transition-all whitespace-nowrap ${
                  adultProfileTab === 'device' 
                    ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                📱 Device Access
              </button>
              <button 
                onClick={async () => {
                  setAdultProfileTab('stats')
                  // Load stats when switching to stats tab
                  if (selectedAdult && !adultStats) {
                    try {
                      setLoadingAdultStats(true)
                      const statsResponse = await apiClient.getMemberStats(selectedAdult.id)
                      setAdultStats(statsResponse.stats)
                    } catch (error) {
                      console.error('Failed to load member stats:', error)
                    } finally {
                      setLoadingAdultStats(false)
                    }
                  }
                }}
                className={`px-4 py-3 font-semibold text-sm transition-all whitespace-nowrap ${
                  adultProfileTab === 'stats' 
                    ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                📊 Stats
              </button>
              <button 
                onClick={() => setAdultProfileTab('management')} 
                className={`px-4 py-3 font-semibold text-sm transition-all whitespace-nowrap ${
                  adultProfileTab === 'management' 
                    ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                🔧 Management
              </button>
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px] overflow-y-auto">
              {adultProfileTab === 'info' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] mb-4">📝 Basic Information</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Display Name</label>
                        <input
                          type="text"
                          value={selectedAdult.displayName || ''}
                          onChange={(e) => setSelectedAdult({ ...selectedAdult, displayName: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none"
                          placeholder={selectedAdult.user?.email?.split('@')[0] || 'Enter display name'}
                        />
                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                          Optional - A friendly name to display instead of email
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Email Address</label>
                        <input
                          type="email"
                          value={selectedAdult.user?.email || ''}
                          readOnly
                          className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] bg-gray-50 text-gray-600"
                        />
                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                          Email cannot be changed here. Contact support if you need to update it.
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Role</label>
                        <div className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] bg-gray-50 text-gray-600">
                          {(() => {
                            const roleMap: Record<string, string> = {
                              'parent_admin': '👑 Family Admin',
                              'parent_co_parent': '👨‍👩‍👧 Co-Parent',
                              'parent_viewer': '👀 Viewer',
                              'grandparent': '👴👵 Grandparent',
                              'uncle_aunt': '👨‍👩 Uncle/Aunt',
                              'relative_contributor': '🎁 Contributor'
                            }
                            return roleMap[selectedAdult.role] || selectedAdult.role
                          })()}
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                          Role is set by the family admin when inviting
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Joined</label>
                        <div className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] bg-gray-50 text-gray-600">
                          {new Date(selectedAdult.joinedAt || selectedAdult.createdAt).toLocaleString()}
                        </div>
                      </div>

                      {/* Birthday */}
                      <div>
                        <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                          Birthday (Optional)
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">Month</label>
                            <select
                              value={selectedAdult.birthMonth || ''}
                              onChange={(e) => setSelectedAdult({ ...selectedAdult, birthMonth: e.target.value ? parseInt(e.target.value) : null })}
                              className="w-full px-3 py-2 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none"
                            >
                              <option value="">Select month</option>
                              <option value="1">January</option>
                              <option value="2">February</option>
                              <option value="3">March</option>
                              <option value="4">April</option>
                              <option value="5">May</option>
                              <option value="6">June</option>
                              <option value="7">July</option>
                              <option value="8">August</option>
                              <option value="9">September</option>
                              <option value="10">October</option>
                              <option value="11">November</option>
                              <option value="12">December</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1">Year</label>
                            <input
                              type="number"
                              placeholder="e.g., 1980"
                              value={selectedAdult.birthYear || ''}
                              onChange={(e) => setSelectedAdult({ ...selectedAdult, birthYear: e.target.value ? parseInt(e.target.value) : null })}
                              className="w-full px-3 py-2 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none"
                              min="1900"
                              max="2025"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-2">
                          Optional - Can be used for future features like birthday reminders
                        </p>
                      </div>

                      {/* Gift Permissions */}
                      <div className="border-t border-[var(--card-border)] pt-4">
                        <h5 className="font-semibold text-[var(--text-primary)] mb-3">🎁 Gift Permissions</h5>
                        <p className="text-xs text-[var(--text-secondary)] mb-4">
                          Allow this adult to gift stars and/or pocket money to children
                        </p>
                        <div className="space-y-3">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedAdult.giftStarsEnabled || false}
                              onChange={(e) => setSelectedAdult({ ...selectedAdult, giftStarsEnabled: e.target.checked })}
                              className="w-5 h-5 mt-1 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                            />
                            <div>
                              <div className="font-semibold text-[var(--text-primary)]">⭐ Gift Stars</div>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">
                                Allow this person to gift stars to children
                              </p>
                            </div>
                          </label>
                          
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedAdult.giftMoneyEnabled || false}
                              onChange={(e) => setSelectedAdult({ ...selectedAdult, giftMoneyEnabled: e.target.checked })}
                              className="w-5 h-5 mt-1 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                            />
                            <div>
                              <div className="font-semibold text-[var(--text-primary)]">💰 Gift Pocket Money</div>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">
                                Allow this person to gift pocket money to children
                              </p>
                            </div>
                          </label>
                          
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedAdult.chatEnabled !== false}
                              onChange={(e) => setSelectedAdult({ ...selectedAdult, chatEnabled: e.target.checked })}
                              className="w-5 h-5 mt-1 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <div>
                              <div className="font-semibold text-[var(--text-primary)]">💬 Family Chat</div>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">
                                Allow this person to see and use the family chat feature
                              </p>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 pt-4 border-t border-[var(--card-border)]">
                    <button
                      onClick={async () => {
                        try {
                          await apiClient.updateFamilyMember(selectedAdult.id, {
                            displayName: selectedAdult.displayName || undefined,
                            birthMonth: selectedAdult.birthMonth || undefined,
                            birthYear: selectedAdult.birthYear || undefined,
                            giftStarsEnabled: selectedAdult.giftStarsEnabled,
                            giftMoneyEnabled: selectedAdult.giftMoneyEnabled,
                            chatEnabled: selectedAdult.chatEnabled
                          })
                          setToast({ message: '✅ Member updated successfully!', type: 'success' })
                          // Refresh members list
                          const response = await apiClient.getFamilyMembers()
                          setMembers(response.members || [])
                          // Update selected adult with fresh data
                          const updatedMember = response.members?.find((m: any) => m.id === selectedAdult.id)
                          if (updatedMember) {
                            setSelectedAdult(updatedMember)
                          }
                        } catch (error: any) {
                          console.error('Failed to update member:', error)
                          setToast({ message: error.message || 'Failed to update member', type: 'error' })
                        }
                      }}
                      className="min-h-[44px] flex-1 cb-button-primary touch-manipulation"
                    >
                      💾 Save Changes
                    </button>
                  </div>
                </div>
              )}

              {adultProfileTab === 'device' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] mb-4">📱 Device Access</h4>
                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                      Send a magic link email to {selectedAdult.user?.email || 'their email address'} to allow access from a new or different device (tablet, phone, etc.). The link will expire in 7 days.
                    </p>

                    {deviceTokenEmailSent ? (
                      <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-[var(--radius-lg)]">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-2xl">📧</span>
                          <h4 className="font-bold text-[var(--text-primary)]">Device Access Email Sent</h4>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] mb-3">
                          An email with a device access link has been sent to <strong>{selectedAdult.user?.email}</strong>.
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] mb-3">
                          They can click the link in the email to access ChoreBlimey from a new device. The link expires in 7 days.
                        </p>
                        {adultDeviceToken && (
                          <div className="p-3 bg-white rounded-[var(--radius-md)] border-2 border-[var(--card-border)] mb-3">
                            <p className="text-xs text-[var(--text-secondary)] mb-2">Or use this token manually:</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <div className="font-mono text-sm font-bold text-[var(--primary)] break-all">
                                  {adultDeviceToken}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(adultDeviceToken)
                                  setToast({ message: '📋 Token copied to clipboard!', type: 'info' })
                                }}
                                className="px-3 py-1 bg-[var(--primary)] text-white rounded-[var(--radius-md)] hover:bg-[var(--secondary)] transition-all font-semibold text-xs"
                              >
                                📋 Copy
                              </button>
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setDeviceTokenEmailSent(false)
                            setAdultDeviceToken(null)
                          }}
                          className="w-full px-4 py-2 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] hover:bg-[var(--background)] transition-all font-semibold text-sm"
                        >
                          Send Another Email
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          try {
                            setGeneratingDeviceToken(true)
                            setDeviceTokenEmailSent(false)
                            const response = await apiClient.generateDeviceToken(selectedAdult.id)
                            if (response.emailSent) {
                              setDeviceTokenEmailSent(true)
                              setAdultDeviceToken(response.token || null)
                              setToast({ message: '✅ Device access email sent!', type: 'success' })
                            } else {
                              // Fallback if email failed
                              setAdultDeviceToken(response.token || null)
                              setToast({ message: '⚠️ Token created but email failed. Token shown below.', type: 'warning' })
                            }
                          } catch (error: any) {
                            console.error('Failed to generate device token:', error)
                            setToast({ message: error.message || 'Failed to generate device token', type: 'error' })
                          } finally {
                            setGeneratingDeviceToken(false)
                          }
                        }}
                        disabled={generatingDeviceToken}
                        className="w-full px-6 py-4 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] text-white rounded-[var(--radius-lg)] hover:shadow-lg transition-all font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generatingDeviceToken ? '⏳ Sending Email...' : '📧 Send Device Access Email'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {adultProfileTab === 'stats' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] mb-4">📊 Activity Stats</h4>
                    
                    {loadingAdultStats ? (
                      <div className="p-4 text-center">
                        <p className="text-[var(--text-secondary)]">Loading stats...</p>
                      </div>
                    ) : adultStats ? (
                      <div className="space-y-4">
                        {/* Last Login */}
                        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-[var(--radius-lg)]">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">🕐</span>
                            <h5 className="font-bold text-[var(--text-primary)]">Last Login</h5>
                          </div>
                          <p className="text-sm text-[var(--text-secondary)]">
                            {adultStats.lastLogin 
                              ? new Date(adultStats.lastLogin).toLocaleString()
                              : 'Never logged in'}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-[var(--radius-lg)]">
                          <div className="flex items-center gap-3 mb-4">
                            <span className="text-2xl">📈</span>
                            <h5 className="font-bold text-[var(--text-primary)]">Actions Performed</h5>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-white rounded-[var(--radius-md)] border border-green-200">
                              <div className="text-2xl font-bold text-[var(--primary)]">
                                {adultStats.actions?.assignmentsCreated || 0}
                              </div>
                              <div className="text-xs text-[var(--text-secondary)] mt-1">Chores Assigned</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-[var(--radius-md)] border border-green-200">
                              <div className="text-2xl font-bold text-[var(--primary)]">
                                {adultStats.actions?.payoutsMade || 0}
                              </div>
                              <div className="text-xs text-[var(--text-secondary)] mt-1">Payouts Made</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-[var(--radius-md)] border border-green-200 col-span-2">
                              <div className="text-2xl font-bold text-[var(--primary)]">
                                {adultStats.actions?.completionsApproved || 0}
                              </div>
                              <div className="text-xs text-[var(--text-secondary)] mt-1">Completions Approved</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-[var(--radius-lg)]">
                        <p className="text-sm text-yellow-800">
                          Unable to load stats. Please try again.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {adultProfileTab === 'management' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] mb-4">🔧 Account Management</h4>
                    <p className="text-sm text-[var(--text-secondary)] mb-6">
                      Manage this adult member's account access and settings.
                    </p>
                    
                    <div className="space-y-4">
                      {/* Pause Member Button */}
                      {selectedAdult.userId !== user?.id && (
                        <div className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-[var(--radius-lg)]">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">{selectedAdult.paused ? '▶️' : '⏸️'}</span>
                            <div>
                              <h5 className="font-bold text-[var(--text-primary)]">
                                {selectedAdult.paused ? 'Account is Paused' : 'Temporarily Pause Account'}
                              </h5>
                              <p className="text-sm text-[var(--text-secondary)]">
                                {selectedAdult.paused 
                                  ? 'This member\'s account is currently paused. They cannot access ChoreBlimey.'
                                  : 'Temporarily disable this member\'s access to ChoreBlimey'
                                }
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              const action = selectedAdult.paused ? 'unpause' : 'pause'
                              const memberName = selectedAdult.displayName || selectedAdult.user?.email?.split('@')[0] || 'this member'
                              
                              if (confirm(`${selectedAdult.paused ? '▶️' : '⏸️'} ${action.charAt(0).toUpperCase() + action.slice(1)} ${memberName}'s account?\n\n${
                                selectedAdult.paused 
                                  ? 'This will restore their access to ChoreBlimey.'
                                  : 'This will temporarily disable their access to ChoreBlimey until you reactivate their account.'
                              }\n\nYou can ${action} their account anytime from this page.`)) {
                                try {
                                  const response = await apiClient.toggleMemberPause(selectedAdult.id)
                                  
                                  // Update the selected adult state
                                  setSelectedAdult({ ...selectedAdult, paused: response.paused })
                                  
                                  setToast({ 
                                    message: `✅ Account ${response.paused ? 'paused' : 'unpaused'} successfully!`, 
                                    type: 'success' 
                                  })
                                  
                                  // Reload members list to reflect changes
                                  const membersResponse = await apiClient.getFamilyMembers()
                                  setMembers(membersResponse.members || [])
                                } catch (error: any) {
                                  console.error('Failed to toggle pause status:', error)
                                  setToast({ message: error.message || 'Failed to toggle pause status. Please try again.', type: 'error' })
                                }
                              }
                            }}
                            className={`w-full px-4 py-3 text-white rounded-lg font-semibold transition-colors text-sm ${
                              selectedAdult.paused 
                                ? 'bg-green-500 hover:bg-green-600' 
                                : 'bg-yellow-500 hover:bg-yellow-600'
                            }`}
                          >
                            {selectedAdult.paused ? '▶️ Unpause Account' : '⏸️ Pause Account'}
                          </button>
                        </div>
                      )}

                      {/* Remove Member Button */}
                      {selectedAdult.userId !== user?.id && (
                        <div className="p-4 bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-200 rounded-[var(--radius-lg)]">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">👋</span>
                            <div>
                              <h5 className="font-bold text-[var(--text-primary)]">Remove Member from Family</h5>
                              <p className="text-sm text-[var(--text-secondary)]">
                                Permanently remove this member from your family account
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              const memberName = selectedAdult.displayName || selectedAdult.user?.email?.split('@')[0] || selectedAdult.user?.email || 'this member'
                              if (confirm(`👋 Remove ${memberName} from your family?\n\nThis will permanently remove them from your family account.\n\nThey will lose access to all family data and settings.\n\nThis action cannot be undone!\n\nType "${memberName}" to confirm:`)) {
                                const confirmation = prompt(`Type "${memberName}" to confirm removal:`)
                                if (confirmation === memberName) {
                                  try {
                                    await apiClient.removeMember(selectedAdult.id)
                                    setToast({ message: '👋 Member removed successfully!', type: 'success' })
                                    setShowAdultProfileModal(false)
                                    setSelectedAdult(null)
                                    // Reload members list
                                    const membersResponse = await apiClient.getFamilyMembers()
                                    setMembers(membersResponse.members || [])
                                  } catch (error: any) {
                                    console.error('Failed to remove member:', error)
                                    setToast({ message: error.message || 'Failed to remove member. Please try again.', type: 'error' })
                                  }
                                } else {
                                  setToast({ message: '❌ Removal cancelled - name did not match', type: 'error' })
                                }
                              }
                            }}
                            className="w-full px-4 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors text-sm"
                          >
                            🗑️ Remove Member
                          </button>
                        </div>
                      )}

                      {selectedAdult.userId === user?.id && (
                        <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-[var(--radius-lg)]">
                          <p className="text-sm text-blue-800">
                            ℹ️ You cannot pause or remove your own account. Ask another admin to manage your account if needed.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Change Modal */}
      {showEmailChangeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overscroll-contain">
          <div className="cb-card w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📧</span>
              </div>
              <h3 className="text-2xl font-bold text-blue-600 mb-2">Change Email Address</h3>
              <p className="text-gray-600">
                Update your email address for smart login authentication
              </p>
            </div>

            <div className="mb-6">
              <label className="block font-semibold text-gray-700 mb-2">
                New Email Address:
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="new@example.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                You'll receive a verification email at the new address
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowEmailChangeModal(false)
                  setNewEmail('')
                }}
                className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newEmail || !newEmail.includes('@')) {
                    setToast({ message: 'Please enter a valid email address', type: 'error' })
                    return
                  }
                  
                  try {
                    // TODO: Implement email change API call
                    setToast({ message: 'Email change initiated. Check your new email for verification.', type: 'success' })
                    setShowEmailChangeModal(false)
                    setNewEmail('')
                  } catch (error) {
                    console.error('Failed to change email:', error)
                    setToast({ message: 'Failed to change email. Please try again.', type: 'error' })
                  }
                }}
                disabled={!newEmail || !newEmail.includes('@')}
                className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Change Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gifts Management Modal */}
      {showGiftModal && !showAddGiftModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="cb-card w-full max-w-4xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="cb-heading-lg text-[var(--primary)]">🎁 Gift Library</h3>
              <button
                onClick={() => {
                  setShowGiftModal(false)
                  setGiftCategory('all')
                  if (!showAddGiftModal) {
                    setSelectedTemplate(null)
                  }
                }}
                className="text-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              <button
                onClick={() => setGiftCategory('all')}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                  giftCategory === 'all'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background)] text-[var(--text-secondary)]'
                }`}
              >
                ✨ All
              </button>
              <button
                onClick={() => setGiftCategory('activity')}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                  giftCategory === 'activity'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background)] text-[var(--text-secondary)]'
                }`}
              >
                🎯 Activities & Experiences
              </button>
              <button
                onClick={() => setGiftCategory('amazon_product')}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                  giftCategory === 'amazon_product'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background)] text-[var(--text-secondary)]'
                }`}
              >
                📦 Amazon Products
              </button>
              <button
                onClick={() => setGiftCategory('toys')}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                  giftCategory === 'toys'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background)] text-[var(--text-secondary)]'
                }`}
              >
                🧸 Toys & Games
              </button>
              <button
                onClick={() => setGiftCategory('books')}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                  giftCategory === 'books'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background)] text-[var(--text-secondary)]'
                }`}
              >
                📚 Books & Learning
              </button>
              <button
                onClick={() => setGiftCategory('tech')}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                  giftCategory === 'tech'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background)] text-[var(--text-secondary)]'
                }`}
              >
                💻 Tech & Electronics
              </button>
              <button
                onClick={() => setGiftCategory('sports')}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                  giftCategory === 'sports'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background)] text-[var(--text-secondary)]'
                }`}
              >
                ⚽ Sports & Outdoor
              </button>
            </div>

            {/* Gift Templates Grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[60vh] overflow-y-auto p-1">
              {loadingGifts ? (
                <div className="col-span-full text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto"></div>
                  <p className="mt-4 text-[var(--text-secondary)]">Loading templates...</p>
                </div>
              ) : (() => {
                const filteredTemplates = giftTemplates.filter((template: any) => {
                  // Filter by category
                  const matchesCategory = giftCategory === 'all' || 
                    (giftCategory === 'activity' && template.type === 'activity') ||
                    (giftCategory === 'amazon_product' && template.type === 'amazon_product') ||
                    (giftCategory === 'toys' && template.category?.toLowerCase().includes('toy')) ||
                    (giftCategory === 'books' && template.category?.toLowerCase().includes('book')) ||
                    (giftCategory === 'tech' && template.category?.toLowerCase().includes('tech')) ||
                    (giftCategory === 'sports' && template.category?.toLowerCase().includes('sport'))
                  
                  // Exclude templates that are already in the family (only check active gifts)
                  // This allows re-adding gifts that were deleted (soft-deleted gifts are inactive)
                  const alreadyExists = familyGifts.some((gift: any) => 
                    gift.giftTemplateId === template.id && gift.active !== false
                  )
                  
                  return matchesCategory && !alreadyExists
                })

                if (filteredTemplates.length === 0) {
                  return (
                    <div className="col-span-full text-center py-12">
                      <div className="text-6xl mb-4">✅</div>
                      <h4 className="font-bold text-[var(--text-primary)] mb-2">All set!</h4>
                      <p className="text-[var(--text-secondary)]">
                        You've already added all the gifts in this category.
                        <br />
                        Try a different category or create a custom gift below!
                      </p>
                    </div>
                  )
                }

                return filteredTemplates.map((template: any) => (
                  <button
                    key={template.id}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      selectedTemplateRef.current = template
                      setSelectedTemplate(template)
                      setShowGiftModal(false)
                      setTimeout(() => {
                        setShowAddGiftModal(true)
                      }, 150)
                    }}
                    className="text-left p-4 bg-white border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] hover:border-[var(--primary)] hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start gap-3 mb-2">
                      {template.imageUrl ? (
                        <img 
                          src={template.imageUrl} 
                          alt={template.title} 
                          className="w-16 h-16 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <span className="text-3xl flex-shrink-0">🎁</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1">
                          {template.title}
                        </h4>
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                          {template.description || 'A special reward for completing chores!'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs cb-chip bg-yellow-100 text-yellow-700">
                        ⭐ {template.suggestedStars}
                      </span>
                      {template.type === 'amazon_product' && template.pricePence && (
                        <span className="text-xs cb-chip bg-[var(--success)]/10 text-[var(--success)]">
                          💰 {formatCurrency(template.pricePence, family?.currency || 'GBP')}
                        </span>
                      )}
                      <span className="text-xs cb-chip bg-blue-50 text-blue-700">
                        {template.type === 'activity' ? '🎯 Activity' : template.type === 'amazon_product' ? '📦 Product' : '🎁 Custom'}
                      </span>
                      {template.featured && (
                        <span className="text-xs cb-chip bg-purple-50 text-purple-700">
                          ⭐ Featured
                        </span>
                      )}
                    </div>
                  </button>
                ))
              })()}
            </div>

            {/* Custom Gift Option */}
            <div className="mt-6 p-4 bg-gradient-to-r from-[var(--primary)]/10 to-[var(--secondary)]/10 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--primary)]/30">
              <button
                onClick={() => {
                  setShowGiftModal(false)
                  setSelectedTemplate(null)
                  selectedTemplateRef.current = null
                  setShowAddGiftModal(true)
                }}
                className="w-full text-center"
              >
                <div className="text-4xl mb-2">➕</div>
                <h4 className="font-bold text-[var(--text-primary)] mb-1">Create Custom Gift</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  Build your own gift from scratch
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Gift Modal - From Template or Custom */}
      {showAddGiftModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 1001 }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b-2 border-[var(--card-border)] px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-[var(--text-primary)]">
                  {selectedTemplate ? `Add "${selectedTemplate.title}"` : 'Create Custom Gift'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddGiftModal(false)
                    setSelectedTemplate(null)
                  }}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl font-light w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--background)] transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6">
                  {(() => {
                    // Use ref as fallback if state is null (during transition)
                    const template = selectedTemplate || selectedTemplateRef.current
                    
                    // Update state if we're using ref
                    if (!selectedTemplate && selectedTemplateRef.current) {
                      setSelectedTemplate(selectedTemplateRef.current)
                    }
                    
                    // If there's a template, show "Add from template" form
                    // Otherwise, show "Create custom gift" form
                    return template ? (
                    // Add from template
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Star Cost *</label>
                        <input
                          type="number"
                          defaultValue={(selectedTemplate || selectedTemplateRef.current)?.suggestedStars}
                          id="giftStars"
                          className="w-full px-3 py-2 border-2 border-[var(--card-border)] rounded"
                          min="1"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[var(--text-primary)] mb-3">
                          Available For <span className="text-red-500">*</span>
                        </label>
                        <div className="space-y-3 p-4 bg-[var(--background)] border-2 border-[var(--card-border)] rounded-lg">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              id="giftAvailableForAll"
                              defaultChecked={true}
                              onChange={(e) => {
                                const checkboxes = document.querySelectorAll<HTMLInputElement>('input[name="giftChildIds"]')
                                checkboxes.forEach(cb => {
                                  cb.disabled = e.target.checked
                                  if (e.target.checked) cb.checked = false
                                })
                              }}
                              className="w-5 h-5 text-[var(--primary)] border-2 border-[var(--card-border)] rounded focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
                            />
                            <span className="font-medium text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                              All Children
                            </span>
                          </label>
                          <div className="border-t border-[var(--card-border)] pt-3 ml-7 space-y-2">
                            {uniqueChildren.map((child: Child) => (
                              <label key={child.id} className="flex items-center gap-3 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  name="giftChildIds"
                                  value={child.id}
                                  disabled={true}
                                  className="w-5 h-5 text-[var(--primary)] border-2 border-[var(--card-border)] rounded focus:ring-2 focus:ring-[var(--primary)] cursor-pointer disabled:opacity-40"
                                />
                                <span className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                                  {child.nickname}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="flex items-center gap-3 cursor-pointer group p-4 bg-[var(--background)] border-2 border-[var(--card-border)] rounded-lg">
                          <input
                            type="checkbox"
                            id="giftRecurring"
                            defaultChecked={template?.recurring || false}
                            className="w-5 h-5 text-[var(--primary)] border-2 border-[var(--card-border)] rounded focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
                          />
                          <div>
                            <div className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                              🔄 Recurring Gift
                            </div>
                            <p className="text-sm text-[var(--text-secondary)] mt-1">
                              Allow this gift to be purchased multiple times (e.g., activity gifts like "Movie Night")
                            </p>
                          </div>
                        </label>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={async () => {
                            const template = selectedTemplate || selectedTemplateRef.current
                            if (!template) {
                              console.error('❌ No template available when trying to add gift')
                              setToast({ message: 'No template selected', type: 'error' })
                              return
                            }

                            const starsInput = document.getElementById('giftStars') as HTMLInputElement
                            const allCheckbox = document.getElementById('giftAvailableForAll') as HTMLInputElement
                            const recurringCheckbox = document.getElementById('giftRecurring') as HTMLInputElement
                            const childCheckboxes = document.querySelectorAll<HTMLInputElement>('input[name="giftChildIds"]:checked')
                            const selectedChildIds = Array.from(childCheckboxes).map(cb => cb.value)
                            
                            if (!starsInput?.value || parseInt(starsInput.value) < 1) {
                              setToast({ message: 'Please enter a valid star cost', type: 'error' })
                              return
                            }
                            
                            if (!allCheckbox?.checked && selectedChildIds.length === 0) {
                              setToast({ message: 'Please select at least one child or choose "All Children"', type: 'error' })
                              return
                            }
                            
                            try {
                              await apiClient.addGiftFromTemplate(template.id, {
                                starsRequired: parseInt(starsInput.value),
                                availableForAll: allCheckbox.checked,
                                availableForChildIds: allCheckbox.checked ? [] : selectedChildIds,
                                recurring: recurringCheckbox.checked
                              })
                              setToast({ message: 'Gift added to family!', type: 'success' })
                              setShowAddGiftModal(false)
                              setSelectedTemplate(null)
                              selectedTemplateRef.current = null
                              await loadFamilyGifts()
                            } catch (error: any) {
                              console.error('Error adding gift:', error)
                              setToast({ message: error.message || 'Failed to add gift', type: 'error' })
                            }
                          }}
                          className="min-h-[44px] flex-1 cb-button-primary touch-manipulation"
                        >
                          Add Gift
                        </button>
                        <button
                          onClick={() => {
                            setShowAddGiftModal(false)
                            setSelectedTemplate(null)
                          }}
                          className="flex-1 px-6 py-3 border-2 border-[var(--card-border)] rounded-lg text-[var(--text-primary)] font-semibold hover:bg-[var(--background)] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Create custom gift form
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                            Gift Type <span className="text-red-500">*</span>
                          </label>
                          <select
                            id="customGiftType"
                            defaultValue="activity"
                            className="w-full px-4 py-2.5 border-2 border-[var(--card-border)] rounded-lg bg-white focus:border-[var(--primary)] focus:outline-none transition-colors"
                          >
                            <option value="activity">Activity</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                            Star Cost <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            id="customGiftStars"
                            className="w-full px-4 py-2.5 border-2 border-[var(--card-border)] rounded-lg focus:border-[var(--primary)] focus:outline-none transition-colors"
                            min="1"
                            placeholder="e.g., 50"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                          Title <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="customGiftTitle"
                          className="w-full px-4 py-2.5 border-2 border-[var(--card-border)] rounded-lg focus:border-[var(--primary)] focus:outline-none transition-colors"
                          placeholder="e.g., Movie Night, Pizza Night"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                          Description
                        </label>
                        <textarea
                          id="customGiftDescription"
                          rows={3}
                          className="w-full px-4 py-2.5 border-2 border-[var(--card-border)] rounded-lg focus:border-[var(--primary)] focus:outline-none transition-colors resize-none"
                          placeholder="Describe the gift or activity..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                          Image URL <span className="text-xs font-normal text-[var(--text-secondary)]">(optional)</span>
                        </label>
                        <input
                          type="url"
                          id="customGiftImageUrl"
                          className="w-full px-4 py-2.5 border-2 border-[var(--card-border)] rounded-lg focus:border-[var(--primary)] focus:outline-none transition-colors"
                          placeholder="https://example.com/image.jpg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-[var(--text-primary)] mb-3">
                          Available For <span className="text-red-500">*</span>
                        </label>
                        <div className="space-y-3 p-4 bg-[var(--background)] border-2 border-[var(--card-border)] rounded-lg">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              id="customGiftAvailableForAll"
                              defaultChecked={true}
                              onChange={(e) => {
                                const checkboxes = document.querySelectorAll<HTMLInputElement>('input[name="customGiftChildIds"]')
                                checkboxes.forEach(cb => {
                                  cb.disabled = e.target.checked
                                  if (e.target.checked) cb.checked = false
                                })
                              }}
                              className="w-5 h-5 text-[var(--primary)] border-2 border-[var(--card-border)] rounded focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
                            />
                            <span className="font-medium text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                              All Children
                            </span>
                          </label>
                          <div className="border-t border-[var(--card-border)] pt-3 ml-7 space-y-2">
                            {uniqueChildren.map((child: Child) => (
                              <label key={child.id} className="flex items-center gap-3 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  name="customGiftChildIds"
                                  value={child.id}
                                  disabled={true}
                                  className="w-5 h-5 text-[var(--primary)] border-2 border-[var(--card-border)] rounded focus:ring-2 focus:ring-[var(--primary)] cursor-pointer disabled:opacity-40"
                                />
                                <span className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                                  {child.nickname}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="flex items-center gap-3 cursor-pointer group p-4 bg-[var(--background)] border-2 border-[var(--card-border)] rounded-lg">
                          <input
                            type="checkbox"
                            id="customGiftRecurring"
                            defaultChecked={false}
                            className="w-5 h-5 text-[var(--primary)] border-2 border-[var(--card-border)] rounded focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
                          />
                          <div>
                            <div className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                              🔄 Recurring Gift
                            </div>
                            <p className="text-sm text-[var(--text-secondary)] mt-1">
                              Allow this gift to be purchased multiple times (e.g., activity gifts like "Movie Night")
                            </p>
                          </div>
                        </label>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={async () => {
                            const typeInput = document.getElementById('customGiftType') as HTMLSelectElement
                            const titleInput = document.getElementById('customGiftTitle') as HTMLInputElement
                            const descriptionInput = document.getElementById('customGiftDescription') as HTMLTextAreaElement
                            const imageUrlInput = document.getElementById('customGiftImageUrl') as HTMLInputElement
                            const starsInput = document.getElementById('customGiftStars') as HTMLInputElement
                            const allCheckbox = document.getElementById('customGiftAvailableForAll') as HTMLInputElement
                            const recurringCheckbox = document.getElementById('customGiftRecurring') as HTMLInputElement
                            const childCheckboxes = document.querySelectorAll<HTMLInputElement>('input[name="customGiftChildIds"]:checked')
                            const selectedChildIds = Array.from(childCheckboxes).map(cb => cb.value)
                            
                            if (!titleInput.value.trim() || !starsInput.value || parseInt(starsInput.value) < 1) {
                              setToast({ message: 'Title and star cost are required', type: 'error' })
                              return
                            }
                            
                            if (!allCheckbox.checked && selectedChildIds.length === 0) {
                              setToast({ message: 'Please select at least one child or choose "All Children"', type: 'error' })
                              return
                            }
                            
                            try {
                              const giftData: any = {
                                isCustom: true, // Mark as custom gift
                                type: typeInput.value as 'amazon_product' | 'activity' | 'custom',
                                title: titleInput.value.trim(),
                                starsRequired: parseInt(starsInput.value),
                                availableForAll: allCheckbox.checked,
                                availableForChildIds: allCheckbox.checked ? [] : selectedChildIds,
                                recurring: recurringCheckbox.checked
                              }
                              
                              if (descriptionInput.value.trim()) giftData.description = descriptionInput.value.trim()
                              if (imageUrlInput.value.trim()) giftData.imageUrl = imageUrlInput.value.trim()
                              
                              await apiClient.createFamilyGift(giftData)
                              setToast({ message: 'Custom gift created!', type: 'success' })
                              setShowAddGiftModal(false)
                              loadFamilyGifts()
                            } catch (error: any) {
                              setToast({ message: error.message || 'Failed to create gift', type: 'error' })
                            }
                          }}
                          className="flex-1 px-6 py-3 bg-[var(--primary)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
                        >
                          Create Gift
                        </button>
                        <button
                          onClick={() => {
                            setShowAddGiftModal(false)
                            setSelectedTemplate(null)
                          }}
                          className="flex-1 px-6 py-3 border-2 border-[var(--card-border)] rounded-lg text-[var(--text-primary)] font-semibold hover:bg-[var(--background)] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )
                  })()}
            </div>
          </div>
        </div>
      )}

      {/* Edit Gift Modal */}
      {showEditGiftModal && selectedGift && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 1002 }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b-2 border-[var(--card-border)] px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-[var(--text-primary)]">
                  Edit Gift: {selectedGift.title}
                </h3>
                <button
                  onClick={() => {
                    setShowEditGiftModal(false)
                    setSelectedGift(null)
                  }}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl font-light w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--background)] transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                    Star Cost <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="editGiftStars"
                    defaultValue={selectedGift.starsRequired}
                    className="w-full px-4 py-2.5 border-2 border-[var(--card-border)] rounded-lg focus:border-[var(--primary)] focus:outline-none transition-colors"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-3">
                    Available For <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-3 p-4 bg-[var(--background)] border-2 border-[var(--card-border)] rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        id="editGiftAvailableForAll"
                        defaultChecked={(() => {
                          // Check if there's only one child and they've purchased this non-recurring gift
                          const hasSinglePurchasedChild = uniqueChildren.length === 1 && 
                            !selectedGift.recurring && 
                            redemptions.some((r: any) => 
                              r.familyGiftId === selectedGift.id && 
                              r.childId === uniqueChildren[0].id &&
                              (r.status === 'pending' || r.status === 'fulfilled')
                            )
                          
                          // If single child purchased a non-recurring gift, always uncheck "All Children"
                          // (This handles cases where the gift was redeemed before the API auto-update logic existed)
                          if (hasSinglePurchasedChild) {
                            return false
                          }
                          
                          // Otherwise, use the actual database value
                          return selectedGift.availableForAll
                        })()}
                        onChange={(e) => {
                          const checkboxes = document.querySelectorAll<HTMLInputElement>('input[name="editGiftChildIds"]')
                          // Special case: if there's only one child and they've purchased a non-recurring gift,
                          // keep their checkbox enabled even when "All Children" is checked
                          const hasSinglePurchasedChild = uniqueChildren.length === 1 && 
                            !selectedGift.recurring && 
                            redemptions.some((r: any) => 
                              r.familyGiftId === selectedGift.id && 
                              r.childId === uniqueChildren[0].id &&
                              (r.status === 'pending' || r.status === 'fulfilled')
                            )
                          
                          checkboxes.forEach(cb => {
                            // Don't disable if it's a single child who purchased a non-recurring gift
                            if (!hasSinglePurchasedChild) {
                              cb.disabled = e.target.checked
                              if (e.target.checked) cb.checked = false
                            }
                          })
                        }}
                        className="w-5 h-5 text-[var(--primary)] border-2 border-[var(--card-border)] rounded focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
                      />
                      <span className="font-medium text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                        All Children
                        {uniqueChildren.length === 1 && (
                          <span className="text-xs text-[var(--text-secondary)] ml-2 font-normal">
                            (only {uniqueChildren[0].nickname})
                          </span>
                        )}
                      </span>
                    </label>
                    <div className="border-t border-[var(--card-border)] pt-3 ml-7 space-y-2">
                      {uniqueChildren.map((child: Child) => {
                        const childIds = selectedGift.availableForChildIds as string[] | null
                        const isChecked = !!(childIds && childIds.includes(child.id))
                        // Check if this child has purchased this non-recurring gift
                        const hasPurchased = !selectedGift.recurring && redemptions.some((r: any) => 
                          r.familyGiftId === selectedGift.id && 
                          r.childId === child.id &&
                          (r.status === 'pending' || r.status === 'fulfilled')
                        )
                        // If there's only one child and they've purchased it, ensure we can see/manage their checkbox
                        // (API already unchecks "All Children" when non-recurring gift is redeemed)
                        const isSingleChildPurchased = uniqueChildren.length === 1 && hasPurchased && !selectedGift.recurring
                        
                        return (
                          <label key={child.id} className="flex items-center gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              name="editGiftChildIds"
                              value={child.id}
                              defaultChecked={isChecked}
                              disabled={(() => {
                                // If single child purchased, always enable their checkbox so they can re-list
                                if (isSingleChildPurchased) return false
                                // Otherwise, disable if "All Children" is checked
                                const allCheckbox = document.getElementById('editGiftAvailableForAll') as HTMLInputElement
                                return allCheckbox?.checked || selectedGift.availableForAll
                              })()}
                              className="w-5 h-5 text-[var(--primary)] border-2 border-[var(--card-border)] rounded focus:ring-2 focus:ring-[var(--primary)] cursor-pointer disabled:opacity-40"
                            />
                            <span className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors flex items-center gap-2">
                              {child.nickname}
                              {hasPurchased && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                  ✓ Purchased
                                </span>
                              )}
                              {isSingleChildPurchased && selectedGift.availableForAll && (
                                <span className="text-xs text-[var(--text-secondary)] italic">
                                  (Check box to re-list)
                                </span>
                              )}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-3 cursor-pointer group p-4 bg-[var(--background)] border-2 border-[var(--card-border)] rounded-lg">
                    <input
                      type="checkbox"
                      id="editGiftRecurring"
                      defaultChecked={selectedGift.recurring || false}
                      className="w-5 h-5 text-[var(--primary)] border-2 border-[var(--card-border)] rounded focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
                    />
                    <div>
                      <div className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                        🔄 Recurring Gift
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">
                        Allow this gift to be purchased multiple times (e.g., activity gifts like "Movie Night")
                      </p>
                    </div>
                  </label>
                </div>
                <div className="flex gap-3 pt-4 border-t border-[var(--card-border)]">
                  <button
                    onClick={async () => {
                      const starsInput = document.getElementById('editGiftStars') as HTMLInputElement
                      const allCheckbox = document.getElementById('editGiftAvailableForAll') as HTMLInputElement
                      const recurringCheckbox = document.getElementById('editGiftRecurring') as HTMLInputElement
                      const childCheckboxes = document.querySelectorAll<HTMLInputElement>('input[name="editGiftChildIds"]:checked')
                      const selectedChildIds = Array.from(childCheckboxes).map(cb => cb.value)
                      
                      if (!starsInput.value || parseInt(starsInput.value) < 1) {
                        setToast({ message: 'Please enter a valid star cost', type: 'error' })
                        return
                      }
                      
                      if (!allCheckbox.checked && selectedChildIds.length === 0) {
                        setToast({ message: 'Please select at least one child or choose "All Children"', type: 'error' })
                        return
                      }
                      
                      try {
                        await apiClient.updateFamilyGift(selectedGift.id, {
                          starsRequired: parseInt(starsInput.value),
                          availableForAll: allCheckbox.checked,
                          availableForChildIds: allCheckbox.checked ? [] : selectedChildIds,
                          recurring: recurringCheckbox.checked
                        })
                        setToast({ message: 'Gift updated!', type: 'success' })
                        setShowEditGiftModal(false)
                        setSelectedGift(null)
                        loadFamilyGifts()
                      } catch (error: any) {
                        setToast({ message: error.message || 'Failed to update gift', type: 'error' })
                      }
                    }}
                    className="flex-1 px-6 py-3 bg-[var(--primary)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete "${selectedGift.title}"?`)) return
                      try {
                        await apiClient.deleteFamilyGift(selectedGift.id)
                        setToast({ message: 'Gift deleted', type: 'success' })
                        setShowEditGiftModal(false)
                        setSelectedGift(null)
                        loadFamilyGifts()
                      } catch (error: any) {
                        setToast({ message: error.message || 'Failed to delete gift', type: 'error' })
                      }
                    }}
                    className="px-6 py-3 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => {
                      setShowEditGiftModal(false)
                      setSelectedGift(null)
                    }}
                    className="px-6 py-3 border-2 border-[var(--card-border)] rounded-lg text-[var(--text-primary)] font-semibold hover:bg-[var(--background)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal - Only show if enabled for current user */}
      {showChatModal && (() => {
        const currentMember = members.find((m: any) => m.user?.id === user?.id || m.userId === user?.id)
        const chatEnabled = currentMember?.chatEnabled !== false // Default to true if not set
        
        if (!chatEnabled) {
          setShowChatModal(false) // Close modal if chat is disabled
          return null
        }
        
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="cb-card w-full max-w-2xl h-[80vh] flex flex-col">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-[var(--card-border)]">
                <h3 className="cb-heading-lg text-[var(--primary)]">💬 Family Chat</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setChatTab('recent')}
                    className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                      chatTab === 'recent'
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-[var(--background)] text-[var(--text-secondary)] border-2 border-[var(--card-border)]'
                    }`}
                  >
                    Recent (2 days)
                  </button>
                  <button
                    onClick={() => setChatTab('history')}
                    className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                      chatTab === 'history'
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-[var(--background)] text-[var(--text-secondary)] border-2 border-[var(--card-border)]'
                    }`}
                  >
                    History (2 months)
                  </button>
                  <button
                    onClick={() => setShowChatModal(false)}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl font-light w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--background)] transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <FamilyChat 
                  compact={false}
                  days={chatTab === 'recent' ? 2 : 60}
                  maxMessages={chatTab === 'recent' ? 150 : 500}
                />
              </div>
            </div>
          </div>
        )
      })()}

      {/* Confetti Celebration */}
      <Confetti active={showConfetti} />
    </div>
  )
}

export default ParentDashboard
