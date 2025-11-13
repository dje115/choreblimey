import React, { useEffect, useMemo, useState } from 'react'

import type { FamilyAdult } from '../hooks/useFamilyData'
import { apiClient } from '../../../lib/api'

interface EditAdultModalProps {
  isOpen: boolean
  adult: FamilyAdult | null
  busy?: boolean
  onClose: () => void
  onSave: (
    memberId: string,
    data: {
      displayName?: string
      chatEnabled?: boolean
      giftStarsEnabled?: boolean
      giftMoneyEnabled?: boolean
      birthMonth?: number | null
      birthYear?: number | null
    },
  ) => Promise<void>
  onGenerateDeviceToken: (
    memberId: string,
  ) => Promise<{ token?: string; emailSent?: boolean; expiresAt?: string }>
  onTogglePause: (memberId: string) => Promise<boolean>
  onRemove: (memberId: string) => Promise<void>
}

const roleLabels: Record<string, string> = {
  parent_admin: 'Parent (Admin)',
  parent_co_parent: 'Co-parent',
  parent_viewer: 'Viewer',
  grandparent: 'Grandparent',
  uncle_aunt: 'Relative',
  relative_contributor: 'Contributor',
  helper: 'Helper',
}

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

type MemberStats = {
  lastLogin?: string | null
  actions?: {
    assignmentsCreated?: number
    payoutsMade?: number
    completionsApproved?: number
  }
}

const EditAdultModal: React.FC<EditAdultModalProps> = ({
  isOpen,
  adult,
  busy = false,
  onClose,
  onSave,
  onGenerateDeviceToken,
  onTogglePause,
  onRemove,
}) => {
  const [displayName, setDisplayName] = useState('')
  const [chatEnabled, setChatEnabled] = useState(true)
  const [giftStarsEnabled, setGiftStarsEnabled] = useState(false)
  const [giftMoneyEnabled, setGiftMoneyEnabled] = useState(false)
  const [birthMonth, setBirthMonth] = useState<string>('')
  const [birthYear, setBirthYear] = useState<string>('')
  const [paused, setPaused] = useState(false)

  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [deviceLoading, setDeviceLoading] = useState(false)
  const [deviceToken, setDeviceToken] = useState<string | null>(null)
  const [deviceEmailSent, setDeviceEmailSent] = useState<boolean | null>(null)
  const [deviceExpiresAt, setDeviceExpiresAt] = useState<string | null>(null)

  const [stats, setStats] = useState<MemberStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    if (!isOpen || !adult) {
      setDisplayName('')
      setChatEnabled(true)
      setGiftStarsEnabled(false)
      setGiftMoneyEnabled(false)
      setBirthMonth('')
      setBirthYear('')
      setPaused(false)
      setSaving(false)
      setRemoving(false)
      setError(null)
      setSuccess(null)
      setDeviceToken(null)
      setDeviceEmailSent(null)
      setDeviceExpiresAt(null)
      setStats(null)
      setLoadingStats(false)
      return
    }

    setDisplayName(adult.displayName || adult.user?.email?.split('@')[0] || '')
    setChatEnabled(adult.chatEnabled !== false)
    setGiftStarsEnabled(adult.giftStarsEnabled ?? false)
    setGiftMoneyEnabled(adult.giftMoneyEnabled ?? false)
    setBirthMonth(adult.birthMonth != null ? String(adult.birthMonth) : '')
    setBirthYear(adult.birthYear != null ? String(adult.birthYear) : '')
    setPaused(adult.paused ?? false)
    setError(null)
    setSuccess(null)

    setLoadingStats(true)
    apiClient
      .getMemberStats(adult.id)
      .then((response: any) => {
        setStats(response?.stats ?? null)
      })
      .catch((statsError) => {
        console.error('Failed to load adult stats', statsError)
        setStats(null)
      })
      .finally(() => {
        setLoadingStats(false)
      })
  }, [isOpen, adult])

  const joinedAt = useMemo(() => {
    if (!adult?.joinedAt && !adult?.createdAt) {
      return null
    }
    const timestamp = adult.joinedAt || adult.createdAt
    return timestamp ? new Date(timestamp).toLocaleString('en-GB') : null
  }, [adult])

  if (!isOpen || !adult) {
    return null
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      setSaving(true)
      setError(null)
      await onSave(adult.id, {
        displayName: displayName.trim() || undefined,
        chatEnabled,
        giftStarsEnabled,
        giftMoneyEnabled,
        birthMonth: birthMonth ? Number(birthMonth) : null,
        birthYear: birthYear ? Number(birthYear) : null,
      })
      setSuccess('Changes saved.')
    } catch (err: any) {
      console.error('Failed to update adult', err)
      setError(err?.message || 'Failed to update member.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    if (!window.confirm('Remove this adult from the family? They will lose access.')) {
      return
    }
    try {
      setRemoving(true)
      setError(null)
      await onRemove(adult.id)
      onClose()
    } catch (err: any) {
      console.error('Failed to remove adult', err)
      setError(err?.message || 'Failed to remove member.')
    } finally {
      setRemoving(false)
    }
  }

  const handleGenerateDeviceToken = async () => {
    try {
      setDeviceLoading(true)
      setDeviceEmailSent(null)
      setDeviceToken(null)
      setDeviceExpiresAt(null)
      const response = await onGenerateDeviceToken(adult.id)
      setDeviceToken(response?.token ?? null)
      setDeviceEmailSent(response?.emailSent ?? null)
      setDeviceExpiresAt(response?.expiresAt ?? null)
      setSuccess('Device access link generated.')
    } catch (err: any) {
      console.error('Failed to generate device token', err)
      setError(err?.message || 'Failed to generate device access. Please try again.')
    } finally {
      setDeviceLoading(false)
    }
  }

  const handleTogglePause = async () => {
    try {
      const next = await onTogglePause(adult.id)
      setPaused(next)
      setSuccess(`Account ${next ? 'paused' : 'reactivated'} successfully.`)
    } catch (err: any) {
      console.error('Failed to toggle pause state', err)
      setError(err?.message || 'Failed to update account status.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Adult settings</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{displayName || adult.user?.email || 'Adult member'}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Update permissions, contact details, and device access without switching back to the legacy dashboard.
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

        <form onSubmit={handleSave} className="space-y-6 px-6 py-6">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Profile</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Display name</label>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                  placeholder={adult.user?.email?.split('@')[0] || 'Name shown in dashboard'}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Email</label>
                <input
                  value={adult.user?.email || '—'}
                  readOnly
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Role</label>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  {roleLabels[adult.role] || adult.role}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Joined family</label>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  {joinedAt || 'Unknown'}
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Birthday month</label>
                <select
                  value={birthMonth}
                  onChange={(event) => setBirthMonth(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                >
                  <option value="">Not set</option>
                  {months.map((label, index) => (
                    <option key={label} value={index + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Birthday year</label>
                <input
                  type="number"
                  min={1900}
                  max={new Date().getFullYear()}
                  value={birthYear}
                  onChange={(event) => setBirthYear(event.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Permissions</h3>
            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={giftStarsEnabled}
                  onChange={(event) => setGiftStarsEnabled(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span>
                  <span className="font-semibold text-slate-800">⭐ Gift Stars</span>
                  <span className="mt-1 block text-xs text-slate-500">Allow gifting stars directly to children.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={giftMoneyEnabled}
                  onChange={(event) => setGiftMoneyEnabled(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>
                  <span className="font-semibold text-slate-800">💷 Gift Pocket Money</span>
                  <span className="mt-1 block text-xs text-slate-500">Enable gifting cash payouts to children.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={chatEnabled}
                  onChange={(event) => setChatEnabled(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="font-semibold text-slate-800">💬 Family Chat</span>
                  <span className="mt-1 block text-xs text-slate-500">Give access to the in-app chat experience.</span>
                </span>
              </label>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Device access</h3>
              <p className="mt-2 text-xs text-slate-500">
                Send a magic-link email or copy the token for manual login on another device. Links expire after 7 days.
              </p>
              <button
                type="button"
                onClick={handleGenerateDeviceToken}
                disabled={deviceLoading}
                className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
              >
                {deviceLoading ? 'Generating…' : 'Send device access email'}
              </button>
              {(deviceToken || deviceEmailSent !== null) && (
                <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                  {deviceEmailSent !== null && (
                    <p>{deviceEmailSent ? '✅ Email sent to member.' : '⚠️ Email failed — token available below.'}</p>
                  )}
                  {deviceExpiresAt && <p>Expires: {new Date(deviceExpiresAt).toLocaleString('en-GB')}</p>}
                  {deviceToken && (
                    <div className="space-y-2">
                      <div className="font-mono text-sm font-semibold text-indigo-700 break-all">{deviceToken}</div>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(deviceToken)}
                        className="rounded-full border border-indigo-300 px-3 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-50"
                      >
                        Copy token
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Account status</h3>
              <p className="mt-2 text-xs text-slate-500">
                Temporarily pause or reinstate access without removing the member from your family.
              </p>
              <button
                type="button"
                onClick={handleTogglePause}
                className={`mt-3 w-full rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                  paused ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                {paused ? 'Reactivate account' : 'Pause account'}
              </button>
              <p className="mt-2 text-[11px] text-slate-500">
                {paused
                  ? 'Member cannot sign in until you reactivate their access.'
                  : 'Pausing disables sign-in but keeps their history intact.'}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Activity snapshot</h3>
            {loadingStats ? (
              <p className="mt-2 text-xs text-slate-500">Loading stats…</p>
            ) : stats ? (
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                  <div className="text-lg font-bold text-indigo-700">
                    {stats.actions?.assignmentsCreated ?? 0}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Chores assigned</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                  <div className="text-lg font-bold text-indigo-700">{stats.actions?.payoutsMade ?? 0}</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Payouts made</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                  <div className="text-lg font-bold text-indigo-700">{stats.actions?.completionsApproved ?? 0}</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Approvals</div>
                </div>
                <div className="md:col-span-3 rounded-xl border border-slate-200 bg-indigo-50 px-3 py-3 text-sm text-indigo-700">
                  Last login: {stats.lastLogin ? new Date(stats.lastLogin).toLocaleString('en-GB') : 'Never'}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-amber-600">
                Stats are unavailable right now. Try again later.
              </p>
            )}
          </section>

          {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
          {success && <p className="text-sm font-semibold text-emerald-600">{success}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || busy}
              className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
            >
              {saving || busy ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="rounded-full border border-rose-300 px-5 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {removing ? 'Removing…' : 'Remove member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditAdultModal
