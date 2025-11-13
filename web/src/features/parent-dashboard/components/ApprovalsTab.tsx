import React, { useMemo, useState } from 'react'

import { useParentCapabilities } from '../hooks/useParentCapabilities'
import type { UseApprovalsDataResult } from '../hooks/useApprovalsData'
import { notifyUpdate } from '../../../utils/notifications'

interface FeedbackMessage {
  type: 'success' | 'error'
  message: string
}

const SectionHeader: React.FC<{ title: string; subtitle: string; count: number }> = ({ title, subtitle, count }) => (
  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      {count} pending
    </span>
  </div>
)

const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
    <p className="text-base font-semibold text-slate-600">{title}</p>
    <p className="mt-2 text-sm text-slate-500">{description}</p>
  </div>
)

interface ApprovalsTabProps {
  approvals: UseApprovalsDataResult
}

const ApprovalsTab: React.FC<ApprovalsTabProps> = ({ approvals }) => {
  const { hasCapability } = useParentCapabilities()
  const approvalsManageable = hasCapability('approvals:manage')
  const {
    loading,
    error,
    completions,
    redemptions,
    starPurchases,
    approveCompletion,
    rejectCompletion,
    approveRedemption,
    rejectRedemption,
    approveStarPurchase,
    rejectStarPurchase,
    busyIds,
  } = approvals

  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null)

  const resetFeedback = () => setFeedback(null)

  const setSuccess = (message: string) => setFeedback({ type: 'success', message })
  const setError = (error: unknown) => {
    console.error('Approvals action failed', error)
    setFeedback({
      type: 'error',
      message: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
    })
  }

  const handleApproveCompletion = async (completionId: string) => {
    resetFeedback()
    try {
      await approveCompletion(completionId)
      notifyUpdate('choreUpdated')
      setSuccess('Completion approved successfully.')
    } catch (error) {
      setError(error)
    }
  }

  const handleRejectCompletion = async (completionId: string) => {
    resetFeedback()
    try {
      const reason = window.prompt('Why are you rejecting this chore completion? (optional)') || undefined
      await rejectCompletion(completionId, reason)
      notifyUpdate('choreUpdated')
      setFeedback({
        type: reason ? 'warning' : 'info',
        message: reason ? `Completion rejected: ${reason}` : 'Completion rejected.',
      })
    } catch (error) {
      setError(error)
    }
  }

  const handleApproveRedemption = async (redemptionId: string) => {
    resetFeedback()
    try {
      await approveRedemption(redemptionId)
      notifyUpdate('redemptionUpdated')
      setSuccess('Gift redemption approved!')
    } catch (error) {
      setError(error)
    }
  }

  const handleRejectRedemption = async (redemptionId: string) => {
    resetFeedback()
    try {
      const reason = window.prompt('Why are you rejecting this gift redemption? (optional)') || undefined
      await rejectRedemption(redemptionId)
      notifyUpdate('redemptionUpdated')
      setFeedback({
        type: reason ? 'warning' : 'info',
        message: reason ? `Gift redemption rejected: ${reason}` : 'Gift redemption rejected.',
      })
    } catch (error) {
      setError(error)
    }
  }

  const handleApproveStarPurchase = async (purchaseId: string) => {
    resetFeedback()
    try {
      await approveStarPurchase(purchaseId)
      notifyUpdate('redemptionUpdated')
      setSuccess('Star purchase approved!')
    } catch (error) {
      setError(error)
    }
  }

  const handleRejectStarPurchase = async (purchaseId: string) => {
    resetFeedback()
    try {
      await rejectStarPurchase(purchaseId)
      notifyUpdate('redemptionUpdated')
      setFeedback({ type: 'warning', message: 'Star purchase rejected.' })
    } catch (error) {
      setError(error)
    }
  }

  const totalPending = completions.length + redemptions.length + starPurchases.length

  const approvalsUnavailable = useMemo(
    () => ({
      completions: completions.length === 0,
      redemptions: redemptions.length === 0,
      purchases: starPurchases.length === 0,
    }),
    [completions.length, redemptions.length, starPurchases.length],
  )

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase text-indigo-700">Review</div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Approvals & Reviews</h1>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
            {totalPending} pending
          </span>
        </div>
        <p className="text-sm text-slate-600 sm:max-w-3xl">
          Approve or reject chore completions, reward redemptions, and star purchase requests. Actions sync instantly with
          the child dashboard.
        </p>
      </header>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={resetFeedback}
            className="ml-auto text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          <span className="font-semibold">Failed to load approvals:</span> {error}
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <SectionHeader
          title="Chore Completions"
          subtitle="Approve or decline chores submitted by your children."
          count={completions.length}
        />
        {approvalsUnavailable.completions ? (
          <EmptyState title="No pending completions" description="Children will appear here when they submit chores." />
        ) : (
          <div className="space-y-3">
            {completions.map((completion) => {
              const busy = busyIds.has(completion.id)
              const choreTitle = completion.assignment?.chore?.title ?? 'Chore'
              return (
                <div
                  key={completion.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{choreTitle}</p>
                    <p className="text-xs text-slate-500">
                      Submitted {new Date(completion.timestamp).toLocaleString()}
                    </p>
                    {completion.assignment?.chore?.baseRewardPence != null && (
                      <p className="mt-1 text-xs text-slate-500">
                        Reward:{' '}
                        {(completion.assignment.chore.baseRewardPence / 100).toLocaleString('en-GB', {
                          style: 'currency',
                          currency: 'GBP',
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy || !approvalsManageable}
                      onClick={() => handleApproveCompletion(completion.id)}
                      className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy || !approvalsManageable}
                      onClick={() => handleRejectCompletion(completion.id)}
                      className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-rose-300"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <SectionHeader
          title="Reward Redemptions"
          subtitle="Confirm or decline reward redemptions requested by children."
          count={redemptions.length}
        />
        {approvalsUnavailable.redemptions ? (
          <EmptyState title="No pending redemptions" description="When children redeem rewards they will appear here." />
        ) : (
          <div className="space-y-3">
            {redemptions.map((redemption) => {
              const busy = busyIds.has(redemption.id)
              const rewardTitle = redemption.reward?.title ?? redemption.familyGift?.title ?? 'Reward'
              return (
                <div
                  key={redemption.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{rewardTitle}</p>
                    <p className="text-xs text-slate-500">
                      Requested {new Date(redemption.createdAt).toLocaleString()}
                    </p>
                    {redemption.starsCost != null && (
                      <p className="mt-1 text-xs text-slate-500">Cost: {redemption.starsCost}⭐</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy || !approvalsManageable}
                      onClick={() => handleApproveRedemption(redemption.id)}
                      className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
                    >
                      Fulfil
                    </button>
                    <button
                      type="button"
                      disabled={busy || !approvalsManageable}
                      onClick={() => handleRejectRedemption(redemption.id)}
                      className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-rose-300"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <SectionHeader
          title="Star Purchase Requests"
          subtitle="Approve star purchases made by your children."
          count={starPurchases.length}
        />
        {approvalsUnavailable.purchases ? (
          <EmptyState title="No pending star purchases" description="Children can buy stars when you enable it in settings." />
        ) : (
          <div className="space-y-3">
            {starPurchases.map((purchase) => {
              const busy = busyIds.has(purchase.id)
              return (
                <div
                  key={purchase.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{purchase.starsRequested}⭐ requested</p>
                    <p className="text-xs text-slate-500">
                      Requested {new Date(purchase.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy || !approvalsManageable}
                      onClick={() => handleApproveStarPurchase(purchase.id)}
                      className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy || !approvalsManageable}
                      onClick={() => handleRejectStarPurchase(purchase.id)}
                      className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-rose-300"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
          Loading the latest approvals…
        </div>
      )}
    </div>
  )
}

export default ApprovalsTab

