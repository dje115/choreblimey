import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api'
import { useSocket } from '../contexts/SocketContext'
import Confetti from 'react-confetti'
import { FamilyChat } from '../components/FamilyChat'

const GrandparentDashboard: React.FC = () => {
  const { user, logout } = useAuth()
  const [family, setFamily] = useState<any>(null)
  const [children, setChildren] = useState<any[]>([])
  const [wallets, setWallets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [members, setMembers] = useState<any[]>([]) // Family members to check chatEnabled
  const [showChatModal, setShowChatModal] = useState(false) // For full chat modal
  const [chatTab, setChatTab] = useState<'recent' | 'history'>('recent') // Chat modal tabs

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const [familyData, childrenData, walletsData, membersData] = await Promise.all([
        apiClient.getFamily(),
        apiClient.getChildren(),
        apiClient.getWallets(),
        apiClient.getFamilyMembers()
      ])
      
      setFamily(familyData.family || familyData)
      setChildren(childrenData.children || childrenData)
      setWallets(walletsData.wallets || walletsData)
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

    console.log('👂 Setting up WebSocket listeners for grandparent dashboard')

    // Listen for family settings updated (holiday mode, shop enable/disable, streak settings)
    const handleFamilySettingsUpdated = (data: any) => {
      console.log('📢 WebSocket: family:settings:updated received on GRANDPARENT dashboard', data)
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

    // Listen for completion approved (to see wallet updates)
    const handleCompletionApproved = (data: any) => {
      console.log('📢 WebSocket: completion:approved received', data)
      loadDashboard()
    }

    // Listen for gift created/updated (to see new/updated gifts)
    const handleGiftCreated = (data: any) => {
      console.log('📢 WebSocket: gift:created received', data)
      loadDashboard()
    }

    const handleGiftUpdated = (data: any) => {
      console.log('📢 WebSocket: gift:updated received', data)
      loadDashboard()
    }

    // Listen for redemption fulfilled (to see when gifts are redeemed)
    const handleRedemptionFulfilled = (data: any) => {
      console.log('📢 WebSocket: redemption:fulfilled received', data)
      loadDashboard()
    }

    // Listen for child pause status updated (individual child holiday mode)
    const handleChildPauseUpdated = (data: any) => {
      console.log('📢 WebSocket: child:pause:updated received', data)
      loadDashboard()
    }

    // Register listeners
    on('family:settings:updated', handleFamilySettingsUpdated)
    on('completion:approved', handleCompletionApproved)
    on('gift:created', handleGiftCreated)
    on('gift:updated', handleGiftUpdated)
    on('redemption:fulfilled', handleRedemptionFulfilled)
    on('child:pause:updated', handleChildPauseUpdated)

    // Cleanup
    return () => {
      off('family:settings:updated', handleFamilySettingsUpdated)
      off('completion:approved', handleCompletionApproved)
      off('gift:created', handleGiftCreated)
      off('gift:updated', handleGiftUpdated)
      off('redemption:fulfilled', handleRedemptionFulfilled)
      off('child:pause:updated', handleChildPauseUpdated)
    }
  }, [socket, isConnected, on, off, loadDashboard])

  const handleSendGift = async (childId: string, amount: number) => {
    try {
      await apiClient.sendGift(childId, amount)
      setToast({ message: '🎁 Gift sent successfully!', type: 'success' })
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)
      await loadDashboard()
    } catch (error) {
      console.error('Failed to send gift:', error)
      setToast({ message: 'Failed to send gift', type: 'error' })
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                👴👵 Grandparent Dashboard
              </h1>
              <p className="text-gray-600 text-sm">
                {family?.nameCipher || 'Family'} • {user?.email?.split('@')[0]}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={logout} className="min-h-[44px] px-4 py-3 sm:px-4 sm:py-2 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full font-semibold text-sm sm:text-base transition-all touch-manipulation flex items-center justify-center">
                👋 Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Message */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl p-6 mb-8 shadow-xl">
          <h2 className="text-2xl font-bold mb-2">Welcome, Grandparent! 👴👵</h2>
          <p className="text-white/90">
            You can view your grandchildren's progress and send them special gifts to encourage their good behavior!
          </p>
        </div>

        {/* Children Overview */}
        <section className="mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Your Grandchildren 👶</h3>
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
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Stars Earned:</span>
                      <span className="font-bold text-yellow-600">⭐ {childWallet?.stars || 0}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Pocket Money:</span>
                      <span className="font-bold text-green-600">
                        £{(childWallet?.balancePence || 0) / 100}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h5 className="font-semibold text-gray-700 mb-2">Send a Gift 💝</h5>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <button
                        onClick={() => handleSendGift(child.id, 100)}
                        className="min-h-[44px] flex-1 px-4 py-3 sm:px-3 sm:py-2 bg-purple-500 text-white rounded-lg text-sm sm:text-base font-semibold hover:bg-purple-600 active:bg-purple-700 transition-colors touch-manipulation"
                      >
                        £1 Gift
                      </button>
                      <button
                        onClick={() => handleSendGift(child.id, 500)}
                        className="min-h-[44px] flex-1 px-4 py-3 sm:px-3 sm:py-2 bg-pink-500 text-white rounded-lg text-sm sm:text-base font-semibold hover:bg-pink-600 active:bg-pink-700 transition-colors touch-manipulation"
                      >
                        £5 Gift
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Activity 📈</h3>
          <div className="bg-white rounded-xl p-6 shadow-lg border border-purple-100">
            <p className="text-gray-600 text-center py-8">
              Activity tracking coming soon! You'll be able to see your grandchildren's recent achievements here.
            </p>
          </div>
        </section>

        {/* Grandparent Tips */}
        <section className="mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Grandparent Tips 💡</h3>
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-yellow-800 mb-2">🎁 Gift Ideas</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Send small gifts for completed chores</li>
                  <li>• Celebrate special achievements</li>
                  <li>• Encourage good behavior with rewards</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-yellow-800 mb-2">👨‍👩‍👧‍👦 Family Connection</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Stay connected with grandchildren</li>
                  <li>• Support their learning journey</li>
                  <li>• Celebrate their achievements together</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>

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

export default GrandparentDashboard
















