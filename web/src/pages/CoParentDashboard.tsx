import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api'
import { useSocket } from '../contexts/SocketContext'
import Confetti from 'react-confetti'
import { FamilyChat } from '../components/FamilyChat'

const CoParentDashboard: React.FC = () => {
  const { user, logout } = useAuth()
  const [family, setFamily] = useState<any>(null)
  const [children, setChildren] = useState<any[]>([])
  const [chores, setChores] = useState<any[]>([])
  const [wallets, setWallets] = useState<any[]>([])
  const [completions, setCompletions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [members, setMembers] = useState<any[]>([]) // Family members to check chatEnabled
  const [showChatModal, setShowChatModal] = useState(false) // For full chat modal
  const [chatTab, setChatTab] = useState<'recent' | 'history'>('recent') // Chat modal tabs

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const [familyData, childrenData, choresData, walletsData, completionsData, membersData] = await Promise.all([
        apiClient.getFamily(),
        apiClient.getChildren(),
        apiClient.getChores(),
        apiClient.getWallets(),
        apiClient.getCompletions(),
        apiClient.getFamilyMembers()
      ])
      
      setFamily(familyData.family || familyData)
      setChildren(childrenData.children || childrenData)
      setChores(choresData.chores || choresData)
      setWallets(walletsData.wallets || walletsData)
      setCompletions(completionsData.completions || completionsData)
      setMembers(membersData.members || [])
    } catch (error) {
      console.error('Failed to load dashboard:', error)
      setToast({ message: 'Failed to load dashboard data', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

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

    console.log('👂 Setting up WebSocket listeners for co-parent dashboard')

    // Listen for family settings updated (holiday mode, shop enable/disable, streak settings)
    const handleFamilySettingsUpdated = (data: any) => {
      console.log('📢 WebSocket: family:settings:updated received on CO-PARENT dashboard', data)
      const familyData = data.family
      
      if (familyData) {
        // Update family state immediately
        setFamily((prev: any) => {
          if (!prev) return familyData
          return {
            ...prev,
            ...familyData
          }
        })
      }
    }

    // Listen for completion created (child submits chore)
    const handleCompletionCreated = (data: any) => {
      console.log('📢 WebSocket: completion:created received', data)
      loadDashboard()
    }

    // Listen for completion approved (parent approves, child needs to see wallet update)
    const handleCompletionApproved = (data: any) => {
      console.log('📢 WebSocket: completion:approved received', data)
      loadDashboard()
    }

    // Listen for completion rejected (parent rejects, child needs to see status)
    const handleCompletionRejected = (data: any) => {
      console.log('📢 WebSocket: completion:rejected received', data)
      loadDashboard()
    }

    // Listen for chore created (parent creates chore, children need to see it)
    const handleChoreCreated = (data: any) => {
      console.log('📢 WebSocket: chore:created received', data)
      loadDashboard()
    }

    // Listen for assignment created (parent assigns chore to child)
    const handleAssignmentCreated = (data: any) => {
      console.log('📢 WebSocket: assignment:created received', data)
      loadDashboard()
    }

    // Listen for assignment deleted (parent removes chore assignment)
    const handleAssignmentDeleted = (data: any) => {
      console.log('📢 WebSocket: assignment:deleted received', data)
      loadDashboard()
    }

    // Listen for chore updated (parent updates chore details)
    const handleChoreUpdated = (data: any) => {
      console.log('📢 WebSocket: chore:updated received', data)
      loadDashboard()
    }

    // Listen for redemption created (child redeems gift)
    const handleRedemptionCreated = (data: any) => {
      console.log('📢 WebSocket: redemption:created received', data)
      loadDashboard()
    }

    // Listen for redemption fulfilled (parent fulfills redemption)
    const handleRedemptionFulfilled = (data: any) => {
      console.log('📢 WebSocket: redemption:fulfilled received', data)
      loadDashboard()
    }

    // Listen for redemption rejected (parent rejects redemption)
    const handleRedemptionRejected = (data: any) => {
      console.log('📢 WebSocket: redemption:rejected received', data)
      loadDashboard()
    }

    // Listen for gift created/updated (parent adds/updates gifts)
    const handleGiftCreated = (data: any) => {
      console.log('📢 WebSocket: gift:created received', data)
      loadDashboard()
    }

    const handleGiftUpdated = (data: any) => {
      console.log('📢 WebSocket: gift:updated received', data)
      loadDashboard()
    }

    // Listen for star purchase created (child buys stars)
    const handleStarPurchaseCreated = (data: any) => {
      console.log('📢 WebSocket: starPurchase:created received', data)
      loadDashboard()
    }

    // Listen for star purchase approved (parent approves, child needs to see wallet update)
    const handleStarPurchaseApproved = (data: any) => {
      console.log('📢 WebSocket: starPurchase:approved received', data)
      loadDashboard()
    }

    // Listen for star purchase rejected (parent rejects, child needs to see wallet update)
    const handleStarPurchaseRejected = (data: any) => {
      console.log('📢 WebSocket: starPurchase:rejected received', data)
      loadDashboard()
    }

    // Listen for child pause status updated (individual child holiday mode)
    const handleChildPauseUpdated = (data: any) => {
      console.log('📢 WebSocket: child:pause:updated received', data)
      loadDashboard()
    }

    // Register listeners
    on('family:settings:updated', handleFamilySettingsUpdated)
    on('completion:created', handleCompletionCreated)
    on('completion:approved', handleCompletionApproved)
    on('completion:rejected', handleCompletionRejected)
    on('chore:created', handleChoreCreated)
    on('chore:updated', handleChoreUpdated)
    on('assignment:created', handleAssignmentCreated)
    on('assignment:deleted', handleAssignmentDeleted)
    on('redemption:created', handleRedemptionCreated)
    on('redemption:fulfilled', handleRedemptionFulfilled)
    on('redemption:rejected', handleRedemptionRejected)
    on('gift:created', handleGiftCreated)
    on('gift:updated', handleGiftUpdated)
    on('starPurchase:created', handleStarPurchaseCreated)
    on('starPurchase:approved', handleStarPurchaseApproved)
    on('starPurchase:rejected', handleStarPurchaseRejected)
    on('child:pause:updated', handleChildPauseUpdated)

    // Cleanup
    return () => {
      off('family:settings:updated', handleFamilySettingsUpdated)
      off('completion:created', handleCompletionCreated)
      off('completion:approved', handleCompletionApproved)
      off('completion:rejected', handleCompletionRejected)
      off('chore:created', handleChoreCreated)
      off('chore:updated', handleChoreUpdated)
      off('assignment:created', handleAssignmentCreated)
      off('assignment:deleted', handleAssignmentDeleted)
      off('redemption:created', handleRedemptionCreated)
      off('redemption:fulfilled', handleRedemptionFulfilled)
      off('redemption:rejected', handleRedemptionRejected)
      off('gift:created', handleGiftCreated)
      off('gift:updated', handleGiftUpdated)
      off('starPurchase:created', handleStarPurchaseCreated)
      off('starPurchase:approved', handleStarPurchaseApproved)
      off('starPurchase:rejected', handleStarPurchaseRejected)
      off('child:pause:updated', handleChildPauseUpdated)
    }
  }, [socket, isConnected, on, off, loadDashboard])

  const handleApproveCompletion = async (completionId: string) => {
    try {
      await apiClient.approveCompletion(completionId)
      setToast({ message: '✅ Completion approved!', type: 'success' })
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)
      await loadDashboard()
    } catch (error) {
      console.error('Failed to approve completion:', error)
      setToast({ message: 'Failed to approve completion', type: 'error' })
    }
  }

  const handleRejectCompletion = async (completionId: string) => {
    try {
      await apiClient.rejectCompletion(completionId)
      setToast({ message: '❌ Completion rejected', type: 'success' })
      await loadDashboard()
    } catch (error) {
      console.error('Failed to reject completion:', error)
      setToast({ message: 'Failed to reject completion', type: 'error' })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your family...</p>
        </div>
      </div>
    )
  }

  const pendingCompletions = completions.filter(c => c.status === 'pending')

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                👨‍👩‍👧‍👦 Co-Parent Dashboard
              </h1>
              <p className="text-gray-600 text-sm">
                {family?.nameCipher || 'Family'} • {user?.email?.split('@')[0]}
              </p>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <button onClick={logout} className="min-h-[44px] px-4 py-3 sm:px-4 sm:py-2 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full font-semibold text-sm sm:text-base transition-all touch-manipulation flex items-center justify-center">
                👋 Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Message */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-2xl p-6 mb-8 shadow-xl">
          <h2 className="text-2xl font-bold mb-2">Welcome, Co-Parent! 👨‍👩‍👧‍👦</h2>
          <p className="text-white/90">
            You can help manage chores and approve completions, but you cannot invite other parents or change family settings.
          </p>
        </div>

        {/* Overview Tiles */}
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">👶</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Children</p>
                <p className="text-2xl font-bold text-blue-600">{children.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-green-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Chores</p>
                <p className="text-2xl font-bold text-green-600">{chores.filter(c => c.active).length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-yellow-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">⏳</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending Approvals</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingCompletions.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-purple-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">⭐</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Stars</p>
                <p className="text-2xl font-bold text-purple-600">
                  {wallets.reduce((sum, w) => sum + (w.stars || 0), 0)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pending Approvals */}
        {pendingCompletions.length > 0 && (
          <section className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Pending Approvals ⏳</h3>
            <div className="space-y-4">
              {pendingCompletions.map((completion) => {
                const child = children.find(c => c.id === completion.childId)
                const chore = chores.find(c => c.id === completion.assignment?.choreId)
                return (
                  <div key={completion.id} className="bg-white rounded-xl p-6 shadow-lg border border-yellow-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-gray-800">{child?.nickname} completed "{chore?.title}"</h4>
                        <p className="text-sm text-gray-600">
                          {completion.submittedAt ? new Date(completion.submittedAt).toLocaleDateString() : 'Recently'}
                        </p>
                        {completion.note && (
                          <p className="text-sm text-gray-700 mt-2 italic">"{completion.note}"</p>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-0">
                        <button
                          onClick={() => handleRejectCompletion(completion.id)}
                          className="min-h-[44px] flex-1 px-4 py-3 sm:py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 active:bg-red-700 transition-colors touch-manipulation"
                        >
                          ❌ Reject
                        </button>
                        <button
                          onClick={() => handleApproveCompletion(completion.id)}
                          className="min-h-[44px] flex-1 px-4 py-3 sm:py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 active:bg-green-700 transition-colors touch-manipulation"
                        >
                          ✅ Approve
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Children Overview */}
        <section className="mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Children Overview 👶</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => {
              const childWallet = wallets.find(w => w.childId === child.id)
              return (
                <div key={child.id} className="bg-white rounded-xl p-6 shadow-lg border border-purple-100">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white text-xl font-bold">
                      {child.nickname.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">{child.nickname}</h4>
                      <p className="text-sm text-gray-600">{child.ageGroup} years old</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Stars:</span>
                      <span className="font-bold text-yellow-600">⭐ {childWallet?.stars || 0}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Pocket Money:</span>
                      <span className="font-bold text-green-600">
                        £{(childWallet?.balancePence || 0) / 100}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Family Chat - Only show if enabled for this user */}
        {(() => {
          const currentMember = members.find((m: any) => m.user?.id === user?.id)
          const chatEnabled = currentMember?.chatEnabled !== false // Default to true if not set
          
          if (!chatEnabled) return null
          
          return (
            <section className="mb-8">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Family Chat 💬</h3>
              <div className="bg-white rounded-xl shadow-lg border border-purple-100">
                <FamilyChat 
                  compact={true} 
                  maxMessages={6}
                  days={2}
                  onOpenFull={() => setShowChatModal(true)}
                />
              </div>
            </section>
          )
        })()}

        {/* Co-Parent Permissions Info */}
        <section className="mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Your Permissions ℹ️</h3>
          <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">✅ What You Can Do:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• View all children and their progress</li>
                  <li>• Approve or reject chore completions</li>
                  <li>• View family activity and statistics</li>
                  <li>• Send gifts to children</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">❌ What You Cannot Do:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Invite other parents or family members</li>
                  <li>• Change family settings or budget</li>
                  <li>• Delete children or family data</li>
                  <li>• Access admin functions</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Chat Modal */}
      {showChatModal && (() => {
        const currentMember = members.find((m: any) => m.user?.id === user?.id)
        const chatEnabled = currentMember?.chatEnabled !== false
        
        if (!chatEnabled) return null
        
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 p-6">
                <h3 className="text-2xl font-bold text-purple-600">💬 Family Chat</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setChatTab('recent')}
                    className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                      chatTab === 'recent'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
                    }`}
                  >
                    Recent (2 days)
                  </button>
                  <button
                    onClick={() => setChatTab('history')}
                    className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                      chatTab === 'history'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
                    }`}
                  >
                    History (2 months)
                  </button>
                  <button
                    onClick={() => setShowChatModal(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl font-light w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
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

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-6 py-3 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
            {toast.message}
          </div>
        </div>
      )}

      {/* Confetti */}
      <Confetti active={showConfetti} />
    </div>
  )
}

export default CoParentDashboard
















