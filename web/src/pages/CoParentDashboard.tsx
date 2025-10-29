import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api'
import Confetti from 'react-confetti'

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

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const [familyData, childrenData, choresData, walletsData, completionsData] = await Promise.all([
        apiClient.getFamily(),
        apiClient.getChildren(),
        apiClient.getChores(),
        apiClient.getWallets(),
        apiClient.getCompletions()
      ])
      
      setFamily(familyData)
      setChildren(childrenData)
      setChores(choresData)
      setWallets(walletsData)
      setCompletions(completionsData)
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRejectCompletion(completion.id)}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors"
                        >
                          ❌ Reject
                        </button>
                        <button
                          onClick={() => handleApproveCompletion(completion.id)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
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









