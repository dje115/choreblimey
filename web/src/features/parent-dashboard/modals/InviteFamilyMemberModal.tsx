import React, { useMemo, useState } from 'react'

const ageGroups = ['under5', '5-7', '8-10', '11-13', '14-16', '16+']
const adultRoles = [
  { value: 'parent_admin', label: 'Parent (Admin)' },
  { value: 'parent_co_parent', label: 'Co-parent' },
  { value: 'parent_viewer', label: 'Viewer' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'uncle_aunt', label: 'Relative' },
  { value: 'relative_contributor', label: 'Contributor' },
] as const

interface InviteFamilyMemberModalProps {
  isOpen: boolean
  familyName?: string
  creatingJoinCode: boolean
  invitingChild: boolean
  invitingAdult: boolean
  onClose: () => void
  onGenerateJoinCode: (data: { nickname: string; ageGroup: string; gender?: string }) => Promise<any>
  onInviteChild: (data: {
    nameCipher: string
    nickname: string
    ageGroup: string
    birthYear?: number
    birthMonth?: number
    email?: string
    sendEmail?: boolean
  }) => Promise<void>
  onInviteAdult: (data: {
    email: string
    nameCipher: string
    role: 'parent_admin' | 'parent_co_parent' | 'parent_viewer' | 'grandparent' | 'uncle_aunt' | 'relative_contributor'
    sendEmail?: boolean
  }) => Promise<void>
}

const InviteFamilyMemberModal: React.FC<InviteFamilyMemberModalProps> = ({
  isOpen,
  familyName,
  creatingJoinCode,
  invitingChild,
  invitingAdult,
  onClose,
  onGenerateJoinCode,
  onInviteChild,
  onInviteAdult,
}) => {
  const [mode, setMode] = useState<'child' | 'adult'>('child')
  const [childForm, setChildForm] = useState({
    realName: '',
    nickname: '',
    ageGroup: '8-10',
    birthYear: '',
    birthMonth: '',
    gender: '',
    email: '',
  })
  const [adultForm, setAdultForm] = useState({ email: '', displayName: '', role: 'parent_admin', sendEmail: true })
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [generatedExpiry, setGeneratedExpiry] = useState<string | null>(null)

  const resetState = () => {
    setMode('child')
    setChildForm({ realName: '', nickname: '', ageGroup: '8-10', birthYear: '', birthMonth: '', gender: '', email: '' })
    setAdultForm({ email: '', displayName: '', role: 'parent_admin', sendEmail: true })
    setFeedback(null)
    setGeneratedCode(null)
    setGeneratedExpiry(null)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const derivedChildNickname = useMemo(() => {
    if (childForm.nickname.trim()) return childForm.nickname.trim()
    if (childForm.realName.trim()) return childForm.realName.trim().split(' ')[0]
    return ''
  }, [childForm.nickname, childForm.realName])

  const handleGenerateJoinCode = async () => {
    if (!derivedChildNickname) {
      setFeedback({ type: 'error', message: 'Enter the child’s name or nickname first.' })
      return
    }
    if (!childForm.ageGroup) {
      setFeedback({ type: 'error', message: 'Select an age group.' })
      return
    }
    try {
      setFeedback(null)
      const response = await onGenerateJoinCode({ nickname: derivedChildNickname, ageGroup: childForm.ageGroup, gender: childForm.gender || undefined })
      const code = response?.joinCode || response?.code
      if (code) {
        setGeneratedCode(code)
        setGeneratedExpiry(response?.expiresAt ? new Date(response.expiresAt).toLocaleDateString('en-GB') : null)
        setFeedback({ type: 'success', message: 'Join code generated. Copy and share it with the child.' })
      } else {
        setFeedback({ type: 'error', message: 'Join code generated but could not be read from response.' })
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to generate join code.' })
    }
  }

  const handleInviteChild = async () => {
    if (!derivedChildNickname || !childForm.ageGroup) {
      setFeedback({ type: 'error', message: 'Child name and age group are required.' })
      return
    }
    try {
      setFeedback(null)
      await onInviteChild({
        nameCipher: familyName || 'Family',
        nickname: derivedChildNickname,
        ageGroup: childForm.ageGroup,
        birthYear: childForm.birthYear ? Number(childForm.birthYear) : undefined,
        birthMonth: childForm.birthMonth ? Number(childForm.birthMonth) : undefined,
        email: childForm.email || undefined,
        sendEmail: Boolean(childForm.email),
      })
      setFeedback({
        type: 'success',
        message: childForm.email
          ? `Invitation sent to ${childForm.email}`
          : 'Join code generated. Check the Active join codes list.',
      })
      setGeneratedCode(null)
      setGeneratedExpiry(null)
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to invite child.' })
    }
  }

  const handleInviteAdult = async () => {
    if (!adultForm.email.trim()) {
      setFeedback({ type: 'error', message: 'Email is required for adult invites.' })
      return
    }
    const displayName = adultForm.displayName.trim() || adultForm.email.trim().split('@')[0]
    try {
      setFeedback(null)
      await onInviteAdult({
        email: adultForm.email.trim(),
        nameCipher: displayName,
        role: adultForm.role as typeof adultRoles[number]['value'],
        sendEmail: adultForm.sendEmail,
      })
      setFeedback({ type: 'success', message: `Invitation sent to ${adultForm.email.trim()}` })
      setAdultForm({ email: '', displayName: '', role: 'parent_admin', sendEmail: true })
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to invite adult.' })
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Invite family member</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              {mode === 'child' ? 'Invite a child' : 'Invite an adult'}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Send invitations or generate join codes directly from the dashboard. Everything updates instantly for the family.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
          >
            Close
          </button>
        </header>

        <div className="border-b border-slate-200 px-6 py-4">
          <div className="inline-flex gap-2 rounded-full bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('child')
                setFeedback(null)
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                mode === 'child' ? 'bg-white text-slate-900 shadow' : 'text-slate-600'
              }`}
            >
              Child
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('adult')
                setFeedback(null)
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                mode === 'adult' ? 'bg-white text-slate-900 shadow' : 'text-slate-600'
              }`}
            >
              Parent / relative
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`mx-6 mt-4 rounded-2xl border px-4 py-3 text-sm ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <div className="px-6 py-5">
          {mode === 'child' ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Child’s full name *</label>
                  <input
                    value={childForm.realName}
                    onChange={(event) => setChildForm((prev) => ({ ...prev, realName: event.target.value }))}
                    placeholder="e.g. Ellie Johnson"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Nickname</label>
                  <input
                    value={childForm.nickname}
                    onChange={(event) => setChildForm((prev) => ({ ...prev, nickname: event.target.value }))}
                    placeholder="Optional nickname"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Age group *</label>
                  <select
                    value={childForm.ageGroup}
                    onChange={(event) => setChildForm((prev) => ({ ...prev, ageGroup: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    {ageGroups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Gender (optional)</label>
                  <input
                    value={childForm.gender}
                    onChange={(event) => setChildForm((prev) => ({ ...prev, gender: event.target.value }))}
                    placeholder="e.g. female"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Birth year (optional)</label>
                  <input
                    type="number"
                    min={2000}
                    max={new Date().getFullYear()}
                    value={childForm.birthYear}
                    onChange={(event) => setChildForm((prev) => ({ ...prev, birthYear: event.target.value }))}
                    placeholder="2015"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Birth month</label>
                  <select
                    value={childForm.birthMonth}
                    onChange={(event) => setChildForm((prev) => ({ ...prev, birthMonth: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="">Not specified</option>
                    {Array.from({ length: 12 }, (_, index) => (
                      <option key={index + 1} value={index + 1}>
                        {new Date(0, index).toLocaleString('en-GB', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Email (optional)</label>
                <input
                  type="email"
                  value={childForm.email}
                  onChange={(event) => setChildForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="child@example.com"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                />
                <p className="text-xs text-slate-500">Provide an email to send an invite link automatically.</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleGenerateJoinCode}
                  disabled={creatingJoinCode}
                  className="rounded-full border border-indigo-200 px-5 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingJoinCode ? 'Generating…' : 'Generate join code'}
                </button>
                <button
                  type="button"
                  onClick={handleInviteChild}
                  disabled={invitingChild}
                  className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
                >
                  {invitingChild ? 'Sending…' : 'Send invite email'}
                </button>
              </div>

              {generatedCode && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <p className="font-semibold">Join code: <span className="font-mono text-lg tracking-widest">{generatedCode}</span></p>
                  {generatedExpiry && <p className="text-xs mt-1">Expires {generatedExpiry}</p>}
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(generatedCode)}
                    className="mt-2 rounded-full border border-emerald-400 px-3 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-100"
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Email *</label>
                  <input
                    type="email"
                    value={adultForm.email}
                    onChange={(event) => setAdultForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="parent@example.com"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Display name</label>
                  <input
                    value={adultForm.displayName}
                    onChange={(event) => setAdultForm((prev) => ({ ...prev, displayName: event.target.value }))}
                    placeholder="Name shown in dashboard"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Role</label>
                <select
                  value={adultForm.role}
                  onChange={(event) => setAdultForm((prev) => ({ ...prev, role: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
                >
                  {adultRoles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={adultForm.sendEmail}
                  onChange={(event) => setAdultForm((prev) => ({ ...prev, sendEmail: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Send invite email automatically</span>
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleInviteAdult}
                  disabled={invitingAdult}
                  className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
                >
                  {invitingAdult ? 'Sending…' : 'Send invite'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default InviteFamilyMemberModal


