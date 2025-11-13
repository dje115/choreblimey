import React, { useMemo, useState } from 'react'

import { useStreakRewardsData } from '../hooks/useStreakRewardsData'
import { useFamilyData } from '../hooks/useFamilyData'
import CreateFamilyGiftModal from '../modals/CreateFamilyGiftModal'
import EditFamilyGiftModal from '../modals/EditFamilyGiftModal'

const GiftShopTab: React.FC = () => {
  const {
    loading,
    refreshing,
    error,
    family,
    gifts,
    refresh,
    toggleGiftShop,
    setGiftActive,
    updateGift,
    deleteGift,
    busyGiftIds,
  } = useStreakRewardsData()
  const { children } = useFamilyData()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingGiftId, setEditingGiftId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const giftShopEnabled = family?.giftsEnabled !== false
  const activeGifts = gifts.filter((gift) => gift.active)
  const inactiveGifts = gifts.filter((gift) => !gift.active)
  const childOptions = useMemo(() => children.map((child) => ({ id: child.id, nickname: child.nickname })), [children])
  const editingGift = useMemo(() => gifts.find((gift) => gift.id === editingGiftId) ?? null, [gifts, editingGiftId])

  const handleRefresh = async () => {
    try {
      await refresh()
      setFeedback({ type: 'success', message: 'Gift shop refreshed.' })
    } catch (err: any) {
      console.error('Failed to refresh gift shop', err)
      setFeedback({ type: 'error', message: err?.message || 'Unable to refresh gift shop.' })
    }
  }

  const handleToggleGiftShop = async () => {
    try {
      await toggleGiftShop(!giftShopEnabled)
      setFeedback({ type: 'success', message: `Gift shop ${giftShopEnabled ? 'disabled' : 'enabled'}.` })
    } catch (err: any) {
      console.error('Failed to toggle gift shop', err)
      setFeedback({ type: 'error', message: err?.message || 'Unable to update gift shop status.' })
    }
  }

  const handleToggleGiftActive = async (giftId: string, active: boolean) => {
    try {
      await setGiftActive(giftId, active)
      setFeedback({ type: 'success', message: active ? 'Gift activated.' : 'Gift paused.' })
    } catch (err: any) {
      console.error('Failed to toggle gift state', err)
      setFeedback({ type: 'error', message: err?.message || 'Unable to update gift state.' })
    }
  }

  const handleSaveGift = async (
    giftId: string,
    data: {
      title?: string
      description?: string
      starsRequired?: number
      availableForAll?: boolean
      availableForChildIds?: string[]
      recurring?: boolean
      imageUrl?: string | null
      affiliateUrl?: string | null
    },
  ) => {
    try {
      await updateGift(giftId, data)
      setFeedback({ type: 'success', message: 'Gift updated successfully.' })
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Unable to update gift.' })
      throw err
    }
  }

  const handleDeleteGift = async (giftId: string) => {
    try {
      await deleteGift(giftId)
      setFeedback({ type: 'success', message: 'Gift deleted from the shop.' })
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Unable to delete gift.' })
      throw err
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase text-indigo-700">Gift shop</div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Family Reward Store</h1>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded-full border border-orange-400 bg-white px-4 py-2 text-xs font-semibold text-orange-500 transition hover:bg-orange-500 hover:text-white"
          >
            ➕ Add gift
          </button>
        </div>
        <p className="text-sm text-slate-600 sm:max-w-3xl">
          Curate the family gift shop. Add Amazon or custom rewards, adjust star costs, and control availability for each child.
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
          <span className="font-semibold">Failed to load gift shop:</span> {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Gift shop status</p>
            <p className="text-xs text-slate-500">Toggle the shop on/off for children. Changes apply immediately.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">Enable shop</span>
            <button
              type="button"
              role="switch"
              aria-checked={giftShopEnabled}
              onClick={handleToggleGiftShop}
              className={`relative inline-flex h-6 w-11 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                giftShopEnabled ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  giftShopEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Active gifts</p>
            <p className="text-xs text-slate-500">These rewards are visible to children right now.</p>
          </div>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
            {activeGifts.length} active
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {activeGifts.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
              <div className="text-4xl">🎁</div>
              <p className="mt-2 text-sm text-slate-500">No active gifts right now. Add one to get started.</p>
            </div>
          ) : (
            activeGifts.map((gift) => {
              const stars = gift.starsRequired ?? gift.starsCost ?? 0
              return (
                <div
                  key={gift.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                    {gift.imageUrl ? (
                      <img
                        src={gift.imageUrl}
                        alt={gift.title}
                        className="h-24 w-24 rounded-xl border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-2xl">
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
                        {gift.type && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-semibold capitalize text-slate-600">
                            🏷️ {gift.type.replace('_', ' ')}
                          </span>
                        )}
                        {gift.availableForAll === false && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-semibold text-slate-600">
                            🎯 Limited
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleGiftActive(gift.id, false)}
                      disabled={busyGiftIds.has(gift.id)}
                      className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Pause gift
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingGiftId(gift.id)}
                      className="rounded-full border border-indigo-200 px-4 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                    >
                      Manage
                    </button>
                    {gift.affiliateUrl && (
                      <a
                        href={gift.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                      >
                        Open link
                      </a>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Paused / draft gifts</p>
            <p className="text-xs text-slate-500">Gifts saved for later. Reactivate them when you’re ready.</p>
          </div>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
            {inactiveGifts.length} inactive
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {inactiveGifts.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
              <div className="text-4xl">🗂️</div>
              <p className="mt-2 text-sm text-slate-500">No paused gifts. Pause a gift to hide it without deleting.</p>
            </div>
          ) : (
            inactiveGifts.map((gift) => {
              const stars = gift.starsRequired ?? gift.starsCost ?? 0
              return (
                <div
                  key={gift.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                    {gift.imageUrl ? (
                      <img
                        src={gift.imageUrl}
                        alt={gift.title}
                        className="h-24 w-24 rounded-xl border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-2xl">
                        🎁
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{gift.title}</p>
                      {gift.description && <p className="text-xs text-slate-500">{gift.description}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                          ⭐ {stars}
                        </span>
                        {gift.availableForAll === false && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                            🎯 Limited
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleGiftActive(gift.id, true)}
                      disabled={busyGiftIds.has(gift.id)}
                      className="rounded-full border border-emerald-300 px-4 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Activate
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingGiftId(gift.id)}
                      className="rounded-full border border-indigo-200 px-4 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                    >
                      Manage
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await handleDeleteGift(gift.id)
                        } catch (err) {
                          // feedback already set in helper
                        }
                      }}
                      className="rounded-full border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">Loading gift data…</div>
      )}

      {showCreateModal && (
        <CreateFamilyGiftModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={refresh}
          children={childOptions}
        />
      )}

      {editingGift && (
        <EditFamilyGiftModal
          isOpen={Boolean(editingGift)}
          gift={editingGift}
          onClose={() => setEditingGiftId(null)}
          onSave={handleSaveGift}
          onDelete={async (giftId) => {
            await handleDeleteGift(giftId)
            setEditingGiftId(null)
          }}
          busy={busyGiftIds.has(editingGift.id)}
          children={childOptions}
        />
      )}
    </div>
  )
}

export default GiftShopTab
