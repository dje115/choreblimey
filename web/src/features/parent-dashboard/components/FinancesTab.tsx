import React, { useEffect, useMemo, useState } from 'react'

import { useParentCapabilities } from '../hooks/useParentCapabilities'
import { useFinancesData, type FamilyFinanceSettings } from '../hooks/useFinancesData'
import GiftChildModal from '../modals/GiftChildModal'
import ProcessPayoutModal from '../modals/ProcessPayoutModal'

const formatCurrency = (pence: number): string =>
  (pence / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })

const FinancesTab: React.FC = () => {
  const { hasCapability } = useParentCapabilities()
  const canView = hasCapability('finances:view')
  const canManage = hasCapability('finances:manage')
  const {
    loading,
    refreshing,
    error,
    children,
    payouts,
    totalOutstandingPence,
    totalStars,
    paidThisMonthPence,
    refresh,
    assignments,
    familySettings,
    saveFamilySettings,
    redemptions,
    starPurchases,
  } = useFinancesData()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [selectedPayoutChild, setSelectedPayoutChild] = useState<typeof children[number] | null>(null)
  const [selectedGiftChild, setSelectedGiftChild] = useState<typeof children[number] | null>(null)
  const [settingsDraft, setSettingsDraft] = useState<FamilyFinanceSettings | null>(familySettings)
  const [savingSettings, setSavingSettings] = useState(false)
  const [historyView, setHistoryView] = useState<'gift-redemptions' | 'star-purchases'>('gift-redemptions')

  const childNameById = useMemo(() => {
    const map = new Map<string, string>()
    children.forEach((summary) => map.set(summary.childId, summary.nickname))
    return map
  }, [children])

  const recentPayouts = useMemo(() => payouts.slice(0, 10), [payouts])

  const fulfilledRedemptions = useMemo(
    () =>
      redemptions
        .filter((redemption) => redemption.status !== 'pending')
        .map((redemption) => ({
          ...redemption,
          processedAt: redemption.processedAt ?? redemption.createdAt,
        }))
        .sort((a, b) => new Date(b.processedAt ?? b.createdAt).getTime() - new Date(a.processedAt ?? a.createdAt).getTime())
        .slice(0, 15),
    [redemptions],
  )

  const processedStarPurchases = useMemo(
    () =>
      starPurchases
        .filter((purchase) => purchase.status !== 'pending')
        .map((purchase) => ({
          ...purchase,
          processedAt: purchase.processedAt ?? purchase.createdAt,
        }))
        .sort((a, b) => new Date(b.processedAt ?? b.createdAt).getTime() - new Date(a.processedAt ?? a.createdAt).getTime())
        .slice(0, 15),
    [starPurchases],
  )

  const historyEntries = historyView === 'gift-redemptions' ? fulfilledRedemptions : processedStarPurchases

  useEffect(() => {
    setSettingsDraft(familySettings)
  }, [familySettings])

  if (!canView) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 px-6 py-12 text-center">
        <div className="space-y-2">
          <p className="text-lg font-semibold text-slate-700">Finances unavailable</p>
          <p className="text-sm text-slate-500">
            Your role does not include permission to view family finances. Ask a family admin if you need access.
          </p>
        </div>
      </div>
    )
  }

  const handleRefresh = async () => {
    try {
      await refresh()
      setFeedback({ type: 'success', message: 'Financial data refreshed.' })
    } catch (err: any) {
      console.error('Failed to refresh finances', err)
      setFeedback({ type: 'error', message: err?.message || 'Unable to refresh finances.' })
    }
  }

  const settingsChanged = useMemo(() => {
    if (!settingsDraft || !familySettings) {
      return false
    }

    return (
      settingsDraft.maxBudgetPence !== familySettings.maxBudgetPence ||
      settingsDraft.budgetPeriod !== familySettings.budgetPeriod ||
      settingsDraft.showLifetimeEarnings !== familySettings.showLifetimeEarnings ||
      settingsDraft.buyStarsEnabled !== familySettings.buyStarsEnabled ||
      settingsDraft.starConversionRatePence !== familySettings.starConversionRatePence
    )
  }, [settingsDraft, familySettings])

  const budgetAnalysis = useMemo(() => {
    if (!settingsDraft) {
      return null
    }

    const toPence = (value?: number | null) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

    const activeAssignments = assignments.filter((assignment) => assignment.chore?.active)

    const perChild = children.map((child) => {
      const childAssignments = activeAssignments.filter((assignment) => assignment.childId === child.childId)
      const seen = new Set<string>()
      let weeklyEarnings = 0

      childAssignments.forEach((assignment) => {
        const chore = assignment.chore
        const choreKey = chore?.id ?? assignment.id
        if (!choreKey || seen.has(choreKey)) {
          return
        }
        seen.add(choreKey)

        const reward = toPence(chore?.baseRewardPence)
        if (chore?.frequency === 'daily') {
          weeklyEarnings += reward * 7
        } else if (chore?.frequency === 'weekly') {
          weeklyEarnings += reward
        }
      })

      const periodEarnings = settingsDraft.budgetPeriod === 'monthly' ? weeklyEarnings * 4 : weeklyEarnings

      return {
        childId: child.childId,
        nickname: child.nickname,
        earningsPence: periodEarnings,
      }
    })

    const allocatedPence = perChild.reduce((sum, child) => sum + child.earningsPence, 0)
    const remainingPence = settingsDraft.maxBudgetPence - allocatedPence
    const percentUsed = settingsDraft.maxBudgetPence
      ? Math.min(100, Math.max(0, Math.round((allocatedPence / settingsDraft.maxBudgetPence) * 100)))
      : 0

    return {
      perChild,
      allocatedPence,
      remainingPence,
      percentUsed,
    }
  }, [assignments, children, settingsDraft])

  const clampStarRate = (value: number) => {
    if (Number.isNaN(value)) return 5
    return Math.min(30, Math.max(5, Math.round(value)))
  }

  const handleSaveSettings = async () => {
    if (!settingsDraft) return
    setSavingSettings(true)
    try {
      await saveFamilySettings(settingsDraft)
      setFeedback({ type: 'success', message: 'Finance settings saved.' })
    } catch (err: any) {
      console.error('Failed to save finance settings', err)
      setFeedback({ type: 'error', message: err?.message || 'Unable to save finance settings.' })
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase text-indigo-700">Finances</div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Family Pocket Money & Payouts</h1>
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
          Track outstanding balances, total stars, and recent payouts. Record new payouts or gift stars/money without leaving this
          dashboard.
        </p>
        {!canManage && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            <span>🔒</span>
            <span>You have read-only access to payouts.</span>
          </div>
        )}
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
          <span className="font-semibold">Failed to load finances:</span> {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Outstanding pocket money</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(totalOutstandingPence)}</p>
          <p className="text-xs text-slate-500">Total balance waiting to be paid out.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stars bank balance</p>
          <p className="mt-2 text-2l font-bold text-slate-900">{totalStars.toLocaleString('en-GB')}⭐</p>
          <p className="text-xs text-slate-500">Combined stars available across all children.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paid out this month</p>
          <p className="mt-2 text-2l font-bold text-slate-900">{formatCurrency(paidThisMonthPence)}</p>
          <p className="text-xs text-slate-500">Cash already paid out this calendar month.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Children tracked</p>
          <p className="mt-2 text-2l font-bold text-slate-900">{children.length}</p>
          <p className="text-xs text-slate-500">Active children with wallets.</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Child pocket money balances</p>
            <p className="text-xs text-slate-500">Snapshot of what each child has earned, paid out, and still waiting to receive.</p>
          </div>
        </div>

        {children.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
            <div className="text-4xl">👶</div>
            <p className="mt-2 text-sm font-semibold text-slate-600">No children yet</p>
            <p className="text-xs text-slate-500">Invite a child to start tracking pocket money.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {children.map((summary) => (
              <div
                key={summary.childId}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💰</span>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{summary.nickname}</h3>
                      <p className="text-xs text-slate-500">
                        Outstanding {formatCurrency(summary.balancePence)} • {summary.stars.toLocaleString('en-GB')}⭐
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-semibold text-emerald-700">
                      Lifetime earned {formatCurrency(summary.lifetimeEarningsPence)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-semibold text-slate-700">
                      Paid out {formatCurrency(summary.lifetimePaidOutPence)}
                    </span>
                    {summary.lastPayoutAt && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-semibold text-slate-500">
                        Last payout {new Date(summary.lastPayoutAt).toLocaleDateString('en-GB')}
                        {summary.lastPayoutAmountPence != null && ` · ${formatCurrency(summary.lastPayoutAmountPence)}`}
                      </span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedGiftChild(summary)}
                      className="rounded-full border border-purple-300 px-4 py-2 text-xs font-semibold text-purple-600 transition hover:bg-purple-50"
                    >
                      Gift stars / money
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPayoutChild(summary)}
                      className="rounded-full border border-indigo-200 px-4 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                    >
                      Record payout
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Recent payouts</p>
            <p className="text-xs text-slate-500">Latest payouts recorded in the family dashboard.</p>
          </div>
        </div>

        {recentPayouts.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
            <div className="text-4xl">💸</div>
            <p className="mt-2 text-sm text-slate-500">No payouts recorded yet.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {recentPayouts.map((payout) => {
              const childName = childNameById.get(payout.childId) ?? 'Child'
              return (
                <li
                  key={payout.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{formatCurrency(payout.amountPence)}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(payout.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                      <span className="ml-1 text-slate-400">• {childName}</span>
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600">
                    {payout.method === 'cash' ? 'Cash' : payout.method === 'bank_transfer' ? 'Bank transfer' : 'Other'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {settingsDraft ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Budget & settings</p>
              <p className="text-xs text-slate-500">Control family budget, lifetime earnings visibility, and buy-stars settings.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Budget period</label>
                <select
                  value={settingsDraft.budgetPeriod}
                  onChange={(event) =>
                    setSettingsDraft((prev) =>
                      prev ? { ...prev, budgetPeriod: event.target.value as 'weekly' | 'monthly' } : prev,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Max budget (£)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={(settingsDraft.maxBudgetPence / 100).toFixed(2)}
                  onChange={(event) => {
                    const value = parseFloat(event.target.value)
                    setSettingsDraft((prev) =>
                      prev ? { ...prev, maxBudgetPence: Number.isFinite(value) ? Math.max(0, Math.round(value * 100)) : 0 } : prev,
                    )
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                />
              </div>

              {settingsDraft.maxBudgetPence > 0 && budgetAnalysis && (
                <div className="space-y-3 rounded-xl border border-white/60 bg-white px-4 py-4 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>Allocated</span>
                    <span className="font-semibold text-indigo-700">{formatCurrency(budgetAnalysis.allocatedPence)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Remaining</span>
                    <span
                      className={`font-semibold ${budgetAnalysis.remainingPence < 0 ? 'text-rose-600' : 'text-emerald-600'}`}
                    >
                      {formatCurrency(budgetAnalysis.remainingPence)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        budgetAnalysis.percentUsed > 90
                          ? 'bg-rose-500'
                          : budgetAnalysis.percentUsed > 70
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${budgetAnalysis.percentUsed}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 text-center">{budgetAnalysis.percentUsed}% of budget allocated</p>

                  {budgetAnalysis.perChild.length > 0 && (
                    <div className="pt-3 border-t border-slate-200">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {settingsDraft.budgetPeriod === 'monthly' ? 'Monthly' : 'Weekly'} estimate per child
                      </p>
                      <div className="mt-2 space-y-2">
                        {budgetAnalysis.perChild.map((child) => (
                          <div
                            key={child.childId}
                            className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm"
                          >
                            <span>{child.nickname}</span>
                            <span className="font-semibold text-indigo-700">{formatCurrency(child.earningsPence)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={settingsDraft.showLifetimeEarnings}
                  onChange={(event) =>
                    setSettingsDraft((prev) => (prev ? { ...prev, showLifetimeEarnings: event.target.checked } : prev))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <p className="font-semibold text-slate-800">Show lifetime earnings</p>
                  <p className="text-xs text-slate-500">
                    Display total lifetime earnings alongside outstanding pocket money on the child dashboard.
                  </p>
                </div>
              </label>

              <div className="space-y-3 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800">Enable buy stars</p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settingsDraft.buyStarsEnabled}
                    onClick={() =>
                      setSettingsDraft((prev) =>
                        prev ? { ...prev, buyStarsEnabled: !prev.buyStarsEnabled } : prev,
                      )
                    }
                    className={`relative inline-flex h-6 w-11 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                      settingsDraft.buyStarsEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        settingsDraft.buyStarsEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Allow children to convert pocket money into stars directly from their dashboard.
                </p>

                {settingsDraft.buyStarsEnabled && (
                  <div className="rounded-xl border border-white/80 bg-white px-3 py-3">
                    <label className="block text-sm font-semibold text-slate-700">
                      Star conversion rate: £{(settingsDraft.starConversionRatePence / 100).toFixed(2)} per star
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={30}
                      step={1}
                      value={settingsDraft.starConversionRatePence}
                      onChange={(event) =>
                        setSettingsDraft((prev) =>
                          prev
                            ? { ...prev, starConversionRatePence: clampStarRate(Number(event.target.value)) }
                            : prev,
                        )
                      }
                      className="mt-3 w-full accent-indigo-600"
                    />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>5p</span>
                      <span>30p</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Current rate: {settingsDraft.starConversionRatePence}p per star
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSettingsDraft(familySettings)}
              disabled={!settingsChanged || savingSettings}
              className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset changes
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={!settingsChanged || savingSettings}
              className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {savingSettings ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 text-sm text-slate-500 shadow-sm">
          Loading finance settings…
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Reward & star history</p>
            <p className="text-xs text-slate-500">
              Review recent gift redemptions and star purchases to keep budgets on track.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setHistoryView('gift-redemptions')}
              className={`rounded-full px-3 py-1 transition ${
                historyView === 'gift-redemptions' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100'
              }`}
            >
              Gift purchases
            </button>
            <button
              type="button"
              onClick={() => setHistoryView('star-purchases')}
              className={`rounded-full px-3 py-1 transition ${
                historyView === 'star-purchases' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100'
              }`}
            >
              Star buys
            </button>
          </div>
        </div>

        {historyEntries.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
            No recent {historyView === 'gift-redemptions' ? 'gift activity' : 'star purchases'}.
          </div>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {historyEntries.map((entry) => {
              const processedAt = new Date(entry.processedAt ?? entry.createdAt).toLocaleString('en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })

              if (historyView === 'gift-redemptions') {
                const redemption = entry as typeof fulfilledRedemptions[number]
                const childName = childNameById.get(redemption.childId ?? '') ?? 'Child'
                const starsCost = redemption.costPaid ?? redemption.familyGift?.['starsRequired'] ?? null
                const title = redemption.familyGift?.title ?? redemption.reward?.title ?? 'Reward'

                return (
                  <li
                    key={`finance-redemption-${redemption.id}`}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{title}</p>
                      <p className="text-xs text-slate-500">
                        {processedAt}
                        <span className="ml-1 text-slate-400">• {childName}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {starsCost != null && (
                        <span className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600">
                          {starsCost}⭐
                        </span>
                      )}
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
                    </div>
                  </li>
                )
              }

              const purchase = entry as typeof processedStarPurchases[number]
              const childName = childNameById.get(purchase.childId) ?? 'Child'
              return (
                <li
                  key={`finance-starpurchase-${purchase.id}`}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{purchase.starsRequested}⭐ requested</p>
                    <p className="text-xs text-slate-500">
                      {processedAt}
                      <span className="ml-1 text-slate-400">• {childName}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {purchase.amountPence != null && purchase.amountPence > 0 && (
                      <span className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600">
                        {formatCurrency(purchase.amountPence)}
                      </span>
                    )}
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
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <ProcessPayoutModal
        isOpen={Boolean(selectedPayoutChild)}
        child={selectedPayoutChild}
        onClose={() => setSelectedPayoutChild(null)}
        onCompleted={refresh}
      />

      <GiftChildModal
        isOpen={Boolean(selectedGiftChild)}
        child={selectedGiftChild}
        onClose={() => setSelectedGiftChild(null)}
        onCompleted={refresh}
      />
    </div>
  )
}

export default FinancesTab

