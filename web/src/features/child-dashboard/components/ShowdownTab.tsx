import React, { useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useChildDashboardData } from '../hooks/useChildDashboardData'
import { apiClient } from '../../../lib/api'
import { handleApiError } from '../../../utils/errorHandler'
import { notifyUpdate } from '../../../utils/notifications'

interface LeaderboardEntry {
  childId: string
  nickname: string
  totalStars: number
  completedChores?: number
  totalRewardPence?: number
  [key: string]: any
}

const ShowdownTab: React.FC = () => {
  const { user } = useAuth()
  const {
    assignments,
    completions,
    choreChampions,
    choreBids,
    choreStreaks,
    leaderboard,
    refresh,
  } = useChildDashboardData('showdown')

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)

  // Filter assignments where bidding is enabled AND not already completed/submitted
  const biddingChores = assignments.filter((a: any) => {
    const hasCompletion = completions.some((c) => c.assignmentId === a.id)
    return a.biddingEnabled && a.chore?.active && !hasCompletion
  })

  const handlePlaceBid = async (assignmentId: string, bidAmount: number, champion: any, baseReward: number) => {
    if (!user?.childId && !user?.id) return

    const childId = user.childId || user.id

    // Validation
    if (!bidAmount || bidAmount < 0.01) {
      setToast({ message: `Offer must be at least £0.01!`, type: 'error' })
      return
    }

    const hasChampion = Boolean(champion)
    const isChampion = champion && champion.childId === childId

    if (hasChampion && !isChampion) {
      // Stealing: must be less than current champion's bid
      if (bidAmount >= champion.amountPence / 100) {
        setToast({ message: `Must be LESS than £${(champion.amountPence / 100).toFixed(2)} to steal it!`, type: 'error' })
        return
      }
    } else {
      // Claiming: must be up to base reward
      if (bidAmount > baseReward / 100) {
        setToast({ message: `Can't offer more than £${(baseReward / 100).toFixed(2)} (the usual price)!`, type: 'error' })
        return
      }
    }

    try {
      await apiClient.competeInBid({
        assignmentId,
        childId,
        amountPence: Math.round(bidAmount * 100),
        targetChildId: champion?.childId,
      })

      setToast({
        message:
          hasChampion && !isChampion
            ? `😎 You stole it! You're the new champion!`
            : `🎯 You claimed it! £${bidAmount.toFixed(2)} - Go complete it!`,
        type: 'success',
      })
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 2000)
      notifyUpdate('assignmentUpdated')
      await refresh()
    } catch (error: any) {
      const appError = handleApiError(error, 'Placing bid')
      setToast({ message: appError.message || 'Failed. Try again!', type: 'error' })
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
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

      {/* Bidding Chores */}
      <div>
        <h3 className="cb-heading-md text-[var(--primary)] mb-4">🎯 Challenge Chores</h3>
        {biddingChores.length === 0 ? (
          <div className="cb-card p-8 text-center">
            <div className="text-6xl mb-4">😴</div>
            <h4 className="font-bold text-[var(--text-primary)] mb-2">No Challenge Chores</h4>
            <p className="text-[var(--text-secondary)]">Ask your parents to turn on Challenge Mode for some chores!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {biddingChores.map((assignment: any) => {
              const chore = assignment.chore
              const baseReward = chore.baseRewardPence
              const minBid = 1 // 1 pence minimum
              const maxBid = baseReward
              const champion = choreChampions.get(assignment.id)
              const isChampion = champion && champion.childId === (user?.childId || user?.id)
              const hasChampion = Boolean(champion)
              const streak = choreStreaks.get(assignment.id)
              const hasMyStreak = streak && !streak.isDisrupted
              const streakDays = streak?.current || 0
              const bids = choreBids.get(assignment.id) || []

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
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl flex-shrink-0 ${
                        isChampion ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 animate-pulse' : 'bg-gradient-to-br from-orange-400 to-red-500'
                      }`}
                    >
                      {isChampion ? '👑' : '🔥'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-xl text-[var(--text-primary)]">{chore.title}</h4>
                        {hasMyStreak && streakDays >= 2 && (
                          <span className="cb-chip bg-orange-500 text-white text-xs font-bold animate-pulse">🔥 {streakDays}-day streak!</span>
                        )}
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] mb-3">{chore.description || 'Offer to do this for less to win!'}</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="cb-chip bg-yellow-500 text-white font-bold">🏆 WIN: 2⭐ (DOUBLE STARS!)</span>
                        <span className="cb-chip bg-orange-200 text-orange-800">💰 Usually pays: £{(baseReward / 100).toFixed(2)}</span>
                        <span className="cb-chip bg-green-200 text-green-800">💪 You get your bid + bonus star!</span>
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
                  {bids.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-sm font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">📊 Current Offers:</h5>
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
                              <div className="text-2xl">{isCurrentChampion ? '👑' : isMyBid ? '💪' : '😐'}</div>
                              <div className="flex-1">
                                <p
                                  className={`font-bold text-sm ${
                                    isCurrentChampion && isMyBid
                                      ? 'text-yellow-800'
                                      : isCurrentChampion
                                      ? 'text-red-800'
                                      : isMyBid
                                      ? 'text-blue-800'
                                      : 'text-gray-700'
                                  }`}
                                >
                                  {isMyBid ? 'You' : bid.child?.nickname}
                                  {isCurrentChampion && ' (WINNING!)'}
                                </p>
                                <p className="text-xs text-gray-600">Offered £{(bid.amountPence / 100).toFixed(2)}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Champion Status */}
                      {hasChampion && (
                        <div className={`mt-3 rounded-xl p-3 border-2 ${isChampion ? 'bg-yellow-100 border-yellow-400' : 'bg-red-100 border-red-400'}`}>
                          <p className={`text-xs font-bold ${isChampion ? 'text-yellow-800' : 'text-red-800'}`}>
                            {isChampion
                              ? `✨ You have the lowest offer! Go to Today tab to complete it!`
                              : `⚠️ ${champion.child?.nickname} has the lowest offer! Offer less to steal it!`}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Claim/Steal Area */}
                  <div className="bg-white rounded-xl p-4 border-2 border-orange-300">
                    <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                      {hasChampion && !isChampion
                        ? `💪 STEAL IT! Offer less than £${(champion.amountPence / 100).toFixed(2)}:`
                        : `💪 I'll Do It For (up to £${(baseReward / 100).toFixed(2)}):`}
                    </p>
                    <BidInput
                      assignmentId={assignment.id}
                      minBid={minBid}
                      maxBid={maxBid}
                      champion={champion}
                      baseReward={baseReward}
                      onPlaceBid={handlePlaceBid}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
            leaderboard.map((entry: LeaderboardEntry, index: number) => (
              <div
                key={entry.childId}
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 ${
                  index === 0 ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 border-yellow-400' : 'bg-white border-[var(--card-border)]'
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
                    {entry.completedChores || 0} chore{(entry.completedChores || 0) !== 1 ? 's' : ''} • £{((entry.totalRewardPence || 0) / 100).toFixed(2)} earned
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
  )
}

interface BidInputProps {
  assignmentId: string
  minBid: number
  maxBid: number
  champion: any
  baseReward: number
  onPlaceBid: (assignmentId: string, bidAmount: number, champion: any, baseReward: number) => Promise<void>
}

const BidInput: React.FC<BidInputProps> = ({ assignmentId, minBid, maxBid, champion, baseReward, onPlaceBid }) => {
  const [bidAmount, setBidAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const hasChampion = Boolean(champion)
  const maxBidAmount = hasChampion ? (champion.amountPence - 1) / 100 : maxBid / 100
  const placeholder = hasChampion ? `Less than £${(champion.amountPence / 100).toFixed(2)}` : `Up to £${(baseReward / 100).toFixed(2)}`

  const handleSubmit = async () => {
    const amount = parseFloat(bidAmount)
    if (!amount || amount < 0.01) {
      return
    }
    setIsSubmitting(true)
    try {
      await onPlaceBid(assignmentId, amount, champion, baseReward)
      setBidAmount('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="flex gap-3">
        <input
          type="number"
          min="0.01"
          max={maxBidAmount.toFixed(2)}
          step="0.01"
          placeholder={placeholder}
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
          className="flex-1 px-4 py-3 border-2 border-[var(--card-border)] rounded-lg focus:border-orange-500 focus:outline-none"
        />
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !bidAmount || parseFloat(bidAmount) < 0.01}
          className={`px-6 py-3 font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            hasChampion
              ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700'
              : 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white hover:from-orange-600 hover:to-yellow-600'
          }`}
        >
          {hasChampion ? '💪 STEAL IT!' : '🎯 CLAIM IT!'}
        </button>
      </div>
      <p className="text-xs text-[var(--text-secondary)] mt-2">💡 Lowest offer wins! You get your bid amount + a bonus star (2⭐ total)</p>
    </>
  )
}

export default ShowdownTab


