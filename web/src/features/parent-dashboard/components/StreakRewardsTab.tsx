import React, { useMemo, useState } from 'react'

import { useParentCapabilities } from '../hooks/useParentCapabilities'
import { useStreakRewardsData } from '../hooks/useStreakRewardsData'
import { useFamilyData } from '../hooks/useFamilyData'

const StreakRewardsTab: React.FC = () => {
  const { hasCapability } = useParentCapabilities()
  const canView = hasCapability('streaks:view')
  const canManage = hasCapability('streaks:manage')
  const { children } = useFamilyData()
  const {
    loading,
    refreshing,
    error,
    family,
    gifts,
    pendingRedemptions,
    recentRedemptions,
    starPurchases,
    refresh,
    approveRedemption,
    rejectRedemption,
    busyRedemptionIds,
  } = useStreakRewardsData()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [historyView, setHistoryView] = useState<'redemptions' | 'purchases'>('redemptions')

  const giftShopEnabled = family?.giftsEnabled !== false
  const activeGifts = useMemo(() => gifts.filter((gift) => gift.active).slice(0, 4), [gifts])
  const pendingCount = pendingRedemptions.length
  const historyList = useMemo(() => {
    if (historyView === 'redemptions') {
      return recentRedemptions
        .slice()
        .sort((a, b) => new Date(b.processedAt ?? b.createdAt).getTime() - new Date(a.processedAt ?? a.createdAt).getTime())
    }
    return starPurchases
      .slice()
      .sort((a, b) => new Date(b.processedAt ?? b.createdAt).getTime() - new Date(a.processedAt ?? a.createdAt).getTime())
  }, [recentRedemptions, starPurchases, historyView])

  if (!canView) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 px-6 py-12 text-center">
        <div className="space-y-2">
          <p className="text-lg font-semibold text-slate-700">Streak rewards unavailable</p>
          <p className="text-sm text-slate-500">
            Your role does not include permission to view streak rewards. Ask a family admin if you need access.
          </p>
        </div>
      </div>
    )
  }

  const handleRefresh = async () => {
    try {
      await refresh()
      setFeedback({ type: 'success', message: 'Streak data refreshed.' })
    } catch (err: any) {
      console.error('Failed to refresh streak data', err)
      setFeedback({ type: 'error', message: err?.message || 'Unable to refresh streak data.' })
    }
  }

  const handleApproveRedemption = async (redemptionId: string) => {
    try {
      await approveRedemption(redemptionId)
      setFeedback({ type: 'success', message: 'Redemption approved.' })
    } catch (err: any) {
      console.error('Failed to approve redemption', err)
      setFeedback({ type: 'error', message: err?.message || 'Unable to approve redemption.' })
    }
  }

  const handleRejectRedemption = async (redemptionId: string) => {
    if (!window.confirm('Reject this redemption request?')) {
      return
    }
    try {
      await rejectRedemption(redemptionId)
      setFeedback({ type: 'success', message: 'Redemption rejected.' })
    } catch (err: any) {
      console.error('Failed to reject redemption', err)
      setFeedback({ type: 'error', message: err?.message || 'Unable to reject redemption.' })
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase text-indigo-700">Streaks</div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Streak Rewards Overview</h1>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <p className="text-sm text-slate-600 sm:max-w-3xl">
          Keep an eye on bonus streak settings and pending reward approvals. To curate gifts, open the Gift Shop tab.
        </p>
      </header>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="ml-auto text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          <span className="font-semibold">Failed to load streak rewards:</span> {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gift shop</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{giftShopEnabled ? 'Enabled' : 'Disabled'}</p>
          <p className="text-xs text-slate-500">Children can redeem stars for gifts when enabled.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active gifts</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{gifts.filter((gift) => gift.active).length}</p>
          <p className="text-xs text-slate-500">Manage the catalogue in the Gift Shop tab.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending redemptions</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{pendingCount}</p>
          <p className="text-xs text-slate-500">Awaiting parent approval.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bonus streaks</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {family?.bonusEnabled ? `${family.bonusDays ?? 7}-day bonus` : 'Disabled'}
          </p>
          <p className="text-xs text-slate-500">Streak bonus configuration summary.</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Gift highlights</p>
            <p className="text-xs text-slate-500">A snapshot of popular rewards. Full management lives in the Gift Shop tab.</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {activeGifts.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
              <div className="text-4l">🎁</div>
              <p className="mt-2 text-sm text-slate-500">No active gifts right now. Visit the Gift Shop tab to add rewards.</p>
            </div>
          ) : (
            activeGifts.map((gift) => {
              const stars = gift.starsRequired ?? gift.starsCost ?? 0
              return (
                <div
                  key={gift.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                    {gift.imageUrl ? (
                      <img
                        src={gift.imageUrl}
                        alt={gift.title}
                        className="h-20 w-20 rounded-xl border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xl">
                        🎁
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{gift.title}</p>
                      {gift.description && <p className="text-xs text-slate-500">{gift.description}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-semibold text-slate-600">
                          ⭐ {stars}
                        </span>
                        {gift.pricePence != null && gift.pricePence > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-semibold text-slate-600">
                            💷 {(gift.pricePence / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {gift.affiliateUrl && (
                    <a
                      href={gift.affiliateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      View link
                    </a>
                  )}
                </div>
              )
            })
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Pending redemptions</p>
            <p className="text-xs text-slate-500">Approve or reject children’s reward requests from here.</p>
          </div>
        </div>

        {pendingCount === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
            <div className="text-4xl">✅</div>
            <p className="mt-2 text-sm text-slate-500">No pending redemptions right now.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {pendingRedemptions.slice(0, 10).map((redemption) => {
              const gift = redemption.familyGift || redemption.reward
              const childNickname = redemption.childId
                ? children.find((child) => child.id === redemption.childId)?.nickname
                : null
              const requestedAt = new Date(redemption.createdAt).toLocaleString('en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
              const busy = busyRedemptionIds.has(redemption.id)

              return (
                <li
                  key={redemption.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{gift?.title || 'Reward'}</p>
                    <p className="text-xs text-slate-500">
                      Requested {requestedAt}
                      {childNickname && <span className="ml-1 text-slate-400">• {childNickname}</span>}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleApproveRedemption(redemption.id)}
                        disabled={busy}
                        className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectRedemption(redemption.id)}
                        disabled={busy}
                        className="rounded-full border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">History</p>
            <p className="text-xs text-slate-500">Track fulfilled redemptions and star purchases.</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setHistoryView('redemptions')}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                historyView === 'redemptions' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Redemptions
            </button>
            <button
              type="button"
              onClick={() => setHistoryView('purchases')}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                historyView === 'purchases' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Star purchases
            </button>
          </div>
        </div>

        {historyList.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
            No {historyView === 'redemptions' ? 'recent redemptions' : 'star purchases'} yet.
          </div>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {historyList.slice(0, 20).map((item) => {
              const processedAt = new Date((item as any).processedAt ?? item.createdAt).toLocaleString('en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })

              if (historyView === 'redemptions') {
                const redemption = item as typeof recentRedemptions[number]
                const gift = redemption.familyGift || redemption.reward
                const childNickname = redemption.childId
                  ? children.find((child) => child.id === redemption.childId)?.nickname
                  : null
                return (
                  <li
                    key={`history-redemption-${redemption.id}`}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{gift?.title ?? 'Reward'}</p>
                      <p className="text-xs text-slate-500">
                        {processedAt}
                        {childNickname && <span className="ml-1 text-slate-400">• {childNickname}</span>}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        redemption.status === 'fulfilled'
                          ? 'bg-emerald-100 text-emerald-700'
                          : redemption.status === 'rejected'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {redemption.status}
                    </span>
                  </li>
                )
              }

              const purchase = item as typeof starPurchases[number]
              const childNickname = children.find((child) => child.id === purchase.childId)?.nickname ?? 'Unknown child'
              return (
                <li
                  key={`history-purchase-${purchase.id}`}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{purchase.starsRequested}⭐ requested</p>
                    <p className="text-xs text-slate-500">
                      {processedAt} • {childNickname}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      purchase.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : purchase.status === 'rejected'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {purchase.status}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">Loading streak data…</div>
      )}
    </div>
  )
}

export default StreakRewardsTab

