import React, { useEffect, useMemo, useState } from 'react'

import type { FamilyChild } from '../hooks/useFamilyData'
import { apiClient } from '../../../lib/api'

const ageGroups = ['under5', '5-7', '8-10', '11-13', '14-16', '16+']

interface EditChildModalProps {
  isOpen: boolean
  child: FamilyChild | null
  busy?: boolean
  onClose: () => void
  onSave: (
    childId: string,
    data: {
      nickname?: string
      ageGroup?: string
      gender?: string
      email?: string
      birthMonth?: number | null
      birthYear?: number | null
    },
  ) => Promise<void>
  onGenerateJoinCode: (data: { nickname: string; ageGroup: string; gender?: string }) => Promise<{ joinCode: { code: string; expiresAt: string } }>
  onTogglePause: (childId: string) => Promise<boolean>
  onRemove: (childId: string) => Promise<void>
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

const EditChildModal: React.FC<EditChildModalProps> = ({
  isOpen,
  child,
  busy = false,
  onClose,
  onSave,
  onGenerateJoinCode,
  onTogglePause,
  onRemove,
}) => {
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState<string>('other')
  const [email, setEmail] = useState('')
  const [birthMonth, setBirthMonth] = useState<string>('')
  const [birthYear, setBirthYear] = useState<string>('')
  const [paused, setPaused] = useState(false)

  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [generatingCode, setGeneratingCode] = useState(false)
  const [joinCode, setJoinCode] = useState<string | null>(null)
  const [joinCodeExpires, setJoinCodeExpires] = useState<string | null>(null)

  const [walletStars, setWalletStars] = useState<number>(0)
  const [walletBalancePence, setWalletBalancePence] = useState<number>(0)
  const [lifetimeEarningsPence, setLifetimeEarningsPence] = useState<number>(0)
  const [lifetimePaidOutPence, setLifetimePaidOutPence] = useState<number>(0)
  const [loadingSnapshot, setLoadingSnapshot] = useState(false)

  useEffect(() => {
    if (!isOpen || !child) {
      setNickname('')
      setGender('other')
      setEmail('')
      setBirthMonth('')
      setBirthYear('')
      setPaused(false)
      setSaving(false)
      setRemoving(false)
      setError(null)
      setSuccess(null)
      setGeneratingCode(false)
      setJoinCode(null)
      setJoinCodeExpires(null)
      setWalletStars(0)
      setWalletBalancePence(0)
      setLifetimeEarningsPence(0)
      setLifetimePaidOutPence(0)
      setLoadingSnapshot(false)
      return
    }

    setNickname(child.nickname)
    setGender(child.gender || 'other')
    setEmail(child.email || '')
    setBirthMonth(child.birthMonth != null ? String(child.birthMonth) : '')
    setBirthYear(child.birthYear != null ? String(child.birthYear) : '')
    setPaused(child.paused ?? false)
    setError(null)
    setSuccess(null)

    setLoadingSnapshot(true)
    Promise.all([
      apiClient.getWallet(child.id).catch(() => ({ wallet: { balancePence: 0, stars: 0 } })),
      apiClient.getWalletStats(child.id).catch(() => ({ stats: { lifetimeEarningsPence: 0, lifetimePaidOutPence: 0 } })),
    ])
      .then(([walletRes, statsRes]: any[]) => {
        const wallet = walletRes?.wallet ?? {}
        const stats = statsRes?.stats ?? {}
        setWalletStars(wallet.stars ?? 0)
        setWalletBalancePence(wallet.balancePence ?? 0)
        setLifetimeEarningsPence(stats.lifetimeEarningsPence ?? 0)
        setLifetimePaidOutPence(stats.lifetimePaidOutPence ?? 0)
      })
      .catch((snapshotError) => {
        console.error('Failed to load child snapshot', snapshotError)
      })
      .finally(() => {
        setLoadingSnapshot(false)
      })
  }, [isOpen, child])

  const ageGroupLabel = useMemo(() => {
    if (!child?.ageGroup) return 'Not set'
    const label = child.ageGroup
    return label
  }, [child])

  if (!isOpen || !child) {
    return null
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!nickname.trim()) {
      setError('Nickname is required.')
      return
    }
    if (!birthYear) {
      setError('Birth year is required to keep age-appropriate experiences.')
      return
    }

    try {
      setSaving(true)
      setError(null)
      await onSave(child.id, {
        nickname: nickname.trim(),
        gender,
        email: email.trim() || undefined,
        birthMonth: birthMonth ? Number(birthMonth) : null,
        birthYear: birthYear ? Number(birthYear) : null,
      })
      setSuccess('Changes saved.')
    } catch (err: any) {
      console.error('Failed to update child', err)
      setError(err?.message || 'Failed to update child.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    if (!window.confirm('Remove this child from the family? They will lose access.')) {
      return
    }
    try {
      setRemoving(true)
      setError(null)
      await onRemove(child.id)
      onClose()
    } catch (err: any) {
      console.error('Failed to remove child', err)
      setError(err?.message || 'Failed to remove child.')
    } finally {
      setRemoving(false)
    }
  }

  const handleGenerateJoinCode = async () => {
    try {
      setGeneratingCode(true)
      setJoinCode(null)
      setJoinCodeExpires(null)
      const response = await onGenerateJoinCode({
        nickname: nickname.trim() || child.nickname,
        ageGroup: child.ageGroup || '8-10',
        gender,
      })
      const code = response?.joinCode?.code
      setJoinCode(code ?? null)
      setJoinCodeExpires(response?.joinCode?.expiresAt ?? null)
      setSuccess('New join code generated.')
    } catch (err: any) {
      console.error('Failed to generate join code', err)
      setError(err?.message || 'Unable to generate join code.')
    } finally {
      setGeneratingCode(false)
    }
  }

  const handleTogglePause = async () => {
    try {
      const next = await onTogglePause(child.id)
      setPaused(next)
      setSuccess(`Child account ${next ? 'paused' : 're-activated'} successfully.`)
    } catch (err: any) {
      console.error('Failed to toggle child pause', err)
      setError(err?.message || 'Failed to update account status.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Child settings</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{nickname || child.nickname}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Tweak basic details, manage join codes, and keep their account safe without leaving the new dashboard.
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
                <label className="block text-sm font-semibold text-slate-700">Nickname</label>
                <input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                  placeholder="Child nickname"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Age group</label>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  {ageGroupLabel}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Gender</label>
                <select
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other / Prefer not to say</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Email (optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="child@example.com"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Birth month</label>
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
                <label className="block text-sm font-semibold text-slate-700">Birth year</label>
                <input
                  type="number"
                  min={2000}
                  max={new Date().getFullYear()}
                  value={birthYear}
                  onChange={(event) => setBirthYear(event.target.value)}
                  placeholder="e.g. 2014"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Wallet snapshot</h3>
            {loadingSnapshot ? (
              <p className="mt-3 text-xs text-slate-500">Loading balances…</p>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                  <div className="text-lg font-bold text-indigo-700">{walletStars.toLocaleString('en-GB')}⭐</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Current stars</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                  <div className="text-lg font-bold text-indigo-700">£{(walletBalancePence / 100).toFixed(2)}</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Pocket money outstanding</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                  <div className="text-lg font-bold text-indigo-700">£{(lifetimeEarningsPence / 100).toFixed(2)}</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Lifetime earned</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                  <div className="text-lg font-bold text-indigo-700">£{(lifetimePaidOutPence / 100).toFixed(2)}</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Lifetime paid out</div>
                </div>
              </div>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Generate join code</h3>
              <p className="mt-2 text-xs text-slate-500">
                Create a fresh code if your child needs to sign in on a new device.
              </p>
              <button
                type="button"
                onClick={handleGenerateJoinCode}
                disabled={generatingCode}
                className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
              >
                {generatingCode ? 'Generating…' : 'Generate new join code'}
              </button>
              {joinCode && (
                <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <div className="font-mono text-lg font-semibold tracking-widest text-indigo-700 text-center">{joinCode}</div>
                  {joinCodeExpires && (
                    <p className="text-[11px] text-slate-500 text-center">
                      Expires {new Date(joinCodeExpires).toLocaleDateString('en-GB')}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(joinCode)}
                    className="w-full rounded-full border border-indigo-300 px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                  >
                    Copy code
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Account status</h3>
              <p className="mt-2 text-xs text-slate-500">
                Pause access during holidays or downtime without deleting progress.
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
                  ? 'The child is currently paused and cannot log in.'
                  : 'Pausing hides the dashboard for the child until you re-activate.'}
              </p>
            </div>
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
              {removing ? 'Removing…' : 'Remove child'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditChildModal
