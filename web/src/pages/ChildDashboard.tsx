import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api'

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

interface LeaderboardEntry {
  childId: string
  nickname: string
  totalStars: number
}

type Tab = 'today' | 'streaks' | 'shop' | 'showdown'

const ChildDashboard: React.FC = () => {
  const { user, logout } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [chores, setChores] = useState<Chore[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [completions, setCompletions] = useState<any[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string>('')
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [activeTab, setActiveTab] = useState<Tab>('today')
  
  // Completion modal state
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null)
  const [completionNote, setCompletionNote] = useState('')
  const [completingChore, setCompletingChore] = useState(false)

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

  const loadDashboard = async () => {
    try {
      setError('')
      const childId = user?.childId || user?.id || ''

      const [walletRes, assignmentsRes, completionsRes, rewardsRes, leaderboardRes] = await Promise.allSettled([
        apiClient.getWallet(childId),
        apiClient.listAssignments(childId),
        apiClient.listCompletions(), // Get all completions to filter out submitted chores
        apiClient.getRewards(childId),
        apiClient.getLeaderboard()
      ])

      if (walletRes.status === 'fulfilled') {
        setWallet(walletRes.value.wallet)
      }
      if (assignmentsRes.status === 'fulfilled') {
        setAssignments(assignmentsRes.value.assignments || [])
      }
      if (completionsRes.status === 'fulfilled') {
        setCompletions(completionsRes.value.completions || [])
      }
      if (rewardsRes.status === 'fulfilled') {
        setRewards(rewardsRes.value.rewards || [])
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
    } catch (err: any) {
      console.error('Error loading dashboard:', err)
      setError(err.message || 'Failed to load dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMarkAsDone = (assignment: any) => {
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
      
      // Reload dashboard to show updated status
      await loadDashboard()
      
      // Show success message with auto-dismiss
      setSuccessMessage('Nice work! Submitted for approval ✓')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      console.error('Failed to submit completion:', error)
      setError('Failed to submit. Please try again.')
      setTimeout(() => setError(''), 3000)
    } finally {
      setCompletingChore(false)
    }
  }

  const totalStars = Math.floor((wallet?.balancePence || 0) / 10) // 10p = 1 star

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
                Hey Champion! 🌟
              </h1>
              <p className="text-white/90 text-lg">Time to earn those stars!</p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full font-semibold text-sm backdrop-blur transition-all"
            >
              👋 Logout
            </button>
          </div>

          {/* Star Bank Card */}
          <div className="bg-white/10 backdrop-blur-md border-2 border-white/20 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white/80 text-sm font-semibold uppercase tracking-wide">Your Star Bank</p>
                <p className="text-6xl font-bold mt-2">{totalStars}⭐</p>
              </div>
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-4xl animate-pulse">
                💰
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex-1 bg-white/10 rounded-xl p-3">
                <p className="text-white/70">Balance</p>
                <p className="font-bold text-lg">£{((wallet?.balancePence || 0) / 100).toFixed(2)}</p>
              </div>
              <div className="flex-1 bg-white/10 rounded-xl p-3">
                <p className="text-white/70">Streak</p>
                <p className="font-bold text-lg">🔥 0 days</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="sticky top-0 z-30 bg-white border-b-2 border-[var(--card-border)] shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto py-3">
            {[
              { id: 'today' as Tab, label: 'Today', icon: '📅' },
              { id: 'streaks' as Tab, label: 'Streaks', icon: '🔥' },
              { id: 'shop' as Tab, label: 'Shop', icon: '🛍️' },
              { id: 'showdown' as Tab, label: 'Showdown', icon: '⚔️' }
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
            <div className="flex items-center justify-between">
              <h2 className="cb-heading-lg text-[var(--primary)]">🎯 Today's Missions</h2>
              <span className="cb-chip bg-[var(--success)]/10 text-[var(--success)]">
                {assignments.filter(a => {
                  const hasCompletion = completions.some(c => c.assignmentId === a.id)
                  return a.chore?.active && !hasCompletion
                }).length} active
              </span>
            </div>

            {assignments.filter(a => {
              const hasCompletion = completions.some(c => c.assignmentId === a.id)
              return a.chore?.active && !hasCompletion
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
                  return a.chore?.active && !hasCompletion
                }).map((assignment) => {
                  const chore = assignment.chore
                  return (
                    <div
                      key={assignment.id}
                      className="bg-white border-2 border-[var(--card-border)] rounded-3xl overflow-hidden hover:shadow-2xl transition-all hover:-translate-y-2"
                    >
                      {/* Gradient top bar */}
                      <div className="h-3 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]"></div>
                      
                      <div className="p-6">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 shadow-lg">
                            🧹
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-1">
                              {chore.title}
                            </h3>
                            <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                              {chore.description || 'Complete this task to earn stars!'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                          <span className="flex-1 cb-chip bg-[var(--success)]/10 text-[var(--success)] text-center">
                            💰 £{(chore.baseRewardPence / 100).toFixed(2)}
                          </span>
                          <span className="flex-1 cb-chip bg-[var(--secondary)]/10 text-[var(--secondary)] text-center">
                            {chore.frequency === 'daily' ? '📅 Daily' : chore.frequency === 'weekly' ? '📆 Weekly' : '🎯 Once'}
                          </span>
                        </div>

                        {chore.proof === 'note' && (
                          <div className="mb-3 text-xs text-center text-[var(--text-secondary)]">
                            📝 Explanation note required
                          </div>
                        )}

                        {assignment.biddingEnabled && (
                          <div className="mb-3 text-xs text-center text-purple-600 font-semibold">
                            ⚔️ Rivalry Mode Active
                          </div>
                        )}

                        <button 
                          onClick={() => handleMarkAsDone(assignment)}
                          className="w-full cb-button-primary py-3 text-sm hover:scale-105 transition-transform"
                        >
                          ✅ Mark as Done
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Streaks Tab */}
        {activeTab === 'streaks' && (
          <div className="space-y-6">
            <h2 className="cb-heading-lg text-[var(--primary)]">🔥 Your Streaks</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="cb-card bg-gradient-to-br from-orange-400 to-red-500 text-white p-6">
                <div className="text-6xl mb-4">🔥</div>
                <h3 className="text-3xl font-bold mb-2">0 Days</h3>
                <p className="text-white/90">Current Streak</p>
              </div>
              <div className="cb-card bg-gradient-to-br from-purple-400 to-pink-500 text-white p-6">
                <div className="text-6xl mb-4">🏆</div>
                <h3 className="text-3xl font-bold mb-2">0 Days</h3>
                <p className="text-white/90">Best Streak</p>
              </div>
              <div className="cb-card bg-gradient-to-br from-green-400 to-teal-500 text-white p-6">
                <div className="text-6xl mb-4">⭐</div>
                <h3 className="text-3xl font-bold mb-2">+0</h3>
                <p className="text-white/90">Streak Bonus</p>
              </div>
            </div>
          </div>
        )}

        {/* Shop Tab */}
        {activeTab === 'shop' && (
          <div className="space-y-6">
            <h2 className="cb-heading-lg text-[var(--primary)]">🛍️ Rewards Shop</h2>
            {rewards.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-8xl mb-4">🎁</div>
                <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">No rewards yet!</h3>
                <p className="text-[var(--text-secondary)]">Ask your parents to add some rewards!</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                          disabled={totalStars < reward.starsRequired}
                          className={`px-4 py-2 rounded-full font-bold text-sm ${
                            totalStars >= reward.starsRequired
                              ? 'bg-[var(--primary)] text-white hover:scale-105'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          } transition-all`}
                        >
                          {totalStars >= reward.starsRequired ? '🎉 Claim' : '🔒 Locked'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Showdown Tab */}
        {activeTab === 'showdown' && (
          <div className="space-y-6">
            <h2 className="cb-heading-lg text-[var(--primary)]">⚔️ Sibling Showdown</h2>
            <div className="cb-card bg-gradient-to-br from-purple-500 to-pink-500 text-white p-8 text-center">
              <div className="text-8xl mb-4">👑</div>
              <h3 className="text-3xl font-bold mb-2">Who's the Champion?</h3>
              <p className="text-white/90 mb-6">Weekly leaderboard resets every Monday</p>
            </div>

            <div className="space-y-3">
              {leaderboard.length === 0 ? (
                <div className="text-center py-12">
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
            { id: 'streaks' as Tab, icon: '🔥', label: 'Streaks' },
            { id: 'shop' as Tab, icon: '🛍️', label: 'Shop' },
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
    </div>
  )
}

export default ChildDashboard
