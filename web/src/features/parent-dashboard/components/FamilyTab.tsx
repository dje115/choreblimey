import React, { useEffect, useMemo, useState } from 'react'

import { useParentCapabilities } from '../hooks/useParentCapabilities'
import { useFamilyData, type FamilyAdult, type FamilyChild } from '../hooks/useFamilyData'
import InviteFamilyMemberModal from '../modals/InviteFamilyMemberModal'
import EditAdultModal from '../modals/EditAdultModal'
import EditChildModal from '../modals/EditChildModal'

const roleLabels: Record<string, string> = {
  parent_admin: 'Parent (Admin)',
  parent_co_parent: 'Co-parent',
  parent_viewer: 'Viewer',
  grandparent: 'Grandparent',
  uncle_aunt: 'Relative',
  relative_contributor: 'Contributor',
  helper: 'Helper',
}

const FamilyTab: React.FC = () => {
  const { hasCapability } = useParentCapabilities()
  const {
    loading,
    refreshing,
    error,
    family,
    adults,
    children,
    joinCodes,
    familyName,
    refresh,
    generateJoinCode,
    inviteAdult,
    inviteChild,
    updateAdult,
    removeAdult,
    toggleAdultPause,
    updateChildMember,
    removeChildMember,
    generateAdultDeviceToken,
    toggleChildPause,
    updateFamilyName,
    updateFamilyHoliday,
    updateChildHoliday,
    busyAdultIds,
    busyChildIds,
    creatingJoinCode,
    invitingAdult,
    invitingChild,
  } = useFamilyData()
  const canManage = hasCapability('family:manage')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editingAdult, setEditingAdult] = useState<FamilyAdult | null>(null)
  const [editingChild, setEditingChild] = useState<FamilyChild | null>(null)
  const [familyNameDraft, setFamilyNameDraft] = useState(familyName ?? '')
  const [savingFamilyName, setSavingFamilyName] = useState(false)
  const [holidaySaving, setHolidaySaving] = useState(false)
  const [holidayFeedback, setHolidayFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const formatDateInput = (value?: string | null) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toISOString().split('T')[0]
  }

  const initialHolidayState = useMemo(() => {
    const childState = Object.fromEntries(
      children.map((child) => [
        child.id,
        {
          enabled: child.holidayMode ?? false,
          startDate: formatDateInput(child.holidayStartDate),
          endDate: formatDateInput(child.holidayEndDate),
        },
      ]),
    ) as Record<string, { enabled: boolean; startDate: string; endDate: string }>

    return {
      familyEnabled: family?.holidayMode ?? false,
      familyStart: formatDateInput(family?.holidayStartDate),
      familyEnd: formatDateInput(family?.holidayEndDate),
      children: childState,
    }
  }, [family?.holidayEndDate, family?.holidayMode, family?.holidayStartDate, children])

  const [holidayDraft, setHolidayDraft] = useState(initialHolidayState)

  useEffect(() => {
    setFamilyNameDraft(familyName ?? '')
  }, [familyName])

  useEffect(() => {
    setHolidayDraft(initialHolidayState)
  }, [initialHolidayState])

  const holidayDirty = useMemo(() => {
    if (
      holidayDraft.familyEnabled !== initialHolidayState.familyEnabled ||
      holidayDraft.familyStart !== initialHolidayState.familyStart ||
      holidayDraft.familyEnd !== initialHolidayState.familyEnd
    ) {
      return true
    }

    return children.some((child) => {
      const draft = holidayDraft.children[child.id] ?? { enabled: false, startDate: '', endDate: '' }
      const initial = initialHolidayState.children[child.id] ?? { enabled: false, startDate: '', endDate: '' }
      return (
        draft.enabled !== initial.enabled || draft.startDate !== initial.startDate || draft.endDate !== initial.endDate
      )
    })
  }, [children, holidayDraft, initialHolidayState])

  const handleCopyCode = (code: string) => {
    void navigator.clipboard.writeText(code)
  }

  const handleRemoveAdult = async (memberId: string) => {
    await removeAdult(memberId)
    setEditingAdult(null)
  }

  const handleRemoveChild = async (childId: string) => {
    await removeChildMember(childId)
    setEditingChild(null)
  }

  const handleSaveFamilyName = async () => {
    if (!familyNameDraft.trim() || familyNameDraft.trim() === familyName) {
      return
    }
    setSavingFamilyName(true)
    try {
      await updateFamilyName(familyNameDraft.trim())
    } catch (err: any) {
      console.error('Failed to update family name', err)
    } finally {
      setSavingFamilyName(false)
    }
  }

  const handleSaveHoliday = async () => {
    setHolidayFeedback(null)
    setHolidaySaving(true)
    try {
      const tasks: Promise<void>[] = []

      if (
        holidayDraft.familyEnabled !== initialHolidayState.familyEnabled ||
        holidayDraft.familyStart !== initialHolidayState.familyStart ||
        holidayDraft.familyEnd !== initialHolidayState.familyEnd
      ) {
        tasks.push(
          updateFamilyHoliday({
            enabled: holidayDraft.familyEnabled,
            startDate: holidayDraft.familyEnabled ? holidayDraft.familyStart || null : null,
            endDate: holidayDraft.familyEnabled ? holidayDraft.familyEnd || null : null,
          }),
        )
      }

      children.forEach((child) => {
        const draft = holidayDraft.children[child.id] ?? { enabled: false, startDate: '', endDate: '' }
        const initial = initialHolidayState.children[child.id] ?? { enabled: false, startDate: '', endDate: '' }
        if (
          draft.enabled !== initial.enabled ||
          draft.startDate !== initial.startDate ||
          draft.endDate !== initial.endDate
        ) {
          tasks.push(
            updateChildHoliday(child.id, {
              enabled: draft.enabled,
              startDate: draft.enabled ? draft.startDate || null : null,
              endDate: draft.enabled ? draft.endDate || null : null,
            }),
          )
        }
      })

      if (tasks.length > 0) {
        await Promise.all(tasks)
        setHolidayFeedback({ type: 'success', message: 'Holiday settings saved.' })
      }
    } catch (err: any) {
      console.error('Failed to save holiday settings', err)
      setHolidayFeedback({ type: 'error', message: err?.message || 'Unable to save holiday settings.' })
    } finally {
      setHolidaySaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase text-indigo-700">Family</div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            {familyName ? `${familyName} Family` : 'Family Hub'}
          </h1>
          <button
            type="button"
            onClick={() => refresh()}
            disabled={refreshing}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
            >
              Invite member / create code
            </button>
          )}
        </div>
        <p className="text-sm text-slate-600 sm:max-w-3xl">
          Manage invites, review join codes, and update adult and child permissions. All changes update instantly for the family.
        </p>
        {!canManage && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            <span>🔒</span>
            <span>You have read-only access to family management tools.</span>
          </div>
        )}
      </header>

      {canManage && (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Family name</p>
              <p className="text-xs text-slate-500">Update how your family name appears across dashboards.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={familyNameDraft}
              onChange={(event) => setFamilyNameDraft(event.target.value)}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
              placeholder="e.g. The Sparkles"
              disabled={savingFamilyName}
            />
            <button
              type="button"
              onClick={handleSaveFamilyName}
              disabled={savingFamilyName || !familyNameDraft.trim() || familyNameDraft.trim() === familyName}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {savingFamilyName ? 'Saving…' : 'Save name'}
            </button>
          </div>
        </section>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          <span className="font-semibold">Failed to load family data:</span> {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Holiday mode</p>
            <p className="text-xs text-slate-500">
              Pause chores and penalties for the whole family or individual children during holidays.
            </p>
          </div>
          {canManage && holidayDraft.familyEnabled && holidayDraft.familyStart && holidayDraft.familyEnd && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Active {holidayDraft.familyStart} → {holidayDraft.familyEnd}
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Family holiday mode</p>
              <button
                type="button"
                role="switch"
                aria-checked={holidayDraft.familyEnabled}
                onClick={() =>
                  setHolidayDraft((prev) => ({
                    ...prev,
                    familyEnabled: !prev.familyEnabled,
                    familyStart: !prev.familyEnabled ? prev.familyStart : '',
                    familyEnd: !prev.familyEnabled ? prev.familyEnd : '',
                  }))
                }
                className={`relative inline-flex h-6 w-11 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  holidayDraft.familyEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    holidayDraft.familyEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              When enabled, streak penalties pause and children see a holiday banner.
            </p>

            {holidayDraft.familyEnabled && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Start date</label>
                  <input
                    type="date"
                    value={holidayDraft.familyStart}
                    onChange={(event) =>
                      setHolidayDraft((prev) => ({
                        ...prev,
                        familyStart: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">End date</label>
                  <input
                    type="date"
                    value={holidayDraft.familyEnd}
                    onChange={(event) =>
                      setHolidayDraft((prev) => ({
                        ...prev,
                        familyEnd: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
            <p className="text-sm font-semibold text-slate-800">Per-child overrides</p>
            <p className="text-xs text-slate-500">
              Pause individual children even when family holiday mode is off.
            </p>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {children.map((child) => {
                const draft = holidayDraft.children[child.id] ?? { enabled: false, startDate: '', endDate: '' }
                return (
                  <div key={child.id} className="rounded-xl border border-white/70 bg-white px-3 py-3 text-sm text-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800">{child.nickname}</p>
                        <p className="text-xs text-slate-500">
                          {draft.enabled ? 'Holiday pause active' : 'Available for chores'}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={draft.enabled}
                        onClick={() =>
                          setHolidayDraft((prev) => ({
                            ...prev,
                            children: {
                              ...prev.children,
                              [child.id]: {
                                ...draft,
                                enabled: !draft.enabled,
                                startDate: !draft.enabled ? draft.startDate || '' : '',
                                endDate: !draft.enabled ? draft.endDate || '' : '',
                              },
                            },
                          }))
                        }
                        className={`relative inline-flex h-5 w-10 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
                          draft.enabled ? 'bg-indigo-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                            draft.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    {draft.enabled && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <input
                          type="date"
                          value={draft.startDate}
                          onChange={(event) =>
                            setHolidayDraft((prev) => ({
                              ...prev,
                              children: {
                                ...prev.children,
                                [child.id]: {
                                  ...draft,
                                  startDate: event.target.value,
                                },
                              },
                            }))
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-indigo-400 focus:outline-none"
                        />
                        <input
                          type="date"
                          value={draft.endDate}
                          onChange={(event) =>
                            setHolidayDraft((prev) => ({
                              ...prev,
                              children: {
                                ...prev.children,
                                [child.id]: {
                                  ...draft,
                                  endDate: event.target.value,
                                },
                              },
                            }))
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-indigo-400 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {holidayFeedback && (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              holidayFeedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {holidayFeedback.message}
          </div>
        )}

        {canManage && (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setHolidayDraft(initialHolidayState)}
              disabled={!holidayDirty || holidaySaving}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset changes
            </button>
            <button
              type="button"
              onClick={handleSaveHoliday}
              disabled={!holidayDirty || holidaySaving}
              className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {holidaySaving ? 'Saving…' : 'Save holiday settings'}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Active join codes</p>
            <p className="text-xs text-slate-500">Share these codes with children to let them join the family.</p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="rounded-full border border-indigo-200 px-4 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
            >
              New join code
            </button>
          )}
        </div>

        {joinCodes.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
            <div className="text-4xl">🎟️</div>
            <p className="mt-2 text-sm font-semibold text-slate-600">No active join codes</p>
            {canManage && (
              <p className="text-xs text-slate-500">Use the button above to create one instantly.</p>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {joinCodes.map((joinCode) => (
              <div
                key={joinCode.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold tracking-widest text-indigo-700">{joinCode.code}</span>
                    {joinCode.intendedNickname && (
                      <span className="rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-semibold uppercase text-indigo-700">
                        For {joinCode.intendedNickname}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Expires {new Date(joinCode.expiresAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleCopyCode(joinCode.code)}
                    className="rounded-full bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
                  >
                    Copy
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Adults</p>
            <p className="text-xs text-slate-500">Overview of adults and their roles.</p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="rounded-full border border-indigo-200 px-4 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
            >
              Invite adult
            </button>
          )}
        </div>

        {adults.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
            <div className="text-4xl">🧑</div>
            <p className="mt-2 text-sm text-slate-600">No adult members listed yet.</p>
            {canManage && <p className="text-xs text-slate-500">Use the invite button to add someone.</p>}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {adults.map((adult) => (
              <div
                key={adult.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="flex flex-1 items-center gap-3">
                  <span className="text-xl">🧑‍💼</span>
                  <div>
                    <p className="font-semibold text-slate-800">
                      {adult.displayName || adult.user?.email?.split('@')[0] || 'Unnamed adult'}
                    </p>
                    <p className="text-xs text-slate-500">{roleLabels[adult.role] || adult.role}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                    adult.chatEnabled !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {adult.chatEnabled !== false ? 'Chat enabled' : 'Chat disabled'}
                </span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setEditingAdult(adult)}
                    className="rounded-full border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                  >
                    Manage
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Children</p>
            <p className="text-xs text-slate-500">Quick view of the kids in your family.</p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="rounded-full border border-indigo-200 px-4 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
            >
              Invite child
            </button>
          )}
        </div>

        {children.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
            <div className="text-4xl">👦</div>
            <p className="mt-2 text-sm text-slate-600">No children yet — invite them with a join code.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {children.map((child) => (
              <div
                key={child.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="flex flex-1 items-center gap-3">
                  <span className="text-xl">🧒</span>
                  <div>
                    <p className="font-semibold text-slate-800">{child.nickname}</p>
                    {child.ageGroup && <p className="text-xs text-slate-500">Age group {child.ageGroup}</p>}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                    child.chatEnabled !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {child.chatEnabled !== false ? 'Chat enabled' : 'Chat disabled'}
                </span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setEditingChild(child)}
                    className="rounded-full border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                  >
                    Manage
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">Loading family data…</div>
      )}

      {canManage && (
        <InviteFamilyMemberModal
          isOpen={inviteOpen}
          familyName={familyName}
          creatingJoinCode={creatingJoinCode}
          invitingChild={invitingChild}
          invitingAdult={invitingAdult}
          onClose={() => setInviteOpen(false)}
          onGenerateJoinCode={generateJoinCode}
          onInviteChild={inviteChild}
          onInviteAdult={inviteAdult}
        />
      )}

      {editingAdult && (
        <EditAdultModal
          isOpen={Boolean(editingAdult)}
          adult={editingAdult}
          busy={busyAdultIds.has(editingAdult.id)}
          onClose={() => setEditingAdult(null)}
          onSave={updateAdult}
          onGenerateDeviceToken={generateAdultDeviceToken}
          onTogglePause={toggleAdultPause}
          onRemove={handleRemoveAdult}
        />
      )}

      {editingChild && (
        <EditChildModal
          isOpen={Boolean(editingChild)}
          child={editingChild}
          busy={busyChildIds.has(editingChild.id)}
          onClose={() => setEditingChild(null)}
          onSave={updateChildMember}
          onGenerateJoinCode={generateJoinCode}
          onTogglePause={toggleChildPause}
          onRemove={handleRemoveChild}
        />
      )}
    </div>
  )
}

export default FamilyTab

