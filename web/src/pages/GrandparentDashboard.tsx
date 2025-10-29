import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api'
import Confetti from 'react-confetti'

const GrandparentDashboard: React.FC = () => {
  const { user, logout } = useAuth()
  const [family, setFamily] = useState<any>(null)
  const [children, setChildren] = useState<any[]>([])
  const [wallets, setWallets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const [familyData, childrenData, walletsData] = await Promise.all([
        apiClient.getFamily(),
        apiClient.getChildren(),
        apiClient.getWallets()
      ])
      
      setFamily(familyData)
      setChildren(childrenData)
      setWallets(walletsData)
    } catch (error) {
      console.error('Failed to load dashboard:', error)
      setToast({ message: 'Failed to load dashboard data', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

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
              <button onClick={logout} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full font-semibold text-sm transition-all">
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
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSendGift(child.id, 100)}
                        className="flex-1 px-3 py-2 bg-purple-500 text-white rounded-lg text-sm font-semibold hover:bg-purple-600 transition-colors"
                      >
                        £1 Gift
                      </button>
                      <button
                        onClick={() => handleSendGift(child.id, 500)}
                        className="flex-1 px-3 py-2 bg-pink-500 text-white rounded-lg text-sm font-semibold hover:bg-pink-600 transition-colors"
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









