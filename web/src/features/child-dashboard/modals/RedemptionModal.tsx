import React from 'react'

interface FamilyGift {
  id: string
  title: string
  description?: string
  starsRequired: number
  imageUrl?: string
  createdByUser?: {
    id: string
    email: string
  }
  [key: string]: any
}

interface RedemptionModalProps {
  gift: FamilyGift
  totalStars: number
  claimingReward: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}

const RedemptionModal: React.FC<RedemptionModalProps> = ({ gift, totalStars, claimingReward, onClose, onConfirm }) => {
  const canAfford = totalStars >= gift.starsRequired

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overscroll-contain">
      <div className="bg-white rounded-3xl p-4 sm:p-6 max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
        <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Confirm Redemption</h3>

        <div className="mb-6">
          {gift.imageUrl && <img src={gift.imageUrl} alt={gift.title} className="w-full h-48 object-cover rounded-xl mb-4" />}
          <h4 className="text-xl font-bold text-[var(--text-primary)] mb-2">{gift.title}</h4>
          {gift.description && <p className="text-[var(--text-secondary)] mb-2">{gift.description}</p>}
          {gift.createdByUser && (
            <p className="text-sm text-[var(--text-secondary)] mb-4 italic">Added by {gift.createdByUser.email?.split('@')[0] || 'Unknown'}</p>
          )}
        </div>

        <div className="bg-[var(--card-border)]/20 rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[var(--text-secondary)]">Cost:</span>
            <span className="text-2xl font-bold text-[var(--bonus-stars)]">{gift.starsRequired} ⭐</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-[var(--card-border)]">
            <span className="text-[var(--text-secondary)]">Your Stars:</span>
            <span className="font-bold text-[var(--text-primary)]">
              {totalStars} ⭐ → {totalStars - gift.starsRequired} ⭐
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            className="min-h-[44px] flex-1 px-4 py-3 rounded-full font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400 transition-all touch-manipulation"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canAfford || claimingReward}
            className={`min-h-[44px] flex-1 px-4 py-3 rounded-full font-bold text-white transition-all touch-manipulation ${
              canAfford
                ? 'bg-[var(--primary)] hover:scale-105 active:scale-100 active:bg-[var(--primary)]/90'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {claimingReward ? '⏳ Redeeming...' : 'Confirm Redeem'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default RedemptionModal

