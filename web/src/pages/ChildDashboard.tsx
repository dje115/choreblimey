import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api'
import { formatCurrency } from '../utils/currency'
import Toast from '../components/Toast'
import Confetti from '../components/Confetti'
import { childThemes, getTheme, applyTheme, type ChildTheme } from '../themes/childThemes'

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

type Tab = 'today' | 'streaks' | 'shop' | 'showdown' | 'bank'

const ChildDashboard: React.FC = () => {
  const { user, logout } = useAuth()
  
  // Helper function to notify parent dashboard of completion updates
  const notifyParentDashboard = () => {
    console.log('📢 Notifying parent dashboard of completion update...')
    
    // Method 1: Custom event
    const event = new CustomEvent('completionUpdated', { 
      detail: { timestamp: Date.now() } 
    })
    window.dispatchEvent(event)
    console.log('📢 Custom event dispatched')
    
    // Method 2: localStorage change (works across tabs)
    const timestamp = Date.now().toString()
    localStorage.setItem('completion_updated', timestamp)
    console.log('📢 localStorage updated with timestamp:', timestamp)
    
    // Method 3: BroadcastChannel (modern browsers)
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('choreblimey-updates')
      channel.postMessage({ type: 'completionUpdated', timestamp })
      console.log('📢 BroadcastChannel message sent')
      channel.close()
    }
    
    // Method 4: Direct localStorage trigger (force storage event)
    setTimeout(() => {
      localStorage.setItem('completion_updated', (Date.now() + 1).toString())
      console.log('📢 Second localStorage trigger sent')
    }, 100)
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
  const [selectedGiftForRedemption, setSelectedGiftForRedemption] = useState<FamilyGift | null>(null)
  const [showRedemptionModal, setShowRedemptionModal] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [streakStats, setStreakStats] = useState<{ individualStreaks: StreakStat[]; [key: string]: any } | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [error, setError] = useState<string>('')
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

  useEffect(() => {
    loadDashboard()
  }, [])

  // Listen for chore updates from parent dashboard
  useEffect(() => {
    const handleChoreUpdate = (event?: CustomEvent | Event) => {
      console.log('🔄 Chore update detected, refreshing child dashboard...', event?.detail || event)
      loadDashboard()
    }

    // Method 1: Custom events from parent dashboard
    window.addEventListener('choreUpdated', handleChoreUpdate)
    console.log('👂 Child dashboard listening for choreUpdated events')
    
    // Method 2: localStorage changes (works across tabs)
    const handleStorageChange = (e: StorageEvent) => {
      console.log('🔍 Storage event received:', e.key, e.newValue, e.oldValue)
      if (e.key === 'chore_updated' && e.newValue) {
        console.log('🔄 Chore update detected via localStorage, refreshing child dashboard...', e.newValue)
        loadDashboard()
        // Clear the flag
        localStorage.removeItem('chore_updated')
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    console.log('👂 Child dashboard listening for localStorage changes')
    
    // Method 3: BroadcastChannel (modern browsers)
    let broadcastChannel: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel('choreblimey-updates')
      broadcastChannel.onmessage = (event) => {
        if (event.data.type === 'choreUpdated') {
          console.log('🔄 Chore update detected via BroadcastChannel, refreshing child dashboard...', event.data)
          loadDashboard()
        }
      }
      console.log('👂 Child dashboard listening for BroadcastChannel messages')
    }

    // Method 4: Polling fallback (every 5 seconds)
    const pollInterval = setInterval(() => {
      console.log('🔄 Polling for updates...')
      loadDashboard()
    }, 5000)
    console.log('👂 Child dashboard polling every 5 seconds as fallback')
    
    // Method 5: Test localStorage detection
    const testLocalStorage = () => {
      const currentValue = localStorage.getItem('chore_updated')
      console.log('🔍 Current localStorage chore_updated value:', currentValue)
      if (currentValue) {
        console.log('🔄 Found localStorage value, triggering refresh...')
        loadDashboard()
        localStorage.removeItem('chore_updated')
      }
    }
    
    // Test localStorage on load
    testLocalStorage()
    
    // Test localStorage every 2 seconds
    const localStorageTestInterval = setInterval(testLocalStorage, 2000)
    console.log('👂 Child dashboard testing localStorage every 2 seconds')

    return () => {
      window.removeEventListener('choreUpdated', handleChoreUpdate)
      window.removeEventListener('storage', handleStorageChange)
      if (broadcastChannel) {
        broadcastChannel.close()
      }
      clearInterval(pollInterval)
      clearInterval(localStorageTestInterval)
    }
  }, [])

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

  const loadDashboard = async () => {
    try {
      setError('')
      const childId = user?.childId || user?.id || ''

      const [walletRes, walletStatsRes, familyRes, familyMembersRes, assignmentsRes, completionsRes, rewardsRes, familyGiftsRes, leaderboardRes, streaksRes, transactionsRes, payoutsRes] = await Promise.allSettled([
        apiClient.getWallet(childId),
        apiClient.getWalletStats(childId),
        apiClient.getFamily(),
        apiClient.getFamilyMembers(),
        apiClient.listAssignments(childId),
        apiClient.listCompletions(), // Get all completions to filter out submitted chores
        apiClient.getRewards(childId), // Keep for backward compatibility
        apiClient.getFamilyGifts({ childId, active: 'true' }), // New: Get family gifts
        apiClient.getLeaderboard(),
        apiClient.getStreakStats(childId),
        apiClient.getTransactions(childId, 50),
        apiClient.getPayouts(childId) // Get payouts to show who paid
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

            setHolidayMode({
              isActive: true,
              isFamilyHoliday: true,
              startDate: family.holidayStartDate || '',
              endDate: family.holidayEndDate || '',
              message,
            })
          } else {
            if (wasActive) {
              console.log('Holiday mode ended; refreshing missions on next poll')
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
    } catch (err: any) {
      console.error('Error loading dashboard:', err)
      setError(err.message || 'Failed to load dashboard')
    } finally {
      setIsLoading(false)
    }
  }

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
      
      // Small delay to ensure DB is updated, then reload
      await new Promise(resolve => setTimeout(resolve, 300))
      await loadDashboard()
      
      // Notify parent dashboard of the completion
      notifyParentDashboard()
    } catch (error) {
      console.error('Failed to submit completion:', error)
      setToast({ message: 'Failed to submit. Please try again.', type: 'error' })
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
      console.error('Failed to claim reward:', error)
      const errorMsg = error.response?.data?.error || 'Failed to claim reward'
      setToast({ message: errorMsg, type: 'error' })
    } finally {
      setClaimingReward(null)
    }
  }

  const handleRedeemGift = async () => {
    if (!selectedGiftForRedemption || !user?.childId && !user?.id) return
    
    const childId = user.childId || user.id
    
    try {
      setClaimingReward(selectedGiftForRedemption.id)
      await apiClient.redeemReward({
        familyGiftId: selectedGiftForRedemption.id,
        childId
      })

      // Reload dashboard to update wallet and gifts
      await loadDashboard()
      
      // Close modal
      setShowRedemptionModal(false)
      setSelectedGiftForRedemption(null)
      
      // Show success with confetti celebration!
      setShowConfetti(true)
      setToast({ message: `🎉 ${selectedGiftForRedemption.title} redeemed! Ask your parent to get it for you`, type: 'success' })
      setTimeout(() => setShowConfetti(false), 2000)
    } catch (error: any) {
      console.error('Failed to redeem gift:', error)
      const errorMsg = error.response?.data?.error || 'Failed to redeem gift'
      setToast({ message: errorMsg, type: 'error' })
    } finally {
      setClaimingReward(null)
    }
  }

  const totalStars = wallet?.stars || 0

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
      console.error('Failed to change theme:', error)
      setToast({ message: 'Failed to change theme. Please try again.', type: 'error' })
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
    <div className="min-h-screen bg-[var(--background)] pb-24">
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
            <div className="flex gap-2">
              <button
                onClick={() => setShowThemePicker(true)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full font-semibold text-sm backdrop-blur transition-all"
                title="Change Theme"
              >
                {currentTheme.emoji} Theme
              </button>
              <button
                onClick={logout}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full font-semibold text-sm backdrop-blur transition-all"
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
                <p className="text-white/70 text-sm mt-1">£{((wallet?.balancePence || 0) / 100).toFixed(2)} owed</p>
              </div>
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-4xl animate-pulse">
                💰
              </div>
            </div>
            <div className={`flex gap-4 text-sm ${familySettings?.showLifetimeEarnings !== false ? 'grid grid-cols-3' : 'grid grid-cols-2'}`}>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-white/70 text-xs">Owed</p>
                <p className="font-bold text-lg">£{((wallet?.balancePence || 0) / 100).toFixed(2)}</p>
              </div>
              {familySettings?.showLifetimeEarnings !== false && walletStats && (
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-white/70 text-xs">Total Earned</p>
                  <p className="font-bold text-lg">£{((walletStats.lifetimeEarningsPence || 0) / 100).toFixed(2)}</p>
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

      {/* Tab Navigation */}
      <div className="sticky top-0 z-30 bg-white border-b-2 border-[var(--card-border)] shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto py-3">
            {[
              { id: 'today' as Tab, label: 'Today', icon: '📅' },
              { id: 'streaks' as Tab, label: 'Streaks', icon: '🔥' },
              ...(familySettings?.giftsEnabled !== false ? [{ id: 'shop' as Tab, label: 'Shop', icon: '🛍️' }] : []),
              { id: 'showdown' as Tab, label: 'Showdown', icon: '⚔️' },
              { id: 'bank' as Tab, label: 'Bank', icon: '🏦' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-[var(--primary)] text-white shadow-lg scale-105'
                    : 'bg-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--primary)]/20'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
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
                {assignments.filter(a => {
                  const hasCompletion = completions.some(c => c.assignmentId === a.id)
                  if (!a.chore?.active || hasCompletion) return false
                  
                  // For daily chores, only show assignments created today
                  if (a.chore.frequency === 'daily') {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const assignmentDate = new Date(a.createdAt)
                    assignmentDate.setHours(0, 0, 0, 0)
                    return assignmentDate.getTime() === today.getTime()
                  }
                  
                  // For weekly chores, show assignments from this week
                  if (a.chore.frequency === 'weekly') {
                    const today = new Date()
                    const day = today.getDay()
                    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
                    const startOfWeek = new Date(today)
                    startOfWeek.setDate(diff)
                    startOfWeek.setHours(0, 0, 0, 0)
                    const assignmentDate = new Date(a.createdAt)
                    return assignmentDate >= startOfWeek
                  }
                  
                  // For 'once' chores, show all
                  return true
                }).length} active
              </span>
            </div>

            {assignments.filter(a => {
              const hasCompletion = completions.some(c => c.assignmentId === a.id)
              if (!a.chore?.active || hasCompletion) return false
              
              // For daily chores, only show assignments created today
              if (a.chore.frequency === 'daily') {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const assignmentDate = new Date(a.createdAt)
                assignmentDate.setHours(0, 0, 0, 0)
                return assignmentDate.getTime() === today.getTime()
              }
              
              // For weekly chores, show assignments from this week
              if (a.chore.frequency === 'weekly') {
                const today = new Date()
                const day = today.getDay()
                const diff = today.getDate() - day + (day === 0 ? -6 : 1)
                const startOfWeek = new Date(today.setDate(diff))
                startOfWeek.setHours(0, 0, 0, 0)
                const assignmentDate = new Date(a.createdAt)
                return assignmentDate >= startOfWeek
              }
              
              // For 'once' chores, show all
              return true
            }).length === 0 ? (
              <div className="text-center py-16">
                <div className="text-8xl mb-4">🎉</div>
                <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">All caught up!</h3>
                <p className="text-[var(--text-secondary)]">No pending chores right now. Great work!</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {assignments.filter(a => {
                  const hasCompletion = completions.some(c => c.assignmentId === a.id)
                  if (!a.chore?.active || hasCompletion) return false
                  
                  // For daily chores, only show assignments created today
                  if (a.chore.frequency === 'daily') {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const assignmentDate = new Date(a.createdAt)
                    assignmentDate.setHours(0, 0, 0, 0)
                    return assignmentDate.getTime() === today.getTime()
                  }
                  
                  // For weekly chores, show assignments from this week
                  if (a.chore.frequency === 'weekly') {
                    const today = new Date()
                    const day = today.getDay()
                    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
                    const startOfWeek = new Date(today)
                    startOfWeek.setDate(diff)
                    startOfWeek.setHours(0, 0, 0, 0)
                    const assignmentDate = new Date(a.createdAt)
                    return assignmentDate >= startOfWeek
                  }
                  
                  // For 'once' chores, show all
                  return true
                }).map((assignment) => {
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
            
            {/* Main Stats Cards */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="cb-card bg-gradient-to-br from-orange-400 to-red-500 text-white p-6 shadow-lg">
                <div className="text-6xl mb-4">🔥</div>
                <h3 className="text-3xl font-bold mb-2">{streakStats?.currentStreak || 0} Days</h3>
                <p className="text-white/90">Current Streak</p>
                {streakStats?.currentStreak > 0 && (
                  <div className="mt-3 text-xs bg-white/20 rounded-lg px-2 py-1 inline-block">
                    Keep it going! 💪
                  </div>
                )}
              </div>
              
              <div className="cb-card bg-gradient-to-br from-purple-400 to-pink-500 text-white p-6 shadow-lg">
                <div className="text-6xl mb-4">🏆</div>
                <h3 className="text-3xl font-bold mb-2">{streakStats?.bestStreak || 0} Days</h3>
                <p className="text-white/90">Best Streak Ever</p>
                {streakStats?.currentStreak === streakStats?.bestStreak && streakStats?.currentStreak > 0 && (
                  <div className="mt-3 text-xs bg-white/20 rounded-lg px-2 py-1 inline-block">
                    Personal Best! 🎯
                  </div>
                )}
              </div>
              
              <div className="cb-card bg-gradient-to-br from-green-400 to-teal-500 text-white p-6 shadow-lg">
                <div className="text-6xl mb-4">📅</div>
                <h3 className="text-3xl font-bold mb-2">{streakStats?.totalCompletedDays || 0}</h3>
                <p className="text-white/90">Total Days Completed</p>
                {streakStats?.totalCompletedDays > 0 && (
                  <div className="mt-3 text-xs bg-white/20 rounded-lg px-2 py-1 inline-block">
                    That's {Math.floor((streakStats.totalCompletedDays / 7))} weeks! 📆
                  </div>
                )}
              </div>
            </div>

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
              <div className="cb-card p-6 bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-300">
                <h3 className="cb-heading-md text-red-600 mb-3 flex items-center gap-2">
                  ⚠️ Penalty Info
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-3">
                  Missing chores after your protection period will result in penalties:
                </p>
                <div className="space-y-2 text-sm">
                  {familySettings.firstMissPence > 0 && (
                    <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                      <span>1st miss:</span>
                      <span className="font-bold text-red-600">
                        -£{(familySettings.firstMissPence / 100).toFixed(2)}
                        {familySettings.firstMissStars > 0 && ` / -${familySettings.firstMissStars}⭐`}
                      </span>
                    </div>
                  )}
                  {familySettings.secondMissPence > 0 && (
                    <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                      <span>2nd miss:</span>
                      <span className="font-bold text-red-600">
                        -£{(familySettings.secondMissPence / 100).toFixed(2)}
                        {familySettings.secondMissStars > 0 && ` / -${familySettings.secondMissStars}⭐`}
                      </span>
                    </div>
                  )}
                  {familySettings.thirdMissPence > 0 && (
                    <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                      <span>3rd+ miss:</span>
                      <span className="font-bold text-red-600">
                        -£{(familySettings.thirdMissPence / 100).toFixed(2)}
                        {familySettings.thirdMissStars > 0 && ` / -${familySettings.thirdMissStars}⭐`}
                      </span>
                    </div>
                  )}
                </div>
                {(familySettings.minBalancePence > 0 || familySettings.minBalanceStars > 0) && (
                  <div className="mt-3 text-xs text-[var(--text-secondary)] bg-white rounded-lg px-3 py-2">
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
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* Display Family Gifts (new system) */}
                {familyGifts.map((gift) => (
                  <div
                    key={gift.id}
                    className="bg-white border-2 border-[var(--card-border)] rounded-3xl overflow-hidden hover:shadow-2xl transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedGiftForRedemption(gift)
                      setShowRedemptionModal(true)
                    }}
                  >
                    <div className="aspect-video bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center text-6xl relative">
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
                    <div className="p-4">
                      <h3 
                        className={`font-bold text-lg text-[var(--text-primary)] mb-2 ${gift.affiliateUrl || gift.sitestripeUrl ? 'cursor-pointer hover:text-[var(--primary)] transition-colors' : ''}`}
                        onClick={(e) => {
                          if (gift.affiliateUrl || gift.sitestripeUrl) {
                            e.stopPropagation()
                            window.open(gift.affiliateUrl || gift.sitestripeUrl, '_blank', 'noopener,noreferrer')
                          }
                        }}
                      >
                        {gift.title}
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2">
                        {gift.description || 'A special reward just for you!'}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-[var(--bonus-stars)]">
                            {gift.starsRequired}⭐
                          </span>
                          {gift.type === 'amazon_product' && gift.pricePence && (
                            <span className="text-sm font-semibold text-[var(--text-secondary)]">
                              {formatCurrency(gift.pricePence, familySettings?.currency || 'GBP')}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedGiftForRedemption(gift)
                            setShowRedemptionModal(true)
                          }}
                          disabled={totalStars < gift.starsRequired || claimingReward === gift.id}
                          className={`px-4 py-2 rounded-full font-bold text-sm ${
                            totalStars >= gift.starsRequired
                              ? 'bg-[var(--primary)] text-white hover:scale-105'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          } transition-all`}
                        >
                          {claimingReward === gift.id ? '⏳ Redeeming...' : totalStars >= gift.starsRequired ? '🎉 Redeem' : `🔒 Need ${gift.starsRequired - totalStars} more`}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Display old Rewards (backward compatibility) */}
                {rewards.map((reward) => (
                  <div
                    key={reward.id}
                    className="bg-white border-2 border-[var(--card-border)] rounded-3xl overflow-hidden hover:shadow-2xl transition-all"
                  >
                    <div className="aspect-video bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center text-6xl">
                      {reward.imageUrl ? (
                        <img src={reward.imageUrl} alt={reward.title} className="w-full h-full object-cover" />
                      ) : (
                        '🎁'
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-lg text-[var(--text-primary)] mb-2">{reward.title}</h3>
                      <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2">
                        {reward.description || 'A special reward just for you!'}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-[var(--bonus-stars)]">
                          {reward.starsRequired}⭐
                        </span>
                        <button
                          onClick={() => handleClaimReward(reward)}
                          disabled={totalStars < reward.starsRequired || claimingReward === reward.id}
                          className={`px-4 py-2 rounded-full font-bold text-sm ${
                            totalStars >= reward.starsRequired
                              ? 'bg-[var(--primary)] text-white hover:scale-105'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          } transition-all`}
                        >
                          {claimingReward === reward.id ? '⏳ Claiming...' : totalStars >= reward.starsRequired ? '🎉 Claim' : '🔒 Locked'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Redemption Confirmation Modal */}
            {showRedemptionModal && selectedGiftForRedemption && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
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
                      <p className="text-[var(--text-secondary)] mb-4">{selectedGiftForRedemption.description}</p>
                    )}
                  </div>
                  
                  <div className="bg-[var(--card-border)]/20 rounded-xl p-4 mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[var(--text-secondary)]">Cost:</span>
                      <span className="text-2xl font-bold text-[var(--bonus-stars)]">
                        {selectedGiftForRedemption.starsRequired} ⭐
                      </span>
                    </div>
                    {selectedGiftForRedemption.type === 'amazon_product' && selectedGiftForRedemption.pricePence && (
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[var(--text-secondary)]">Price:</span>
                        <span className="font-semibold text-[var(--text-primary)]">
                          {formatCurrency(selectedGiftForRedemption.pricePence, familySettings?.currency || 'GBP')}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-[var(--card-border)]">
                      <span className="text-[var(--text-secondary)]">Your Stars:</span>
                      <span className="font-bold text-[var(--text-primary)]">
                        {totalStars} ⭐ → {totalStars - selectedGiftForRedemption.starsRequired} ⭐
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowRedemptionModal(false)
                        setSelectedGiftForRedemption(null)
                      }}
                      className="flex-1 px-4 py-3 rounded-full font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRedeemGift}
                      disabled={totalStars < selectedGiftForRedemption.starsRequired || claimingReward === selectedGiftForRedemption.id}
                      className={`flex-1 px-4 py-3 rounded-full font-bold text-white transition-all ${
                        totalStars >= selectedGiftForRedemption.starsRequired
                          ? 'bg-[var(--primary)] hover:scale-105'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {claimingReward === selectedGiftForRedemption.id ? '⏳ Redeeming...' : 'Confirm Redeem'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Showdown Tab - Rivalry Bidding */}
        {activeTab === 'showdown' && (
          <div className="space-y-6">
            <div className="cb-card bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 text-white p-6">
              <div className="flex items-center gap-4 mb-3">
                <div className="text-6xl">⚔️</div>
                <div>
                  <h2 className="text-3xl font-bold">Challenge Mode!</h2>
                  <p className="text-white/90">Offer to do chores for LESS money = WIN DOUBLE STARS! 🏆</p>
                </div>
              </div>
              <div className="mt-4 bg-white/20 rounded-xl p-4 text-sm">
                <p className="font-semibold mb-2">💡 How it works:</p>
                <ul className="space-y-1 text-white/90">
                  <li>• Chore usually pays £0.10 (1⭐) → Offer £0.10 or LESS to claim it</li>
                  <li>• Lowest offer wins the chore!</li>
                  <li>• <strong>Winner gets your bid PLUS a bonus star! 🎉</strong></li>
                  <li>• Example: Bid £0.09, get £0.09 + bonus star = 2⭐ total!</li>
                  <li>• <strong>🔥 Streak bonus:</strong> If you have a streak, claim it quick or lose it!</li>
                  <li>• <strong>💪 Break streaks:</strong> Steal chores from siblings to break their streaks!</li>
                </ul>
              </div>
            </div>

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
                        <p className="text-3xl font-bold text-[var(--bonus-stars)]">{entry.totalStars || 0}⭐</p>
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
            <div className="cb-card bg-gradient-to-br from-green-500 via-teal-500 to-blue-500 text-white p-6">
              <div className="flex items-center gap-4 mb-3">
                <div className="text-6xl">🏦</div>
                <div>
                  <h2 className="text-3xl font-bold mb-1">Star Bank</h2>
                  <p className="text-white/90 text-lg">Your Money History</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
                  <p className="text-white/80 text-sm font-semibold mb-1">Current Balance</p>
                  <p className="text-4xl font-bold">{totalStars}⭐</p>
                  <p className="text-white/80 text-sm">£{((wallet?.balancePence || 0) / 100).toFixed(2)}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
                  <p className="text-white/80 text-sm font-semibold mb-1">Transactions</p>
                  <p className="text-4xl font-bold">{transactions.length}</p>
                  <p className="text-white/80 text-sm">All time</p>
                </div>
              </div>
            </div>

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
                      } else {
                        icon = '💵'
                        label = 'Money Added'
                        description = metaJson.note || 'From parent'
                      }
                    } else {
                      if (metaJson.redemptionId) {
                        icon = '🎁'
                        label = 'Reward Claimed'
                        description = metaJson.rewardTitle || 'Prize redeemed'
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
                    
                    const stars = Math.floor(transaction.amountPence / 10)
                    
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
                              <p className={`font-bold text-2xl ${
                                isCredit ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {isCredit ? '+' : '-'}{stars}⭐
                              </p>
                              <p className="text-sm text-[var(--text-secondary)]">
                                £{(transaction.amountPence / 100).toFixed(2)}
                              </p>
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

      {/* Bottom Navigation (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-[var(--card-border)] shadow-lg z-40 sm:hidden">
        <div className="flex justify-around py-2">
          {[
            { id: 'today' as Tab, icon: '📅', label: 'Today' },
            { id: 'bank' as Tab, icon: '🏦', label: 'Bank' },
            { id: 'streaks' as Tab, icon: '🔥', label: 'Streak' },
            ...(familySettings?.giftsEnabled !== false ? [{ id: 'shop' as Tab, icon: '🛍️', label: 'Shop' }] : []),
            { id: 'showdown' as Tab, icon: '⚔️', label: 'Fight' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 px-4 py-2 transition-all ${
                activeTab === tab.id ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)]'
              }`}
            >
              <span className="text-2xl">{tab.icon}</span>
              <span className="text-xs font-semibold">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Completion Modal */}
      {showCompletionModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="cb-card w-full max-w-md">
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
                  className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none resize-none"
                  rows={3}
                  placeholder="Tell us how you completed this chore..."
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCompletionModal(false)
                  setSelectedAssignment(null)
                  setCompletionNote('')
                }}
                className="flex-1 px-6 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] font-semibold hover:bg-[var(--background)] transition-all"
                disabled={completingChore}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitCompletion}
                disabled={completingChore}
                className="flex-1 cb-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {completingChore ? '⏳ Submitting...' : '✅ Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Theme Picker Modal */}
      {showThemePicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white p-6 rounded-t-3xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold mb-1">🎨 Choose Your Theme!</h2>
                  <p className="text-white/90">Pick your favorite style</p>
                </div>
                <button
                  onClick={() => setShowThemePicker(false)}
                  className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-2xl transition-all"
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

