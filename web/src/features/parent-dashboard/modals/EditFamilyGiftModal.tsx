import React, { useEffect, useMemo, useState } from 'react'

import type { UseStreakRewardsDataResult } from '../hooks/useStreakRewardsData'

type FamilyGift = UseStreakRewardsDataResult['gifts'][number]

interface ChildOption {
  id: string
  nickname: string
}

interface EditFamilyGiftModalProps {
  isOpen: boolean
  gift: FamilyGift | null
  onClose: () => void
  onSave: (
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
  ) => Promise<void>
  onDelete: (giftId: string) => Promise<void>
  busy?: boolean
  children: ChildOption[]
}

const EditFamilyGiftModal: React.FC<EditFamilyGiftModalProps> = ({
  isOpen,
  gift,
  onClose,
  onSave,
  onDelete,
  busy = false,
  children,
}) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [starsRequired, setStarsRequired] = useState<string>('')
  const [availableForAll, setAvailableForAll] = useState(true)
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([])
  const [recurring, setRecurring] = useState(true)
  const [imageUrl, setImageUrl] = useState('')
  const [affiliateUrl, setAffiliateUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !gift) {
      setTitle('')
      setDescription('')
      setStarsRequired('')
      setAvailableForAll(true)
      setSelectedChildIds([])
      setRecurring(true)
      setImageUrl('')
      setAffiliateUrl('')
      setSaving(false)
      setError(null)
      setSuccess(null)
      return
    }

    setTitle(gift.title ?? '')
    setDescription(gift.description ?? '')
    const starValue = gift.starsRequired ?? gift.starsCost ?? 0
    setStarsRequired(starValue ? String(starValue) : '')
    setAvailableForAll(gift.availableForAll !== false)
    setSelectedChildIds(gift.availableForChildIds ?? [])
    setRecurring(gift.recurring !== false)
    setImageUrl(gift.imageUrl ?? '')
    setAffiliateUrl((gift as any).affiliateUrl ?? '')
    setError(null)
    setSuccess(null)
  }, [isOpen, gift])

  const numericStarsRequired = useMemo(() => {
    const parsed = parseInt(starsRequired, 10)
    return Number.isNaN(parsed) ? 0 : parsed
  }, [starsRequired])

  const toggleChildSelection = (childId: string) => {
    setSelectedChildIds((previous) =>
      previous.includes(childId) ? previous.filter((id) => id !== childId) : [...previous, childId],
    )
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!gift) return

    if (!numericStarsRequired || numericStarsRequired < 1) {
      setError('Star cost must be at least 1')
      return
    }

    try {
      setSaving(true)
      setError(null)
      await onSave(gift.id, {
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        starsRequired: numericStarsRequired,
        availableForAll,
        availableForChildIds: availableForAll ? [] : selectedChildIds,
        recurring,
        imageUrl: imageUrl.trim() || null,
        affiliateUrl: affiliateUrl.trim() || null,
      })
      setSuccess('Gift updated successfully')
    } catch (err: any) {
      console.error('Failed to update gift', err)
      setError(err?.message || 'Failed to update gift')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!gift) return
    if (!window.confirm('Delete this gift from the family shop?')) {
      return
    }

    try {
      setDeleting(true)
      setError(null)
      await onDelete(gift.id)
      onClose()
    } catch (err: any) {
      console.error('Failed to delete gift', err)
      setError(err?.message || 'Failed to delete gift')
    } finally {
      setDeleting(false)
    }
  }

  if (!isOpen || !gift) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Family gift shop</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Edit gift</h2>
            <p className="mt-2 text-sm text-slate-600">
              Adjust reward details, star cost, and who can redeem it. Changes are live for children immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
          >
            Close
          </button>
        </header>

        <form onSubmit={handleSave} className="space-y-5 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Gift title *</label>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Stars required *</label>
              <input
                type="number"
                min={1}
                value={starsRequired}
                onChange={(event) => setStarsRequired(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Image URL</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Affiliate / product link</label>
              <input
                type="url"
                value={affiliateUrl}
                onChange={(event) => setAffiliateUrl(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 rounded-2xl border border-slate-200 px-4 py-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={availableForAll}
                onChange={(event) => setAvailableForAll(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-semibold text-slate-700">Available to all children</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(event) => setRecurring(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-semibold text-slate-700">Allow multiple redemptions</span>
            </label>
          </div>

          {!availableForAll && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-semibold text-slate-700">Eligible children</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {children.length === 0 ? (
                  <p className="text-xs text-slate-500">Add children to the family to assign this gift.</p>
                ) : (
                  children.map((child) => (
                    <label
                      key={child.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600"
                    >
                      <input
                        type="checkbox"
                        checked={selectedChildIds.includes(child.id)}
                        onChange={() => toggleChildSelection(child.id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{child.nickname}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
          {success && <p className="text-sm font-semibold text-emerald-600">{success}</p>}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={saving || busy}
              className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
            >
              {saving || busy ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="ml-auto rounded-full border border-rose-200 px-5 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Deleting…' : 'Delete gift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditFamilyGiftModal
