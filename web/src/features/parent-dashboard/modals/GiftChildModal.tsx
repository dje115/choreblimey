import React, { useEffect, useState } from 'react'

import { apiClient } from '../../../lib/api'
import { notifyUpdate } from '../../../utils/notifications'
import type { ChildFinanceSummary } from '../hooks/useFinancesData'

interface GiftChildModalProps {
  isOpen: boolean
  child: ChildFinanceSummary | null
  onClose: () => void
  onCompleted: () => Promise<void> | void
}

const GiftChildModal: React.FC<GiftChildModalProps> = ({ isOpen, child, onClose, onCompleted }) => {
  const [stars, setStars] = useState('')
  const [money, setMoney] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setStars('')
      setMoney('')
      setNote('')
      setSubmitting(false)
      setError(null)
      setSuccess(null)
    }
  }, [isOpen])

  if (!isOpen || !child) {
    return null
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const starsAmount = stars ? parseInt(stars, 10) : 0
    const moneyPence = money ? Math.round(parseFloat(money) * 100) : 0

    if (Number.isNaN(starsAmount) || starsAmount < 0) {
      setError('Stars must be a non-negative number')
      return
    }

    if (Number.isNaN(moneyPence) || moneyPence < 0) {
      setError('Money amount must be a non-negative number')
      return
    }

    if (starsAmount === 0 && moneyPence === 0) {
      setError('Enter stars or money (or both) to gift')
      return
    }

    try {
      setSubmitting(true)
      await apiClient.createGift({
        childId: child.childId,
        starsAmount: starsAmount || undefined,
        moneyPence: moneyPence || undefined,
        note: note.trim() || undefined,
      })
      notifyUpdate('familyUpdated')
      setSuccess('Gift sent!')
      await onCompleted()
      onClose()
    } catch (err: any) {
      console.error('Failed to create gift', err)
      setError(err?.message || 'Failed to send gift. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Gift stars or money</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Gift for {child.nickname}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Add a surprise bonus or pocket money without waiting for a payout. Stars appear instantly in the child’s wallet.
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

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">Current wallet snapshot</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-600">
                Outstanding { (child.balancePence / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' }) }
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-600">
                Stars {child.stars.toLocaleString('en-GB')}⭐
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Stars (optional)</label>
            <input
              type="number"
              min={0}
              step={1}
              value={stars}
              onChange={(event) => setStars(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Money (£) (optional)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={money}
              onChange={(event) => setMoney(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
              placeholder="0.00"
            />
            <p className="text-xs text-slate-500">Money comes directly from the family wallet outside of the tracked outstanding balance.</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Note (optional)</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
              placeholder="e.g. Happy birthday! 🎉"
            />
          </div>

          {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
          {success && <p className="text-sm font-semibold text-emerald-600">{success}</p>}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
            >
              {submitting ? 'Sending…' : 'Send gift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default GiftChildModal

