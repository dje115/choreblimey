import React, { useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useChildDashboardData } from '../hooks/useChildDashboardData'
import { apiClient } from '../../../lib/api'
import { handleApiError } from '../../../utils/errorHandler'
import { notifyUpdate } from '../../../utils/notifications'
import RedemptionModal from '../modals/RedemptionModal'

interface Reward {
  id: string
  title: string
  description?: string
  starsRequired: number
  imageUrl?: string
  [key: string]: any
}

interface FamilyGift {
  id: string
  title: string
  description?: string
  starsRequired: number
  imageUrl?: string
  affiliateUrl?: string
  sitestripeUrl?: string
  createdByUser?: {
    id: string
    email: string
  }
  [key: string]: any
}

interface Redemption {
  id: string
  familyGiftId?: string
  rewardId?: string
  costPaid: number
  status: 'pending' | 'fulfilled' | 'rejected'
  createdAt: string
  processedAt?: string
  familyGift?: FamilyGift
  reward?: Reward
  approvedByUser?: {
    id: string
    email: string
  }
  rejectedByUser?: {
    id: string
    email: string
  }
  [key: string]: any
}

const ShopTab: React.FC = () => {
  const { user } = useAuth()
  const {
    wallet,
    familySettings,
    familyGifts,
    rewards,
    pendingRedemptions,
    redemptionHistory,
    refresh,
  } = useChildDashboardData('shop')

  const [selectedGiftForRedemption, setSelectedGiftForRedemption] = useState<FamilyGift | null>(null)
  const [showRedemptionModal, setShowRedemptionModal] = useState(false)
  const [claimingReward, setClaimingReward] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const totalStars = wallet?.stars || 0

  const handleClaimReward = async (reward: Reward) => {
    if (!user?.childId && !user?.id) return

    const childId = user.childId || user.id

    try {
      setClaimingReward(reward.id)
      await apiClient.redeemReward({
        rewardId: reward.id,
        childId,
      })

      await refresh()
      setToast({ message: `🎉 ${reward.title} claimed! Ask your parent to get it for you`, type: 'success' })
      notifyUpdate('redemptionUpdated')
    } catch (error: any) {
      const appError = handleApiError(error, 'Claiming reward')
      setToast({ message: appError.message, type: 'error' })
    } finally {
      setClaimingReward(null)
    }
  }

  const handleRedeemGift = async () => {
    if (!selectedGiftForRedemption || (!user?.childId && !user?.id)) return

    const childId = user.childId || user.id

    try {
      setClaimingReward(selectedGiftForRedemption.id)

      await apiClient.redeemReward({
        familyGiftId: selectedGiftForRedemption.id,
        childId,
      })

      setShowRedemptionModal(false)
      setSelectedGiftForRedemption(null)
      setToast({ message: `🎉 ${selectedGiftForRedemption.title} redeemed! Ask your parent to get it for you`, type: 'success' })
      notifyUpdate('redemptionUpdated')
      await refresh()
    } catch (error: any) {
      const appError = handleApiError(error, 'Redeeming gift')
      setToast({ message: appError.message, type: 'error' })
    } finally {
      setClaimingReward(null)
    }
  }

  if (familySettings?.giftsEnabled === false) {
    return (
      <div className="space-y-6">
        <h2 className="cb-heading-lg text-[var(--primary)]">🛍️ Rewards Shop</h2>
        <div className="text-center py-16">
          <div className="text-8xl mb-4">🔒</div>
          <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Shop is Temporarily Closed</h3>
          <p className="text-[var(--text-secondary)]">The gift shop is currently disabled. Ask your parents to enable it!</p>
        </div>
      </div>
    )
  }

  if (familyGifts.length === 0 && rewards.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="cb-heading-lg text-[var(--primary)]">🛍️ Rewards Shop</h2>
        <div className="text-center py-16">
          <div className="text-8xl mb-4">🎁</div>
          <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">No rewards yet!</h3>
          <p className="text-[var(--text-secondary)]">Ask your parents to add some rewards!</p>
        </div>
      </div>
    )
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

      <h2 className="cb-heading-lg text-[var(--primary)]">🛍️ Rewards Shop</h2>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {/* Display Family Gifts */}
        {familyGifts.map((gift) => (
          <div
            key={gift.id}
            className="bg-white border border-[var(--card-border)] rounded-2xl overflow-hidden hover:shadow-lg transition-transform duration-200 cursor-pointer flex flex-col"
            onClick={() => {
              setSelectedGiftForRedemption(gift)
              setShowRedemptionModal(true)
            }}
          >
            <div className="aspect-[3/4] bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center text-3xl relative">
              {gift.imageUrl ? (
                <a
                  href={gift.affiliateUrl || gift.sitestripeUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="block w-full h-full"
                >
                  <img src={gift.imageUrl} alt={gift.title} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                </a>
              ) : (
                <span aria-hidden>🎁</span>
              )}
            </div>
            <div className="flex-1 p-3 sm:p-4 flex flex-col">
              <h3
                className={`font-semibold text-sm sm:text-base text-[var(--text-primary)] mb-1 line-clamp-2 ${
                  gift.affiliateUrl || gift.sitestripeUrl ? 'cursor-pointer hover:text-[var(--primary)] transition-colors' : ''
                }`}
                onClick={(e) => {
                  if (gift.affiliateUrl || gift.sitestripeUrl) {
                    e.stopPropagation()
                    window.open(gift.affiliateUrl || gift.sitestripeUrl, '_blank', 'noopener,noreferrer')
                  }
                }}
              >
                {gift.title}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mb-2 line-clamp-2">{gift.description || 'A special reward just for you!'}</p>
              {gift.createdByUser && (
                <p className="text-xs text-[var(--text-secondary)] mb-2 italic">Added by {gift.createdByUser.email?.split('@')[0] || 'Unknown'}</p>
              )}
              <div className="mt-auto flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-200">
                  <span className="text-base sm:text-lg font-bold text-yellow-700">{gift.starsRequired}</span>
                  <span className="text-base sm:text-lg">⭐</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedGiftForRedemption(gift)
                    setShowRedemptionModal(true)
                  }}
                  disabled={totalStars < gift.starsRequired || claimingReward === gift.id}
                  className={`px-3 py-1.5 rounded-full font-bold text-xs sm:text-sm whitespace-nowrap ${
                    totalStars >= gift.starsRequired
                      ? 'bg-[var(--primary)] text-white hover:scale-105 active:scale-100'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  } transition-all`}
                >
                  {claimingReward === gift.id ? '⏳...' : totalStars >= gift.starsRequired ? '🎉 Redeem' : `🔒 Need ${gift.starsRequired - totalStars}`}
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Display old Rewards (backward compatibility) */}
        {rewards.map((reward) => (
          <div key={reward.id} className="bg-white border border-[var(--card-border)] rounded-2xl overflow-hidden hover:shadow-lg transition-transform duration-200 flex flex-col">
            <div className="aspect-[3/4] bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center text-3xl">
              {reward.imageUrl ? <img src={reward.imageUrl} alt={reward.title} className="w-full h-full object-cover" /> : <span aria-hidden>🎁</span>}
            </div>
            <div className="flex-1 p-3 sm:p-4 flex flex-col">
              <h3 className="font-semibold text-sm sm:text-base text-[var(--text-primary)] mb-1 line-clamp-2">{reward.title}</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-2 line-clamp-2">{reward.description || 'A special reward just for you!'}</p>
              <div className="mt-auto flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-200">
                  <span className="text-base sm:text-lg font-bold text-yellow-700">{reward.starsRequired}</span>
                  <span className="text-base sm:text-lg">⭐</span>
                </div>
                <button
                  onClick={() => handleClaimReward(reward)}
                  disabled={totalStars < reward.starsRequired || claimingReward === reward.id}
                  className={`px-3 py-1.5 rounded-full font-bold text-xs sm:text-sm whitespace-nowrap ${
                    totalStars >= reward.starsRequired
                      ? 'bg-[var(--primary)] text-white hover:scale-105 active:scale-100'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  } transition-all`}
                >
                  {claimingReward === reward.id ? '⏳...' : totalStars >= reward.starsRequired ? '🎉 Claim' : '🔒 Locked'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pending Redemptions Section */}
      {pendingRedemptions.length > 0 && (
        <div className="mt-8">
          <h3 className="cb-heading-md text-[var(--primary)] mb-4">⏳ Waiting for Approval ({pendingRedemptions.length})</h3>
          <div className="space-y-3">
            {pendingRedemptions.map((redemption: Redemption) => (
              <div key={redemption.id} className="bg-white border-2 border-yellow-300 rounded-[var(--radius-lg)] p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                    ⏳
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-[var(--text-primary)] mb-1">
                      {redemption.familyGift?.title || redemption.reward?.title || 'Gift'}
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] mb-2">Redeemed {new Date(redemption.createdAt).toLocaleString()}</p>
                    <div className="flex items-center gap-2">
                      <span className="cb-chip bg-yellow-100 text-yellow-700">-{redemption.costPaid} ⭐</span>
                      <span className="text-sm text-[var(--text-secondary)]">Waiting for parent approval...</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Redemption History Section */}
      {redemptionHistory.length > 0 && (
        <div className="mt-8">
          <h3 className="cb-heading-md text-[var(--primary)] mb-4">📜 Order History</h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {redemptionHistory.map((redemption: Redemption) => {
              const isApproved = redemption.status === 'fulfilled'
              const isRejected = redemption.status === 'rejected'
              const icon = isApproved ? '✅' : isRejected ? '❌' : '⏳'
              const processedBy = isApproved ? redemption.approvedByUser : redemption.rejectedByUser

              return (
                <div
                  key={redemption.id}
                  className={`bg-white border-2 ${
                    isApproved ? 'border-green-300' : isRejected ? 'border-red-300' : 'border-yellow-300'
                  } rounded-[var(--radius-lg)] p-4`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
                        isApproved
                          ? 'bg-gradient-to-br from-green-400 to-green-600'
                          : isRejected
                          ? 'bg-gradient-to-br from-red-400 to-red-600'
                          : 'bg-gradient-to-br from-yellow-400 to-orange-500'
                      }`}
                    >
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-[var(--text-primary)] mb-1">
                        {redemption.familyGift?.title || redemption.reward?.title || 'Gift'}
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] mb-2">
                        {new Date(redemption.createdAt).toLocaleString()}
                        {redemption.processedAt && <> • Processed {new Date(redemption.processedAt).toLocaleString()}</>}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`cb-chip ${
                            isApproved ? 'bg-green-100 text-green-700' : isRejected ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {isRejected ? '+' : '-'}{redemption.costPaid} ⭐
                        </span>
                        {processedBy && (
                          <span className="text-sm text-[var(--text-secondary)]">
                            {isApproved ? '✅ Approved' : '❌ Rejected'} by {processedBy.email?.split('@')[0] || 'Unknown'}
                          </span>
                        )}
                      </div>
                      {isRejected && <p className="text-sm text-red-600 mt-2 italic">Stars have been refunded to your account</p>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showRedemptionModal && selectedGiftForRedemption && (
        <RedemptionModal
          gift={selectedGiftForRedemption}
          totalStars={totalStars}
          claimingReward={claimingReward === selectedGiftForRedemption.id}
          onClose={() => {
            setShowRedemptionModal(false)
            setSelectedGiftForRedemption(null)
          }}
          onConfirm={handleRedeemGift}
        />
      )}
    </div>
  )
}

export default ShopTab


