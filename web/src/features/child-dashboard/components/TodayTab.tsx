import React, { useMemo, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useChildDashboardData } from '../hooks/useChildDashboardData'
import { apiClient } from '../../../lib/api'
import { handleApiError } from '../../../utils/errorHandler'
import { notifyUpdate } from '../../../utils/notifications'
import CompletionModal from '../modals/CompletionModal'

interface Assignment {
  id: string
  choreId: string
  childId?: string | null
  biddingEnabled?: boolean
  createdAt: string
  chore?: {
    id: string
    title: string
    description?: string
    frequency: 'daily' | 'weekly' | 'once'
    proof: 'none' | 'photo' | 'note'
    baseRewardPence: number
    starsOverride?: number
    active: boolean
  }
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

const filterActiveAssignments = (assignments: Assignment[], completions: Completion[]): Assignment[] => {
  const filtered = assignments.filter((a) => {
    const assignmentCompletions = completions.filter((c) => c.assignmentId === a.id)
    const hasApprovedCompletion = assignmentCompletions.some((c) => c.status === 'approved')

    if (!a.chore?.active || hasApprovedCompletion) return false

    if (a.chore.frequency === 'daily') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const assignmentDate = new Date(a.createdAt)
      assignmentDate.setHours(0, 0, 0, 0)
      return assignmentDate.getTime() === today.getTime()
    }

    if (a.chore.frequency === 'weekly') {
      return !hasApprovedCompletion
    }

    return true
  })

  const weeklyChores = new Map<string, Assignment>()
  const otherAssignments: Assignment[] = []

  filtered.forEach((a) => {
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
}

const TodayTab: React.FC = () => {
  const { user } = useAuth()
  const {
    assignments,
    completions,
    holidayMode,
    choreChampions,
    allChoreStreaks,
    refresh,
  } = useChildDashboardData('today')

  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null)

  const activeAssignments = useMemo(
    () => filterActiveAssignments(assignments, completions),
    [assignments, completions],
  )

  const handleMarkAsDone = (assignment: Assignment) => {
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

    setSelectedAssignment(assignment)
    setShowCompletionModal(true)
  }

  const handleCompletionSubmitted = async () => {
    setShowCompletionModal(false)
    setSelectedAssignment(null)
    setToast({ message: '✨ Nice work! Submitted for approval', type: 'success' })
    notifyUpdate('completionUpdated')
    await new Promise((resolve) => setTimeout(resolve, 300))
    await refresh()
  }

  const recentCompletions = useMemo(() => completions.slice(0, 7), [completions])

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : toast.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}
        >
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 text-xs font-semibold uppercase tracking-wide hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

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
        <span className="cb-chip bg-[var(--success)]/10 text-[var(--success)]">{activeAssignments.length} active</span>
      </div>

      {activeAssignments.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-8xl mb-4">🎉</div>
          <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">All caught up!</h3>
          <p className="text-[var(--text-secondary)]">No pending chores right now. Great work!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeAssignments.map((assignment) => {
            const chore = assignment.chore
            if (!chore) return null

            const choreStreak = allChoreStreaks.get(chore.id)
            const champion = choreChampions.get(assignment.id)
            const isChampion = champion && champion.childId === (user?.childId || user?.id)
            const hasBids = choreChampions.has(assignment.id)
            const canComplete = !assignment.biddingEnabled || (hasBids && isChampion)

            return (
              <div
                key={assignment.id}
                className="bg-gradient-to-br from-[#1e2235] to-[#252a42] border-2 border-[var(--primary)]/30 rounded-3xl overflow-hidden hover:shadow-2xl hover:border-[var(--primary)]/60 transition-all hover:-translate-y-2"
              >
                <div className="h-3 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]"></div>

                <div className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 shadow-lg">
                      🧹
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-white mb-1 flex items-center gap-2">
                        {choreStreak && choreStreak.current > 0 && (
                          <span className="text-orange-400" title={`${choreStreak.current} day streak!`}>
                            🔥 {choreStreak.current}
                          </span>
                        )}
                        {chore.title}
                      </h3>
                      <p className="text-sm text-gray-300 line-clamp-2">{chore.description || 'Complete this task to earn stars!'}</p>
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
                    <div className="mb-3 text-xs text-center text-gray-400 bg-white/5 rounded-lg py-2">📝 Explanation note required</div>
                  )}

                  {assignment.biddingEnabled && (
                    <div className="mb-3">
                      <div className="text-xs text-center text-orange-300 font-semibold bg-orange-500/20 rounded-lg py-2 mb-2">
                        ⚔️ CHALLENGE MODE
                      </div>
                      {!hasBids ? (
                        <div className="text-xs text-center text-gray-300 bg-red-500/20 rounded-lg py-2">
                          🔒 No one claimed yet! Go to Showdown to claim it
                        </div>
                      ) : isChampion ? (
                        <div className="text-xs text-center text-yellow-300 font-bold bg-yellow-500/30 rounded-lg py-2 border-2 border-yellow-400 animate-pulse">
                          👑 YOU'RE THE CHAMPION! You can complete this!
                        </div>
                      ) : (
                        <div className="text-xs text-center text-gray-300 bg-red-500/20 rounded-lg py-2">
                          🔒 {champion?.child?.nickname} claimed this! Beat their offer in Showdown
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => handleMarkAsDone(assignment)}
                    className={`w-full py-3 text-sm font-bold shadow-lg transition-all ${
                      !canComplete
                        ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                        : 'cb-button-primary hover:scale-105'
                    }`}
                    disabled={!canComplete}
                  >
                    {assignment.biddingEnabled && isChampion ? '🏆 Do It & Win!' : '✅ Mark as Done'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {recentCompletions.length > 0 && (
        <div className="mt-8">
          <h3 className="cb-heading-md text-[var(--text-secondary)] mb-4">📋 Recent Activity</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentCompletions.map((completion) => {
              const assignment = assignments.find((a) => a.id === completion.assignmentId)
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
                      label: 'Waiting for approval',
                    }
                  case 'approved':
                    return {
                      bg: 'bg-green-100',
                      text: 'text-green-700',
                      border: 'border-green-300',
                      icon: '✅',
                      label: 'Approved',
                    }
                  case 'rejected':
                    return {
                      bg: 'bg-red-100',
                      text: 'text-red-700',
                      border: 'border-red-300',
                      icon: '❌',
                      label: 'Not approved',
                    }
                  default:
                    return {
                      bg: 'bg-gray-100',
                      text: 'text-gray-700',
                      border: 'border-gray-300',
                      icon: '📝',
                      label: 'Submitted',
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
                timeDisplay = `Today ${completionDate.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}`
              } else if (completionDay.getTime() === yesterday.getTime()) {
                timeDisplay = `Yesterday ${completionDate.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}`
              } else {
                timeDisplay = completionDate.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: completionDay.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
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
                      <h4 className="font-bold text-sm text-white truncate">{chore.title}</h4>
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

      {showCompletionModal && selectedAssignment && (
        <CompletionModal
          assignment={selectedAssignment}
          onClose={() => {
            setShowCompletionModal(false)
            setSelectedAssignment(null)
          }}
          onSubmitted={handleCompletionSubmitted}
        />
      )}
    </div>
  )
}

export default TodayTab

