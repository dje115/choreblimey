import React, { useEffect, useMemo, useState } from 'react'

import { apiClient } from '../../../lib/api'
import { notifyUpdate } from '../../../utils/notifications'
import type { ChildFinanceSummary } from '../hooks/useFinancesData'

interface PendingGift {
  id: string
  title?: string | null
  moneyPence?: number | null
  childId?: string | null
  status?: string | null
}

interface ProcessPayoutModalProps {
  isOpen: boolean
  child: ChildFinanceSummary | null
  onClose: () => void
  onCompleted: () => Promise<void> | void
}

const formatCurrency = (pence: number) => (pence / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })

const ProcessPayoutModal: React.FC<ProcessPayoutModalProps> = ({ isOpen, child, onClose, onCompleted }) => {
  const [cashAmount, setCashAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'bank_transfer' | 'other'>('cash')
  const [note, setNote] = useState('')
  const [childGifts, setChildGifts] = useState<PendingGift[]>([])
  const [selectedGiftIds, setSelectedGiftIds] = useState<string[]>([])
  const [loadingGifts, setLoadingGifts] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const reset = () => {
      setCashAmount('')
      setMethod('cash')
      setNote('')
      setChildGifts([])
      setSelectedGiftIds([])
      setLoadingGifts(false)
      setSubmitting(false)
      setError(null)
      setSuccess(null)
    }

    if (!isOpen || !child) {
      reset()
      return
    }

    setCashAmount(child.balancePence > 0 ? (child.balancePence / 100).toFixed(2) : '')
    const loadChildGifts = async () => {
      try {
        setLoadingGifts(true)
        const response = await apiClient.listGifts({ childId: child.childId, status: 'pending' })
        const pendingGifts: PendingGift[] = (response?.gifts ?? []).filter((gift: any) => gift.moneyPence > 0)
        setChildGifts(pendingGifts)
      } catch (err) {
        console.error('Failed to fetch pending gifts', err)
        setChildGifts([])
      } finally {
        setLoadingGifts(false)
      }
    }

    void loadChildGifts()
  }, [isOpen, child])

  const outstandingPence = child?.balancePence ?? 0
  const cashAmountPence = useMemo(() => {
    if (!cashAmount) return 0
    const value = Math.round(parseFloat(cashAmount) * 100)
    return Number.isFinite(value) ? value : 0
  }, [cashAmount])

  const selectedGiftTotalPence = useMemo(() => {
    return selectedGiftIds.reduce((sum, giftId) => {
      const gift = childGifts.find((item) => item.id === giftId)
      return sum + (gift?.moneyPence ?? 0)
    }, 0)
  }, [selectedGiftIds, childGifts])

  const grandTotalPence = cashAmountPence + selectedGiftTotalPence

  if (!isOpen || !child) {
    return null
  }

  const toggleGiftSelection = (giftId: string) => {
    setSelectedGiftIds((previous) =>
      previous.includes(giftId) ? previous.filter((id) => id !== giftId) : [...previous, giftId],
    )
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (grandTotalPence <= 0) {
      setError('Enter an amount to pay out or select gifts to mark as delivered.')
      return
    }

    if (cashAmountPence < 0 || selectedGiftTotalPence < 0) {
      setError('Amounts must be non-negative numbers.')
      return
    }

    if (cashAmountPence > outstandingPence) {
      setError('Cash payout cannot exceed the outstanding pocket money for this child.')
      return
    }

    try {
      setSubmitting(true)
      await apiClient.createPayout({
        childId: child.childId,
        amountPence: grandTotalPence,
        choreAmountPence: cashAmountPence > 0 ? cashAmountPence : undefined,
        method,
        note: note.trim() || undefined,
        giftIds: selectedGiftIds.length > 0 ? selectedGiftIds : undefined,
      })
      notifyUpdate('familyUpdated')
      if (selectedGiftIds.length > 0) {
        notifyUpdate('giftUpdated')
      }
      setSuccess('Payout recorded successfully.')
      await onCompleted()
      onClose()
    } catch (err: any) {
      console.error('Failed to process payout', err)
      setError(err?.message || 'Failed to record payout. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Process payout</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Pay out {child.nickname}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Mark cash payouts and optionally close pending money gifts at the same time. Totals update the child’s wallet instantly.
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
            <p className="font-semibold text-slate-800">Current balance snapshot</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-600">
                Outstanding {formatCurrency(outstandingPence)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-600">
                Stars {child.stars.toLocaleString('en-GB')}⭐
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Lifetime paid out {formatCurrency(child.lifetimePaidOutPence)}
              </span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Cash amount (£)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={cashAmount}
                onChange={(event) => setCashAmount(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
              />
              <p className="text-xs text-slate-500">Outstanding balance: {formatCurrency(outstandingPence)}</p>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Payment method</label>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    { value: 'cash', label: '💵 Cash' },
                    { value: 'bank_transfer', label: '🏦 Transfer' },
                    { value: 'other', label: '📝 Other' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMethod(option.value)}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      method === option.value
                        ? 'bg-indigo-600 text-white shadow'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Note (optional)</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
              placeholder="e.g. Paid cash after Saturday chores"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Pending money gifts</p>
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                {childGifts.length}
              </span>
            </div>
            {loadingGifts ? (
              <p className="mt-3 text-xs text-slate-500">Loading gifts…</p>
            ) : childGifts.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">No pending gifts with cash value.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {childGifts.map((gift) => {
                  const moneyPence = gift.moneyPence ?? 0
                  const checked = selectedGiftIds.includes(gift.id)
                  return (
                    <label
                      key={gift.id}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                        checked ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGiftSelection(gift.id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>{gift.title ?? 'Gift'}</span>
                      </div>
                      <span className="font-semibold text-emerald-700">{formatCurrency(moneyPence)}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-sm font-semibold text-slate-700">Summary</p>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Cash payout</span>
                <span>{formatCurrency(cashAmountPence)}</span>
              </div>
              <div className="flex justify-between">
                <span>Selected gifts</span>
                <span>{formatCurrency(selectedGiftTotalPence)}</span>
              </div>
            </div>
            <div className="mt-3 flex justify-between text-base font-bold text-slate-900">
              <span>Total recorded payout</span>
              <span>{formatCurrency(grandTotalPence)}</span>
            </div>
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
              {submitting ? 'Recording…' : 'Record payout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProcessPayoutModal

