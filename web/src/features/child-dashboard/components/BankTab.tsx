import React, { useState, useEffect, useMemo } from 'react'
import { useChildDashboardData } from '../hooks/useChildDashboardData'
import { apiClient } from '../../../lib/api'
import { handleApiError } from '../../../utils/errorHandler'
import { notifyUpdate } from '../../../utils/notifications'

interface FamilyGift {
  id: string
  title: string
  createdByUser?: {
    id: string
    email: string
  }
  [key: string]: any
}

interface Transaction {
  id: string
  type: 'credit' | 'debit'
  amountPence: number
  createdAt: string
  metaJson?: string | any
  [key: string]: any
}

const BankTab: React.FC = () => {
  const {
    wallet,
    familySettings,
    transactions,
    familyGifts,
    payouts,
    familyMembers,
    pendingStarPurchases,
    refresh,
  } = useChildDashboardData('bank')

  const [buyStarsAmount, setBuyStarsAmount] = useState(1)
  const [buyingStars, setBuyingStars] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const balancePence = wallet?.balancePence || 0
  const conversionRatePence = familySettings?.starConversionRatePence || 10
  const maxStarsAffordable = Math.floor(balancePence / conversionRatePence)
  const maxStars = Math.max(1, maxStarsAffordable)
  const currentCost = buyStarsAmount * conversionRatePence
  const canAfford = balancePence >= currentCost

  useEffect(() => {
    if (buyStarsAmount > maxStars) {
      setBuyStarsAmount(maxStars)
    }
  }, [buyStarsAmount, maxStars])

  const handleBuyStars = async () => {
    if (buyingStars || !canAfford) {
      if (!canAfford) {
        setToast({ message: "You don't have enough money! 💰", type: 'error' })
      }
      return
    }

    try {
      setBuyingStars(true)
      await apiClient.buyStars(buyStarsAmount)
      setToast({ message: `⭐ Requested ${buyStarsAmount} stars! Waiting for parent approval...`, type: 'success' })
      setBuyStarsAmount(1)
      notifyUpdate('redemptionUpdated')
      await refresh()
    } catch (error: any) {
      const appError = handleApiError(error, 'Buying stars')
      setToast({ message: appError.message, type: 'error' })
    } finally {
      setBuyingStars(false)
    }
  }

  const formattedTransactions = useMemo(() => {
    return transactions.map((transaction: Transaction) => {
      const isCredit = transaction.type === 'credit'
      const metaJson =
        typeof transaction.metaJson === 'string' ? JSON.parse(transaction.metaJson) : transaction.metaJson || {}

      let icon = '💰'
      let label = isCredit ? 'Earned' : 'Spent'
      let description = ''

      if (isCredit) {
        if (metaJson.completionId) {
          icon = '✅'
          label = 'Chore Completed'
          description = metaJson.rivalryBonus || metaJson.doubledStars ? '🏆 Challenge Winner - Double Stars!' : 'Good job!'
        } else if (metaJson.type === 'streak_bonus') {
          icon = '🔥'
          label = 'Streak Bonus'
          description = `${metaJson.streakLength || 0} day streak!`
        } else if (metaJson.type === 'rivalry_bonus') {
          icon = '⚔️'
          label = 'Rivalry Bonus'
          description = 'Challenge champion!'
        } else if (metaJson.type === 'gift_stars') {
          icon = '⭐'
          label = 'Stars Gifted'
          description = metaJson.giverName ? `From ${metaJson.giverName}` : metaJson.note || 'Gift received'
        } else if (metaJson.type === 'gift_money') {
          icon = '💵'
          label = 'Money Gifted'
          description = metaJson.giverName ? `From ${metaJson.giverName}` : metaJson.note || 'Gift received'
        } else {
          icon = '💵'
          label = 'Money Added'
          description = metaJson.note || 'From parent'
        }
      } else {
        if (metaJson.redemptionId || metaJson.familyGiftId) {
          icon = '🎁'
          label = 'Reward Claimed'
          const gift: FamilyGift | undefined = metaJson.familyGiftId
            ? familyGifts.find((g: FamilyGift) => g.id === metaJson.familyGiftId)
            : undefined
          const giftTitle = metaJson.giftTitle || gift?.title || metaJson.rewardTitle || 'Prize redeemed'
          const addedBy = gift?.createdByUser?.email?.split('@')[0]
          description = giftTitle + (addedBy ? ` • Added by ${addedBy}` : '')
        } else if (metaJson.type === 'buy_stars_request') {
          icon = '⭐'
          label = 'Buy Stars Request'
          description = `Requested ${metaJson.starsRequested || 0} stars • Waiting for approval`
        } else if (metaJson.type === 'buy_stars_approved') {
          icon = '⭐'
          label = 'Stars Purchased'
          description = `Bought ${metaJson.starsRequested || 0} stars!`
        } else if (metaJson.type === 'buy_stars_rejected' || metaJson.type === 'buy_stars_refund') {
          icon = '💰'
          label = 'Buy Stars Refund'
          description = metaJson.note || 'Refund for rejected star purchase'
        } else if (metaJson.payoutId) {
          icon = '💸'
          label = 'Paid Out'
          const payout = payouts.find((p: any) => p.id === metaJson.payoutId)
          const paidByName = payout?.paidByUser
            ? familyMembers.find((m: any) => m.userId === payout.paidBy)?.user?.email?.split('@')[0] ||
              payout.paidByUser.email?.split('@')[0] ||
              'Parent'
            : 'Parent'
          description = `Method: ${metaJson.method || 'cash'} • Paid by ${paidByName}`
        } else {
          icon = '💸'
          label = 'Money Removed'
          description = metaJson.note || ''
        }
      }

      const date = new Date(transaction.createdAt)
      const dateStr = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
      })
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })

      let stars = 0
      let showStars = true
      let showMoney = true
      let starsDisplay = ''
      let moneyDisplay = ''

      if (metaJson.type === 'buy_stars_approved' && metaJson.starsRequested) {
        stars = metaJson.starsRequested
        showMoney = false
        starsDisplay = `+${stars}⭐`
      } else if (metaJson.redemptionId || metaJson.familyGiftId || metaJson.starsSpent) {
        stars = metaJson.starsSpent || metaJson.costPaid || 0
        showMoney = false
        starsDisplay = `-${stars}⭐`
      } else if (metaJson.payoutId) {
        showStars = false
        showMoney = true
        moneyDisplay = `£${(transaction.amountPence / 100).toFixed(2)}`
      } else if (metaJson.type === 'gift_money') {
        showStars = false
        showMoney = true
        moneyDisplay = `£${(transaction.amountPence / 100).toFixed(2)}`
      } else if (metaJson.type === 'gift_stars') {
        stars = metaJson.starsAmount || 0
        showStars = true
        showMoney = false
        starsDisplay = `+${stars}⭐`
      } else {
        stars = Math.floor(transaction.amountPence / 10)
        starsDisplay = `${isCredit ? '+' : '-'}${stars}⭐`
        moneyDisplay = `£${(transaction.amountPence / 100).toFixed(2)}`
      }

      return {
        ...transaction,
        icon,
        label,
        description,
        dateStr,
        timeStr,
        starsDisplay,
        moneyDisplay,
        showStars,
        showMoney,
        isCredit,
        metaJson,
      }
    })
  }, [transactions, familyGifts, payouts, familyMembers])

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

      {/* Buy Stars Section */}
      {familySettings?.buyStarsEnabled && (
        <div className="cb-card bg-white p-4 shadow-md border-2 border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⭐</span>
              <h2 className="text-lg font-bold text-gray-800">Buy Stars</h2>
            </div>
            <span className="text-sm text-gray-600">Balance: £{(balancePence / 100).toFixed(2)}</span>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-4">
            <p className="text-xs text-gray-700 text-center">
              You can buy up to <span className="font-bold text-blue-700">{maxStars} star{maxStars !== 1 ? 's' : ''}</span> (
              {conversionRatePence}p per star)
            </p>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-semibold text-gray-800">Stars to buy:</label>
              <span className="text-2xl font-bold text-orange-600">{buyStarsAmount} ⭐</span>
            </div>
            <input
              type="range"
              min="1"
              max={maxStars}
              step="1"
              value={buyStarsAmount}
              onChange={(e) => {
                const val = Math.max(1, Math.min(maxStars, parseInt(e.target.value) || 1))
                setBuyStarsAmount(val)
              }}
              className="w-full h-4 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #f97316 0%, #f97316 ${
                  maxStars > 1 ? ((buyStarsAmount - 1) / (maxStars - 1)) * 100 : 0
                }%, #e5e7eb ${maxStars > 1 ? ((buyStarsAmount - 1) / (maxStars - 1)) * 100 : 0}%, #e5e7eb 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1</span>
              <span>{maxStars}</span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700 font-medium">Total cost:</span>
              <span className={`text-xl font-bold ${canAfford ? 'text-green-600' : 'text-red-600'}`}>
                £{(currentCost / 100).toFixed(2)}
              </span>
            </div>
          </div>

          {pendingStarPurchases.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2 mb-4">
              <p className="text-xs text-yellow-800 font-semibold text-center">
                ⏳ {pendingStarPurchases.length} request{pendingStarPurchases.length !== 1 ? 's' : ''} waiting for approval
              </p>
            </div>
          )}

          <button
            onClick={handleBuyStars}
            disabled={buyingStars || !canAfford || maxStars === 0}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-bold text-base hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-95 transform"
          >
            {buyingStars ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                <span>Requesting...</span>
              </span>
            ) : (
              <span>
                💰 Buy {buyStarsAmount} Star{buyStarsAmount !== 1 ? 's' : ''}!
              </span>
            )}
          </button>

          <p className="text-gray-500 text-xs text-center mt-3">⚠️ Money deducted now, stars added after approval</p>
        </div>
      )}

      {/* Transaction History */}
      <div className="cb-card p-6">
        <h3 className="cb-heading-md text-[var(--primary)] mb-4">📊 Transaction History</h3>

        {formattedTransactions.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-8xl mb-4">💰</div>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">No transactions yet!</h3>
            <p className="text-[var(--text-secondary)]">Complete chores to earn your first stars!</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {formattedTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all hover:shadow-lg ${
                  transaction.isCredit
                    ? 'bg-gradient-to-r from-green-50 to-teal-50 border-green-200'
                    : 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-200'
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl flex-shrink-0 shadow-lg ${
                    transaction.isCredit
                      ? 'bg-gradient-to-br from-green-400 to-teal-500'
                      : 'bg-gradient-to-br from-orange-400 to-red-500'
                  }`}
                >
                  {transaction.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-bold text-[var(--text-primary)] text-lg">{transaction.label}</h4>
                    <div className="text-right">
                      {transaction.metaJson.type === 'buy_stars_approved' ? (
                        <p className="font-bold text-2xl text-green-600">{transaction.starsDisplay}</p>
                      ) : transaction.metaJson.payoutId ? (
                        <p className="text-lg font-bold text-[var(--text-primary)]">{transaction.moneyDisplay}</p>
                      ) : transaction.metaJson.redemptionId ||
                        transaction.metaJson.familyGiftId ||
                        transaction.metaJson.starsSpent ? (
                        <p className={`font-bold text-2xl text-red-600`}>{transaction.starsDisplay}</p>
                      ) : (
                        <>
                          {transaction.showStars && (
                            <p
                              className={`font-bold text-2xl ${
                                transaction.isCredit ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {transaction.starsDisplay}
                            </p>
                          )}
                          {transaction.showMoney && (
                            <p className="text-sm text-[var(--text-secondary)]">
                              {transaction.moneyDisplay || `£${(transaction.amountPence / 100).toFixed(2)}`}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {transaction.description && (
                    <p className="text-sm text-[var(--text-secondary)] mb-2">{transaction.description}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1">📅 {transaction.dateStr}</span>
                    <span className="flex items-center gap-1">⏰ {transaction.timeStr}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default BankTab

