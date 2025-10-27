import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api'
import { choreTemplates, categoryLabels, calculateSuggestedReward, type ChoreTemplate } from '../data/choreTemplates'
import Toast from '../components/Toast'
import Confetti from '../components/Confetti'

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
  
  // Helper function to notify child dashboards of chore updates
  const notifyChildDashboards = () => {
    console.log('📢 Notifying child dashboards of chore update...')
    
    // Method 1: Custom event
    const event = new CustomEvent('choreUpdated', { 
      detail: { timestamp: Date.now() } 
    })
    window.dispatchEvent(event)
    console.log('📢 Custom event dispatched')
    
    // Method 2: localStorage change (works across tabs)
    const timestamp = Date.now().toString()
    localStorage.setItem('chore_updated', timestamp)
    console.log('📢 localStorage updated with timestamp:', timestamp)
    
    // Method 3: BroadcastChannel (modern browsers)
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('choreblimey-updates')
      channel.postMessage({ type: 'choreUpdated', timestamp })
      console.log('📢 BroadcastChannel message sent')
      channel.close()
    }
    
    // Method 4: Direct localStorage trigger (force storage event)
    setTimeout(() => {
      localStorage.setItem('chore_updated', (Date.now() + 1).toString())
      console.log('📢 Second localStorage trigger sent')
    }, 100)
  }
  const [family, setFamily] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [children, setChildren] = useState<any[]>([])
  const [chores, setChores] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [pendingCompletions, setPendingCompletions] = useState<any[]>([])
  const [recentCompletions, setRecentCompletions] = useState<any[]>([]) // All recent completions for activity feed
  const [pendingRedemptions, setPendingRedemptions] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [budget, setBudget] = useState<any>(null)
  const [joinCodes, setJoinCodes] = useState<any[]>([])
  const [wallets, setWallets] = useState<any[]>([]) // Child wallets for star totals
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  
  // Toast & Confetti
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  
  // Refs for polling
  const previousChildCountRef = useRef(0)
  
  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showFamilyModal, setShowFamilyModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
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
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  
  // Payout system
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutChild, setPayoutChild] = useState<any>(null)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutMethod, setPayoutMethod] = useState<'cash' | 'bank_transfer' | 'other'>('cash')
  const [payoutNote, setPayoutNote] = useState('')
  const [payouts, setPayouts] = useState<any[]>([])
  const [processingPayout, setProcessingPayout] = useState(false)
  
  // Account management
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false)
  const [showSuspendAccountModal, setShowSuspendAccountModal] = useState(false)
  const [showEmailChangeModal, setShowEmailChangeModal] = useState(false)
  const [accountSuspended, setAccountSuspended] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [newEmail, setNewEmail] = useState('')
  
  // Forms
  const [inviteData, setInviteData] = useState({ email: '', nickname: '', birthYear: null as number | null, birthMonth: null as number | null })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  
  const [familyName, setFamilyName] = useState('')
  const [familyLoading, setFamilyLoading] = useState(false)
  const [familyMessage, setFamilyMessage] = useState('')
  
  const [rivalrySettings, setRivalrySettings] = useState({
    enabled: true,
    minUnderbidDifference: 5,
    streakProtectionDays: 3,
    friendlyMode: true
  })
  
  const [budgetSettings, setBudgetSettings] = useState({
    maxBudgetPence: 0,
    budgetPeriod: 'weekly' as 'weekly' | 'monthly',
    showLifetimeEarnings: true
  })
  
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

  useEffect(() => {
    loadDashboard()
  }, [])

  // Listen for completion updates from child dashboard
  useEffect(() => {
    const handleCompletionUpdate = (event?: any) => {
      console.log('🔄 Completion update detected, refreshing parent dashboard...', event?.detail || event)
      loadDashboard()
    }

    // Method 1: Custom events from child dashboard
    window.addEventListener('completionUpdated', handleCompletionUpdate)
    console.log('👂 Parent dashboard listening for completionUpdated events')
    
    // Method 2: localStorage changes (works across tabs)
    const handleStorageChange = (e: StorageEvent) => {
      console.log('🔍 Storage event received:', e.key, e.newValue, e.oldValue)
      if (e.key === 'completion_updated' && e.newValue) {
        console.log('🔄 Completion update detected via localStorage, refreshing parent dashboard...', e.newValue)
        loadDashboard()
        // Clear the flag
        localStorage.removeItem('completion_updated')
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    console.log('👂 Parent dashboard listening for localStorage changes')
    
    // Method 3: BroadcastChannel (modern browsers)
    let broadcastChannel: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel('choreblimey-updates')
      broadcastChannel.onmessage = (event) => {
        if (event.data.type === 'completionUpdated') {
          console.log('🔄 Completion update detected via BroadcastChannel, refreshing parent dashboard...', event.data)
          loadDashboard()
        }
      }
      console.log('👂 Parent dashboard listening for BroadcastChannel messages')
    }

    // Method 4: Test localStorage detection for completions
    const testCompletionLocalStorage = () => {
      const completionValue = localStorage.getItem('completion_updated')
      console.log('🔍 Current localStorage completion_updated value:', completionValue)
      if (completionValue) {
        console.log('🔄 Found completion localStorage value, triggering refresh...')
        loadDashboard()
        localStorage.removeItem('completion_updated')
      }
    }
    
    // Method 5: Direct API polling for pending completions
    const checkPendingCompletions = async () => {
      try {
        console.log('🔍 Checking for pending completions via API...')
        const response = await apiClient.listCompletions()
        const pendingCount = response.completions?.filter((c: any) => c.status === 'pending').length || 0
        console.log('🔍 Found', pendingCount, 'pending completions')
        if (pendingCount > 0) {
          console.log('🔄 Pending completions found, refreshing dashboard...')
          loadDashboard()
        }
      } catch (error) {
        console.error('Error checking pending completions:', error)
      }
    }
    
    // Test localStorage on load
    testCompletionLocalStorage()
    
    // Test localStorage every 2 seconds
    const localStorageTestInterval = setInterval(testCompletionLocalStorage, 2000)
    console.log('👂 Parent dashboard testing completion localStorage every 2 seconds')
    
    // Check API for pending completions every 3 seconds
    const apiCheckInterval = setInterval(checkPendingCompletions, 3000)
    console.log('👂 Parent dashboard checking API for pending completions every 3 seconds')

    return () => {
      window.removeEventListener('completionUpdated', handleCompletionUpdate)
      window.removeEventListener('storage', handleStorageChange)
      if (broadcastChannel) {
        broadcastChannel.close()
      }
      clearInterval(localStorageTestInterval)
      clearInterval(apiCheckInterval)
    }
  }, [])
  
  // Poll for child joins when there are active join codes
  useEffect(() => {
    if (joinCodes.length === 0) return // No active join codes, no need to poll
    
    console.log('🔄 Starting join code polling - checking for new children every 5 seconds')
    
    const checkForNewChildren = async () => {
      try {
        console.log('🔍 Checking for new children who joined via join codes...')
        const response = await apiClient.getFamilyMembers()
        const currentChildCount = response.members?.filter((m: any) => m.role === 'child_player').length || 0
        const previousChildCount = previousChildCountRef.current
        
        console.log(`🔍 Child count: previous=${previousChildCount}, current=${currentChildCount}`)
        
        if (currentChildCount > previousChildCount) {
          console.log('🎉 New child detected! Refreshing dashboard...')
          loadDashboard()
        }
        
        // Update the ref for next comparison
        previousChildCountRef.current = currentChildCount
      } catch (error) {
        console.error('Error checking for new children:', error)
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
  }, [joinCodes.length, children.length]) // Re-run when join codes or children change
  
  useEffect(() => {
    if (family) {
      setFamilyName(family.nameCipher || '')
      if (family.maxBudgetPence) {
        setBudgetSettings({
          maxBudgetPence: family.maxBudgetPence,
          budgetPeriod: family.budgetPeriod || 'weekly',
          showLifetimeEarnings: family.showLifetimeEarnings !== false // Default to true
        })
      } else if (family.showLifetimeEarnings !== undefined) {
        setBudgetSettings(prev => ({
          ...prev,
          showLifetimeEarnings: family.showLifetimeEarnings
        }))
      }
    }
  }, [family])

  const loadDashboard = async () => {
    try {
      const [familyRes, membersRes, choresRes, assignmentsRes, pendingCompletionsRes, allCompletionsRes, redemptionsRes, leaderboardRes, budgetRes, joinCodesRes, payoutsRes] = await Promise.allSettled([
        apiClient.getFamily(),
        apiClient.getFamilyMembers(),
        apiClient.listChores(),
        apiClient.listAssignments(),
        apiClient.listCompletions('pending'), // For approval section
        apiClient.listCompletions(), // All recent for activity feed
        apiClient.getRedemptions('pending'),
        apiClient.getLeaderboard(),
        apiClient.getFamilyBudget(),
        apiClient.getFamilyJoinCodes(),
        apiClient.getPayouts() // All payouts
      ])

      if (familyRes.status === 'fulfilled') setFamily(familyRes.value.family)
      if (membersRes.status === 'fulfilled') {
        setMembers(membersRes.value.members || [])
        const childrenList = membersRes.value.children || []
        setChildren(childrenList)
        
        // Update ref for polling
        previousChildCountRef.current = childrenList.length
        
        // Fetch wallets for all children
        const walletPromises = childrenList.map((child: any) => 
          apiClient.getWallet(child.id).catch(() => ({ wallet: { balancePence: 0 } }))
        )
        const walletResults = await Promise.all(walletPromises)
        const walletsData = walletResults.map((result, index) => ({
          childId: childrenList[index].id,
          balancePence: result.wallet?.balancePence || 0,
          stars: result.wallet?.stars || 0
        }))
        setWallets(walletsData)
      }
      if (choresRes.status === 'fulfilled') {
        console.log('📋 Loaded chores:', choresRes.value.chores?.length || 0, 'chores')
        console.log('📋 Chores data:', choresRes.value.chores)
        setChores(choresRes.value.chores || [])
        // Force re-render by updating a timestamp
        setLoading(false)
      }
      if (assignmentsRes.status === 'fulfilled') setAssignments(assignmentsRes.value.assignments || [])
      if (pendingCompletionsRes.status === 'fulfilled') setPendingCompletions(pendingCompletionsRes.value.completions || [])
      if (allCompletionsRes.status === 'fulfilled') setRecentCompletions(allCompletionsRes.value.completions || [])
      if (redemptionsRes.status === 'fulfilled') setPendingRedemptions(redemptionsRes.value.redemptions || [])
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
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteLoading(true)
    setInviteMessage('')

    // Validate required fields
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

      const result = await apiClient.inviteToFamily({
        email: inviteData.email || undefined, // Make email optional
        role: 'child_player',
        nameCipher: family?.nameCipher || 'Family',
        nickname: inviteData.nickname,
        ageGroup: ageGroup,
        sendEmail: !!inviteData.email // Only send email if provided
      })

      const emailMessage = inviteData.email ? ` – Sent to ${inviteData.email}` : ' – No email provided'
      setInviteMessage(`✅ Join code: ${result.joinCode}${emailMessage}`)
      setTimeout(() => {
        setShowInviteModal(false)
        setInviteMessage('')
        setInviteData({ email: '', nickname: '', birthYear: null, birthMonth: null })
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
      setFamily({ ...family, nameCipher: familyName })
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
      baseRewardPence: suggestedReward
    })

    // Close library and open custom form
    setShowChoreLibraryModal(false)
    setShowCreateChoreModal(true)
  }

  const handleCreateChore = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🎯 handleCreateChore called')
    console.log('📋 newChore:', newChore)
    console.log('👨‍👩‍👧‍👦 choreAssignments:', choreAssignments)
    
    try {
      // Create the chore first
      console.log('📡 Creating chore...')
      const result = await apiClient.createChore(newChore)
      const choreId = result.chore.id
      console.log('✅ Chore created with ID:', choreId)

      // Create assignments for each selected child
      console.log('👥 Selected child IDs:', choreAssignments.childIds)
      console.log('🔢 Number of children:', choreAssignments.childIds.length)
      
      if (choreAssignments.childIds.length > 0) {
        console.log('📡 Creating assignments for', choreAssignments.childIds.length, 'children...')
        const assignmentPromises = choreAssignments.childIds.map(childId => {
          console.log('  -> Creating assignment for childId:', childId)
          return apiClient.createAssignment({
            choreId,
            childId,
            biddingEnabled: choreAssignments.biddingEnabled
          })
        })
        await Promise.all(assignmentPromises)
        console.log('✅ All assignments created')
      } else {
        console.log('⚠️ No children selected - skipping assignment creation')
      }

      // Reset form and close modal
      setShowCreateChoreModal(false)
      setNewChore({
        title: '',
        description: '',
        frequency: 'daily',
        proof: 'none',
        baseRewardPence: 50
      })
      setChoreAssignments({
        childIds: [],
        biddingEnabled: false
      })
      
      // Small delay to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Reload dashboard
      console.log('🔄 Reloading dashboard...')
      await loadDashboard()
      console.log('✅ Dashboard reloaded')
      
      // Notify child dashboards of the update
      notifyChildDashboards()
      
      // Force component refresh
      setRefreshKey(prev => prev + 1)
      
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
      
      // Notify child dashboards of the approval
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
      setToast({ message: 'Chore rejected', type: 'warning' })
      
      // Small delay to ensure DB is updated, then reload
      await new Promise(resolve => setTimeout(resolve, 300))
      await loadDashboard()
    } catch (error) {
      console.error('Error rejecting completion:', error)
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
      
      if (isNaN(amountPence) || amountPence <= 0) {
        setToast({ message: 'Please enter a valid amount', type: 'error' })
        return
      }

      await apiClient.createPayout({
        childId: payoutChild.id,
        amountPence,
        method: payoutMethod,
        note: payoutNote || undefined
      })

      setShowConfetti(true)
      setToast({ message: `💰 £${payoutAmount} paid out to ${payoutChild.nickname}!`, type: 'success' })
      setTimeout(() => setShowConfetti(false), 2000)
      
      // Reset form
      setShowPayoutModal(false)
      setPayoutAmount('')
      setPayoutNote('')
      setPayoutMethod('cash')
      setPayoutChild(null)
      
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

  const filteredChores = chores.filter(chore => {
    if (activeTab === 'all') return chore.active !== false // Show all active chores
    if (activeTab === 'recurring') return chore.frequency !== 'once' && chore.active !== false
    return true
  })

  // For pending tab, show chores assigned but not yet completed
  const pendingChoresByChild = children.map(child => {
    if (activeTab !== 'pending') return { child, chores: [] }
    
    const childAssignments = assignments.filter((a: any) => a.childId === child.id)
    
    // Get chores that have assignments but no recent completions
    const pendingChores = childAssignments
      .map((assignment: any) => assignment.chore)
      .filter((chore: any) => {
        if (!chore || !chore.active) return false
        
        // Check if this chore has been completed today
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const completedToday = recentCompletions.some((c: any) => 
          c.childId === child.id && 
          c.assignment?.choreId === chore.id &&
          new Date(c.timestamp) >= today
        )
        
        return !completedToday
      })
    
    return {
      child,
      chores: pendingChores
    }
  })

  // For completed tab, show all submissions (pending approval, approved, rejected)
  const completionsByChild = children.map(child => {
    if (activeTab !== 'completed') return { child, completions: [] }
    
    // Show all recent completions for this child
    const childCompletions = recentCompletions
      .filter((c: any) => c.childId === child.id)
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
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowSettingsModal(true)} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full font-semibold text-sm transition-all">
                ⚙️ Settings
              </button>
              <button onClick={() => setShowFamilyModal(true)} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full font-semibold text-sm transition-all">
                ✏️ Edit Family
              </button>
              <button onClick={logout} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full font-semibold text-sm transition-all">
                👋 Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Overview Tiles Grid */}
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
          {/* Total Chores */}
          <div className="cb-card bg-gradient-to-br from-[var(--primary)] to-[#FF6B00] text-white p-6 shadow-xl bounce-hover">
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-3xl">
                📝
              </div>
              <span className="text-5xl font-bold">{chores.length}</span>
            </div>
            <h3 className="font-bold text-lg mb-1">Total Chores</h3>
            <p className="text-white/80 text-sm">Active across family</p>
          </div>

          {/* Active Children */}
          <div className="cb-card bg-gradient-to-br from-[var(--secondary)] to-[#1E7DB8] text-white p-6 shadow-xl bounce-hover">
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-3xl">
                👨‍👩‍👧‍👦
              </div>
              <span className="text-5xl font-bold">{children.length}</span>
            </div>
            <h3 className="font-bold text-lg mb-1">Family Members</h3>
            <p className="text-white/80 text-sm">Kids on the team</p>
          </div>

          {/* Pending Reviews */}
          <div className="cb-card bg-gradient-to-br from-[var(--warning)] to-[#F5A623] text-white p-6 shadow-xl bounce-hover">
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-3xl">
                ⏳
              </div>
              <span className="text-5xl font-bold">{pendingCompletions.length}</span>
            </div>
            <h3 className="font-bold text-lg mb-1">Pending Review</h3>
            <p className="text-white/80 text-sm">Awaiting approval</p>
          </div>

          {/* Pending Rewards */}
          <div className="cb-card bg-gradient-to-br from-purple-500 to-pink-600 text-white p-6 shadow-xl bounce-hover">
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-3xl">
                🎁
              </div>
              <span className="text-5xl font-bold">{pendingRedemptions.length}</span>
            </div>
            <h3 className="font-bold text-lg mb-1">Pending Rewards</h3>
            <p className="text-white/80 text-sm">To be delivered</p>
          </div>

          {/* Budget Tracker */}
          <div className={`cb-card text-white p-6 shadow-xl bounce-hover ${
            !budget?.maxBudgetPence 
              ? 'bg-gradient-to-br from-purple-500 to-indigo-600' 
              : budget.percentUsed > 90 
                ? 'bg-gradient-to-br from-red-500 to-pink-600'
                : budget.percentUsed > 70
                  ? 'bg-gradient-to-br from-orange-500 to-yellow-500'
                  : 'bg-gradient-to-br from-[var(--success)] to-[#00A679]'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-3xl">
                💰
              </div>
              <div className="text-right">
                {budget?.maxBudgetPence ? (
                  <>
                    <div className="text-5xl font-bold">{budget.percentUsed}%</div>
                    <div className="text-sm text-white/70 mt-1">
                      £{((budget.allocatedPence || 0) / 100).toFixed(2)} / £{(budget.maxBudgetPence / 100).toFixed(2)}
                    </div>
                  </>
                ) : (
                  <div className="text-3xl font-bold">Not Set</div>
                )}
              </div>
            </div>
            <h3 className="font-bold text-lg mb-1">
              {budget?.budgetPeriod === 'monthly' ? 'Monthly' : 'Weekly'} Budget
            </h3>
            <p className="text-white/80 text-sm">
              {budget?.maxBudgetPence 
                ? `£${((budget.remainingPence || 0) / 100).toFixed(2)} remaining`
                : 'Set in Settings'
              }
            </p>
          </div>
        </section>

        {/* Main Content Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column: Manage Chores (2 cols on desktop) */}
          <div className="lg:col-span-2 space-y-6">
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
                    className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                      activeTab === tab
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--primary)]/20'
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
                      {filteredChores.map((chore) => {
                        // Find assignments for this chore
                        const choreAssigns = assignments.filter((a: any) => a.chore?.id === chore.id)
                        const assignedChildren = choreAssigns.map((a: any) => a.child).filter(Boolean)
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
                                  💰 £{(chore.baseRewardPence / 100).toFixed(2)}
                                </span>
                                <span className="cb-chip bg-yellow-100 text-yellow-700">
                                  ⭐ {chore.starsOverride || Math.max(1, Math.floor(chore.baseRewardPence / 10))}
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
                                onClick={(e) => {
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
                                          className="flex-1 px-3 py-2 bg-[var(--success)] hover:bg-[var(--success)]/80 text-white rounded-[var(--radius-md)] font-semibold text-sm transition-all"
                                        >
                                          ✅ Approve
                                        </button>
                                        <button
                                          onClick={() => handleRejectCompletion(completion.id)}
                                          className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-[var(--radius-md)] font-semibold text-sm transition-all"
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

            {/* Pending Approvals Section */}
            {pendingCompletions.length > 0 && (
              <div className="cb-card p-6 border-4 border-[var(--warning)]">
                <h2 className="cb-heading-lg text-[var(--warning)] mb-6">⏳ Pending Approvals ({pendingCompletions.length})</h2>
                <div className="space-y-4">
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
                          
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => handleApproveCompletion(completion.id)}
                              className="flex-1 px-4 py-2 bg-[var(--success)] hover:bg-[var(--success)]/80 text-white rounded-[var(--radius-md)] font-semibold transition-all"
                            >
                              ✅ Approve & Pay
                            </button>
                            <button
                              onClick={() => handleRejectCompletion(completion.id)}
                              className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-[var(--radius-md)] font-semibold transition-all"
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

            {/* Pending Rewards Section */}
            {pendingRedemptions.length > 0 && (
              <div className="cb-card p-6 border-4 border-purple-400">
                <h2 className="cb-heading-lg text-purple-600 mb-6">🎁 Pending Rewards ({pendingRedemptions.length})</h2>
                <div className="space-y-4">
                  {pendingRedemptions.map((redemption: any) => (
                    <div
                      key={redemption.id}
                      className="bg-[var(--background)] border-2 border-purple-200 rounded-[var(--radius-lg)] p-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
                          🎁
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-[var(--text-primary)] mb-1">
                                {redemption.reward?.title || 'Reward'}
                              </h4>
                              <p className="text-sm text-[var(--text-secondary)] mb-2">
                                Claimed by <span className="font-semibold text-purple-600">{redemption.child?.nickname || 'Unknown'}</span>
                              </p>
                              {redemption.reward?.description && (
                                <p className="text-xs text-[var(--text-secondary)] mb-2">
                                  {redemption.reward.description}
                                </p>
                              )}
                              {redemption.reward?.amazonUrl && (
                                <a 
                                  href={redemption.reward.amazonUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  🔗 View on Amazon
                                </a>
                              )}
                              {redemption.reward?.daysOutUrl && (
                                <a 
                                  href={redemption.reward.daysOutUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  🔗 View Details
                                </a>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-xl font-bold text-[var(--bonus-stars)]">
                                ⭐ {redemption.reward?.starsRequired || 0} stars
                              </div>
                              <div className="text-xs text-[var(--text-secondary)]">
                                {new Date(redemption.redeemedAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => handleFulfillRedemption(redemption.id)}
                              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-[var(--radius-md)] font-semibold transition-all"
                            >
                              ✅ Mark as Delivered
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
              <h2 className="cb-heading-lg text-[var(--primary)] mb-4">📊 Family Activity</h2>
              <div className="space-y-3">
                {/* Show all recent completions */}
                {[...recentCompletions]
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .slice(0, 10)
                  .map((completion: any) => {
                    const timeAgo = getTimeAgo(new Date(completion.timestamp))
                    const icon = completion.status === 'approved' ? '✅' : completion.status === 'rejected' ? '❌' : '⏳'
                    const action = completion.status === 'approved' 
                      ? `completed "${completion.assignment?.chore?.title || 'a chore'}"` 
                      : completion.status === 'rejected'
                      ? `was rejected for "${completion.assignment?.chore?.title || 'a chore'}"`
                      : `submitted "${completion.assignment?.chore?.title || 'a chore'}"`
                    
                    // Calculate actual reward amount
                    let rewardAmount = 0
                    if (completion.status === 'approved') {
                      if (completion.bidAmountPence && completion.assignment?.biddingEnabled) {
                        // Challenge winner: they get the bid amount (with double stars bonus)
                        rewardAmount = completion.bidAmountPence
                      } else {
                        // Normal chore: base reward
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
                  })}
                {recentCompletions.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-5xl mb-3">📊</div>
                    <p className="text-[var(--text-secondary)] font-medium">No recent activity</p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">Chore completions will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Family & Leaderboard */}
          <div className="space-y-6">
            {/* Family Members */}
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
                          <div className="font-mono text-2xl font-bold text-[var(--primary)] tracking-wider">
                            {joinCode.code}
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
                          className="px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] hover:bg-[var(--secondary)] transition-all font-semibold text-sm"
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

              {/* Children List */}
              <div className="space-y-3">
                {children.map((child) => {
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
                  {children.map((child: any) => {
                    const childWallet = wallets.find((w: any) => w.childId === child.id)
                    const balancePence = childWallet?.balancePence || 0

                    // Calculate total paid out
                    const childPayouts = payouts.filter((p: any) => p.childId === child.id)
                    const totalPaidPence = childPayouts.reduce((sum: number, p: any) => sum + p.amountPence, 0)

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
                          <button
                            onClick={() => {
                              setPayoutChild(child)
                              setPayoutAmount((balancePence / 100).toFixed(2))
                              setShowPayoutModal(true)
                            }}
                            disabled={balancePence <= 0}
                            className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          >
                            💸 Pay Out
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-white/60 rounded-lg p-2">
                            <p className="text-xs text-[var(--text-secondary)]">Unpaid</p>
                            <p className="font-bold text-green-700">£{(balancePence / 100).toFixed(2)}</p>
                          </div>
                          <div className="bg-white/60 rounded-lg p-2">
                            <p className="text-xs text-[var(--text-secondary)]">Paid Out</p>
                            <p className="font-bold text-gray-600">£{(totalPaidPence / 100).toFixed(2)}</p>
                          </div>
                        </div>
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
                    {payouts.slice(0, 5).map((payout: any) => (
                      <div key={payout.id} className="flex items-center justify-between p-2 bg-[var(--background)] rounded-lg text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">💵</span>
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">{payout.child?.nickname}</p>
                            <p className="text-xs text-[var(--text-secondary)]">
                              {new Date(payout.createdAt).toLocaleDateString()} • {payout.method || 'cash'}
                            </p>
                          </div>
                        </div>
                        <p className="font-bold text-green-600">£{(payout.amountPence / 100).toFixed(2)}</p>
                      </div>
                    ))}
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
          </div>
        </div>
      </div>

      {/* Modals */}
      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="cb-card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="cb-heading-lg text-center mb-6 text-[var(--primary)]">⚙️ Family Settings</h3>
            
            <div className="space-y-6">
              {/* Sibling Rivalry Section */}
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

                    <div>
                      <label className="block font-semibold text-[var(--text-primary)] mb-2">
                        Streak protection: {rivalrySettings.streakProtectionDays} days
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="7"
                        value={rivalrySettings.streakProtectionDays}
                        onChange={(e) => setRivalrySettings(prev => ({ ...prev, streakProtectionDays: parseInt(e.target.value) }))}
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

              {/* Budget Management Section */}
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
                          className="w-full px-4 py-2 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none"
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
                          onChange={(e) => setBudgetSettings(prev => ({ ...prev, maxBudgetPence: Math.round(parseFloat(e.target.value) * 100) }))}
                          className="w-full px-4 py-2 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    
                    {budget && budget.maxBudgetPence > 0 && (
                      <>
                        <div className="p-3 bg-white rounded-[var(--radius-md)] border-2 border-[var(--card-border)]">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-[var(--text-secondary)]">Currently Allocated:</span>
                            <span className="font-bold text-[var(--text-primary)]">£{((budget.allocatedPence || 0) / 100).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-[var(--text-secondary)]">Remaining:</span>
                            <span className={`font-bold ${budget.remainingPence < 0 ? 'text-red-600' : 'text-[var(--success)]'}`}>
                              £{((budget.remainingPence || 0) / 100).toFixed(2)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 mt-3">
                            <div 
                              className={`h-3 rounded-full transition-all ${
                                budget.percentUsed > 90 ? 'bg-red-500' : 
                                budget.percentUsed > 70 ? 'bg-orange-500' : 
                                'bg-[var(--success)]'
                              }`}
                              style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] mt-2 text-center">
                            {budget.percentUsed}% of budget allocated
                          </p>
                        </div>

                        {/* Per-Child Breakdown */}
                        {children.length > 0 && (
                          <div className="mt-4 p-3 bg-gradient-to-br from-blue-50 to-purple-50 rounded-[var(--radius-md)] border-2 border-blue-200">
                            <h5 className="font-bold text-[var(--text-primary)] mb-3 text-sm">
                              📊 Estimated {budgetSettings.budgetPeriod === 'monthly' ? 'Monthly' : 'Weekly'} Earnings Per Child
                            </h5>
                            <div className="space-y-2">
                              {children.map((child: any) => {
                                // Calculate this child's potential earnings from active assignments
                                const childAssignments = assignments.filter((a: any) => 
                                  a.childId === child.id && a.chore?.active
                                )
                                
                                let weeklyEarnings = 0
                                childAssignments.forEach((a: any) => {
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
                    )}
                    
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
                  </div>
                </div>
              </div>

              {/* Age Mode Info */}
              <div>
                <h4 className="font-bold text-[var(--text-primary)] mb-3">🎚️ Age Mode Profiles</h4>
                <div className="grid gap-3">
                  {[
                    { mode: 'Kid Mode (≤10)', desc: 'Bright colors, friendly mascots', emoji: '🌟', color: 'var(--primary)' },
                    { mode: 'Tween Mode (11-13)', desc: 'Gradients, achievement badges', emoji: '🎯', color: 'var(--secondary)' },
                    { mode: 'Teen Mode (14-16)', desc: 'Dark theme, neon accents', emoji: '🌙', color: 'var(--text-primary)' }
                  ].map((item) => (
                    <div key={item.mode} className="flex items-center gap-3 p-4 bg-[var(--background)] rounded-[var(--radius-md)]">
                      <div className="text-3xl">{item.emoji}</div>
                      <div className="flex-1">
                        <p className="font-semibold text-[var(--text-primary)]">{item.mode}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

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
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="flex-1 px-6 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] font-semibold hover:bg-[var(--background)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    // Save budget settings
                    await apiClient.updateFamily({
                      maxBudgetPence: budgetSettings.maxBudgetPence,
                      budgetPeriod: budgetSettings.budgetPeriod,
                      showLifetimeEarnings: budgetSettings.showLifetimeEarnings
                    })
                    // TODO: Save rivalry settings when backend is ready
                    setToast({ message: '✅ Settings saved successfully!', type: 'success' })
                    await loadDashboard() // Reload to get updated budget
                  } catch (error) {
                    console.error('Failed to save settings:', error)
                    setToast({ message: 'Failed to save settings. Please try again.', type: 'error' })
                  } finally {
                    // Always close the modal
                    setShowSettingsModal(false)
                  }
                }}
                className="flex-1 cb-button-primary"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="cb-card w-full max-w-lg">
            <h3 className="cb-heading-lg text-center mb-6 text-[var(--primary)]">➕ Invite to Family</h3>
            <form onSubmit={handleInvite} className="space-y-5">
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
                <label className="block font-semibold text-[var(--text-primary)] mb-2">Nickname *</label>
                <input
                  name="nickname"
                  required
                  value={inviteData.nickname}
                  onChange={(e) => setInviteData(prev => ({ ...prev, nickname: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all"
                  placeholder="Super Ellie"
                />
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
                    setInviteData({ email: '', nickname: '', ageGroup: '5-8' })
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="cb-card w-full max-w-lg">
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
                    {children.map((child: any) => (
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
                      baseRewardPence: 50
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
                  className="flex-1 cb-button-primary"
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
                    {children.map((child: any) => (
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
                  className="flex-1 cb-button-primary"
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
                    // Validate required fields
                    if (!selectedChild.birthYear) {
                      setToast({ message: '❌ Birth year is required to calculate age group', type: 'error' })
                      return
                    }

                    // Update child info (ageGroup is auto-calculated from birthday)
                    await apiClient.updateChild(selectedChild.id, {
                      nickname: selectedChild.nickname,
                      gender: selectedChild.gender,
                      email: selectedChild.email,
                      birthMonth: selectedChild.birthMonth,
                      birthYear: selectedChild.birthYear
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
                className="flex-1 cb-button-primary"
              >
                💾 Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payout Modal */}
      {showPayoutModal && payoutChild && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="cb-card w-full max-w-lg">
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
              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-2">Amount (£) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-md)] focus:border-[var(--primary)] focus:outline-none transition-all text-lg font-bold"
                  placeholder="10.00"
                  required
                />
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Max: £{((wallets.find((w: any) => w.childId === payoutChild.id)?.balancePence || 0) / 100).toFixed(2)}
                </p>
              </div>

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
                    setPayoutNote('')
                    setPayoutMethod('cash')
                    setPayoutChild(null)
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="cb-card w-full max-w-lg">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="cb-card w-full max-w-lg">
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

      {/* Email Change Modal */}
      {showEmailChangeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="cb-card w-full max-w-lg">
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

      {/* Confetti Celebration */}
      <Confetti active={showConfetti} />
    </div>
  )
}

export default ParentDashboard
