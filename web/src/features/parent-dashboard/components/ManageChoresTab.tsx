import React, { useCallback, useMemo, useState } from 'react'

import { apiClient } from '../../../lib/api'
import { notifyUpdate } from '../../../utils/notifications'
import { choreTemplates, categoryLabels, calculateSuggestedReward } from '../../../data/choreTemplates'
import type { ChoreTemplate } from '../../../data/choreTemplates'
import { useParentCapabilities } from '../hooks/useParentCapabilities'
import { useManageChoresData } from '../hooks/useManageChoresData'
import type { ParentChore } from '../hooks/useManageChoresData'
import { useFamilyData } from '../hooks/useFamilyData'
import { useParentDashboardVariant } from '../ParentDashboardVariantContext'
import CreateChoreModal, { CreateChoreAssignmentState, CreateChoreFormState } from '../modals/CreateChoreModal'
import EditChoreModal from '../modals/EditChoreModal'
import ChoreLibraryModal from '../modals/ChoreLibraryModal'

type FilterKey = 'all' | 'active' | 'paused' | 'unassigned' | 'bidding'

const FILTERS: Array<{ key: FilterKey; label: string; description: string }> = [
  { key: 'all', label: 'All', description: 'Every chore in the family plan' },
  { key: 'active', label: 'Active', description: 'Currently available to the kids' },
  { key: 'paused', label: 'Paused', description: 'Temporarily suspended chores' },
  { key: 'unassigned', label: 'Unassigned', description: 'Needs a child assigned' },
  { key: 'bidding', label: 'Showdown', description: 'Challenge mode chores' },
]

const ManageChoresTab: React.FC = () => {
  const { hasCapability } = useParentCapabilities()
  const canView = hasCapability('chores:view')
  const canEdit = hasCapability('chores:edit')
  const { chores, assignments, loading, error, refresh, refreshing, toggleChoreActive } = useManageChoresData()
  const { children: familyChildren } = useFamilyData()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showLibraryModal, setShowLibraryModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [detailChoreId, setDetailChoreId] = useState<string | null>(null)

  const initialCreateChore: CreateChoreFormState = {
    title: '',
    description: '',
    frequency: 'daily',
    proof: 'none',
    baseRewardPence: 50,
    starsOverride: null,
  }

  const initialAssignment: CreateChoreAssignmentState = {
    childIds: [],
    biddingEnabled: false,
  }

  const [createForm, setCreateForm] = useState<CreateChoreFormState>(initialCreateChore)
  const [createAssignments, setCreateAssignments] = useState<CreateChoreAssignmentState>(initialAssignment)
  const [editChore, setEditChore] = useState<(CreateChoreFormState & { id: string; active?: boolean }) | null>(null)
  const [editAssignments, setEditAssignments] = useState<CreateChoreAssignmentState>(initialAssignment)

  const assignmentsByChore = useMemo(() => {
    const map = new Map<string, typeof assignments>()
    assignments.forEach((assignment) => {
      if (!map.has(assignment.choreId)) {
        map.set(assignment.choreId, [])
      }
      map.get(assignment.choreId)!.push(assignment)
    })
    return map
  }, [assignments])

  const handleSelectTemplate = (template: ChoreTemplate) => {
    const weeklyBudgetPence = 2000
    const suggestedReward = calculateSuggestedReward(template, weeklyBudgetPence)

    setCreateForm({
      title: template.title,
      description: template.description,
      frequency: template.frequency,
      proof: 'none',
      baseRewardPence: suggestedReward,
      starsOverride: null,
    })
    setCreateAssignments(initialAssignment)
    setShowLibraryModal(false)
    setShowCreateModal(true)
  }

  const handleCreateChore = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedback(null)

    try {
      const payload = {
        ...createForm,
        starsOverride: createForm.starsOverride ?? undefined,
      }

      const result = await apiClient.createChore(payload)
      const choreId: string | undefined = result?.chore?.id ?? result?.id

      if (!choreId) {
        throw new Error('Chore identifier missing from response')
      }

      if (createAssignments.childIds.length > 0) {
        await Promise.all(
          createAssignments.childIds.map((childId) =>
            apiClient.createAssignment({
              choreId,
              childId,
              biddingEnabled: createAssignments.biddingEnabled && createAssignments.childIds.length > 1,
            }),
          ),
        )
      }

      notifyChoreUpdate()
      closeCreateModal()

      await new Promise((resolve) => setTimeout(resolve, 300))
      await refresh()
      notifyChoreUpdate()

      setFeedback({ type: 'success', message: 'Chore created successfully.' })
    } catch (error) {
      console.error('Failed to create chore', error)
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to create chore. Please try again.',
      })
    }
  }

  const handleOpenEditModal = (chore: ParentChore) => {
    const assignmentsForChore = assignmentsByChore.get(chore.id) ?? []
    const childIds = assignmentsForChore
      .map((assignment) => assignment.childId || assignment.child?.id || '')
      .filter((id): id is string => Boolean(id))

    setEditChore({
      id: chore.id,
      title: chore.title,
      description: chore.description ?? '',
      frequency: (chore.frequency as CreateChoreFormState['frequency']) ?? 'daily',
      proof: (chore.proof as CreateChoreFormState['proof']) ?? 'none',
      baseRewardPence: chore.baseRewardPence ?? 0,
      starsOverride: chore.starsOverride ?? null,
      active: chore.active,
    })
    setEditAssignments({
      childIds,
      biddingEnabled: assignmentsForChore.some((assignment) => assignment.biddingEnabled) && childIds.length > 1,
    })
    setShowEditModal(true)
  }

  const handleEditChoreSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editChore) return

    setFeedback(null)

    try {
      await apiClient.updateChore(editChore.id, {
        title: editChore.title,
        description: editChore.description,
        frequency: editChore.frequency,
        proof: editChore.proof,
        baseRewardPence: editChore.baseRewardPence,
        starsOverride: typeof editChore.starsOverride === 'number' ? editChore.starsOverride : undefined,
        active: editChore.active !== false,
      })

      const existingAssignments = assignmentsByChore.get(editChore.id) ?? []
      const existingChildIds = existingAssignments
        .map((assignment) => assignment.childId)
        .filter((id): id is string => Boolean(id))

      const childIdsToAdd = editAssignments.childIds.filter((id) => !existingChildIds.includes(id))
      const assignmentsToRemove = existingAssignments.filter(
        (assignment) => assignment.childId && !editAssignments.childIds.includes(assignment.childId),
      )

      if (assignmentsToRemove.length > 0) {
        await Promise.all(assignmentsToRemove.map((assignment) => apiClient.deleteAssignment(assignment.id)))
      }

      if (childIdsToAdd.length > 0) {
        await Promise.all(
          childIdsToAdd.map((childId) =>
            apiClient.createAssignment({
              choreId: editChore.id,
              childId,
              biddingEnabled: editAssignments.biddingEnabled && editAssignments.childIds.length > 1,
            }),
          ),
        )
      }

      notifyChoreUpdate()
      await new Promise((resolve) => setTimeout(resolve, 300))
      await refresh()
      notifyChoreUpdate()

      setFeedback({ type: 'success', message: 'Chore updated successfully.' })
      closeEditModal()
    } catch (error) {
      console.error('Failed to update chore', error)
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to update chore. Please try again.',
      })
    }
  }

  const filteredChores = useMemo(() => {
    return chores.filter((chore) => {
      const choreAssignments = assignmentsByChore.get(chore.id) ?? []
      const hasChildAssignments = choreAssignments.some((assignment) => !!assignment.child)
      const hasBidding = choreAssignments.some((assignment) => assignment.biddingEnabled)

      switch (filter) {
        case 'active':
          return chore.active
        case 'paused':
          return !chore.active
        case 'unassigned':
          return chore.active && (choreAssignments.length === 0 || !hasChildAssignments)
        case 'bidding':
          return hasBidding
        case 'all':
        default:
          return true
      }
    })
  }, [chores, assignmentsByChore, filter])

  const stats = useMemo(() => {
    const total = chores.length
    const active = chores.filter((chore) => chore.active).length
    const paused = total - active
    const showdown = chores.filter((chore) => {
      const choreAssignments = assignmentsByChore.get(chore.id) ?? []
      return choreAssignments.some((assignment) => assignment.biddingEnabled)
    }).length
    const unassigned = chores.filter((chore) => {
      const choreAssignments = assignmentsByChore.get(chore.id) ?? []
      return (
        chore.active &&
        (choreAssignments.length === 0 || !choreAssignments.some((assignment) => assignment.child))
      )
    }).length

    return { total, active, paused, showdown, unassigned }
  }, [chores, assignmentsByChore])

  const handleToggle = async (choreId: string, nextActive: boolean) => {
    setFeedback(null)
    try {
      await toggleChoreActive(choreId, nextActive)
      notifyChoreUpdate()
      setFeedback({
        type: 'success',
        message: nextActive ? 'Chore reactivated successfully.' : 'Chore paused successfully.',
      })
    } catch (err) {
      console.error('Failed to toggle chore active', err)
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to update chore. Please try again.',
      })
    }
  }

  const childOptions = useMemo(
    () =>
      familyChildren.map((child) => ({
        id: child.id,
        nickname: child.nickname,
        ageGroup: child.ageGroup ?? undefined,
      })),
    [familyChildren],
  )

  const notifyChoreUpdate = useCallback(() => {
    notifyUpdate('choreUpdated')
  }, [])

  const resetCreateState = () => {
    setCreateForm(initialCreateChore)
    setCreateAssignments(initialAssignment)
  }

  const openCreateModal = () => {
    resetCreateState()
    setShowLibraryModal(false)
    setShowCreateModal(true)
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    resetCreateState()
  }

  const openLibraryModal = () => {
    resetCreateState()
    setSelectedCategory('all')
    setShowLibraryModal(true)
  }

  const closeLibraryModal = () => {
    setShowLibraryModal(false)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setEditChore(null)
    setEditAssignments(initialAssignment)
  }

  const openLegacyFullEditor = () => {
    setDetailChoreId(null)
    setShowEditModal(false)
    setVariant('legacy', { source: 'manage-chores-full-editor' })
    if (typeof window !== 'undefined') {
      window.location.hash = '#manage-chores'
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const { setVariant } = useParentDashboardVariant()

  if (!canView) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 px-6 py-12 text-center">
        <div className="space-y-2">
          <p className="text-lg font-semibold text-slate-700">Chore management unavailable</p>
          <p className="text-sm text-slate-500">
            Your role does not include permission to view or manage chores. Contact a family admin if you need access.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase text-indigo-700">Chores</div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Manage Chores</h1>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 font-semibold">
              {stats.total} total
            </span>
            <button
              type="button"
              onClick={() => refresh()}
              disabled={refreshing}
              className="rounded-full border border-slate-300 px-3 py-1 font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-600 sm:max-w-3xl">
          Keep chores tidy, assign them to your kids, and monitor which ones are paused or running in showdown mode. The
          controls below update the family app instantly.
        </p>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openLibraryModal}
              className="rounded-full border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
            >
              Browse library
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-700"
            >
              Create custom chore
            </button>
          </div>
        )}
        {!canEdit && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            <span>🔒</span>
            <span>You have read-only access. Ask a family admin if you need to edit chores.</span>
          </div>
        )}
      </header>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
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
          <span className="font-semibold">Failed to load chores:</span> {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.active}</p>
          <p className="text-xs text-slate-500">Running chores available right now</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paused</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.paused}</p>
          <p className="text-xs text-slate-500">Temporarily turned off</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Showdown</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.showdown}</p>
          <p className="text-xs text-slate-500">Bidding-enabled chores</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Needs assignment</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.unassigned}</p>
          <p className="text-xs text-slate-500">Chores without a child assigned</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                filter === item.key ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {FILTERS.find((f) => f.key === filter)?.description ?? 'Filter chores by status.'}
        </p>

        <div className="mt-4 space-y-3">
          {filteredChores.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <div className="text-4xl">🧹</div>
              <p className="mt-3 text-base font-semibold text-slate-600">No chores match this filter.</p>
              <p className="text-sm text-slate-500">Adjust the filter or add a new chore.</p>
            </div>
          ) : (
            filteredChores.map((chore) => {
              const choreAssignments = assignmentsByChore.get(chore.id) ?? []
              const assignedChildren = Array.from(
                new Map(
                  choreAssignments
                    .map((assignment) => assignment.child)
                    .filter((child): child is { id: string; nickname?: string | null } => Boolean(child && child.id))
                    .map((child) => [child.id, child]),
                ).values(),
              )
              const hasBidding = choreAssignments.some((assignment) => assignment.biddingEnabled)
              const primaryNames = assignedChildren.slice(0, 3).map((child) => child.nickname || 'Unnamed')
              const extraCount = assignedChildren.length - primaryNames.length

              return (
                <div
                  key={chore.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🧽</span>
                      <h3 className="text-base font-semibold text-slate-900">{chore.title}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          chore.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {chore.active ? 'Active' : 'Paused'}
                      </span>
                      {hasBidding && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                          Showdown
                        </span>
                      )}
                    </div>
                    {chore.description && (
                      <p className="max-w-xl text-sm text-slate-600">{chore.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-semibold text-slate-600">
                        ⏰ {chore.frequency.charAt(0).toUpperCase() + chore.frequency.slice(1)}
                      </span>
                      {chore.baseRewardPence != null && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-semibold text-slate-600">
                          💷 {(chore.baseRewardPence / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}
                        </span>
                      )}
                      {chore.starsOverride != null && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-semibold text-slate-600">
                          ⭐ {chore.starsOverride}
                        </span>
                      )}
                      {assignedChildren.length > 0 && chore.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-semibold text-slate-600">
                          👦 {primaryNames.join(', ')}
                          {extraCount > 0 && <span className="text-slate-400">+{extraCount} more</span>}
                        </span>
                      ) : chore.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-semibold text-amber-600">
                          ⚠️ Not assigned
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-semibold text-slate-600">
                          ⏸️ Paused
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleToggle(chore.id, !chore.active)}
                        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                      >
                        {chore.active ? 'Pause' : 'Activate'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDetailChoreId(chore.id)}
                      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                    >
                      View details
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(chore)}
                        className="rounded-full border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                      >
                        Edit chore
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
          Loading chore information…
        </div>
      )}
      </div>
      <ChoreLibraryModal
        isOpen={showLibraryModal}
        onClose={closeLibraryModal}
        templates={choreTemplates}
        chores={chores}
        budget={null}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        categoryLabels={categoryLabels}
        calculateSuggestedReward={calculateSuggestedReward}
        onSelectTemplate={handleSelectTemplate}
        onCreateCustomChore={openCreateModal}
      />
      <CreateChoreModal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        onBackToLibrary={() => {
          closeCreateModal()
          openLibraryModal()
        }}
        onSubmit={handleCreateChore}
        newChore={createForm}
        setNewChore={setCreateForm}
        children={childOptions}
        assignments={createAssignments}
        setAssignments={setCreateAssignments}
      />
      {showEditModal && editChore && (
        <EditChoreModal
          isOpen={showEditModal}
          chore={editChore}
          onUpdateChore={(next) => setEditChore((prev) => (prev ? { ...prev, ...next } : prev))}
          assignments={editAssignments}
          setAssignments={setEditAssignments}
          children={childOptions}
          onSubmit={handleEditChoreSubmit}
          onClose={closeEditModal}
        />
      )}
      {detailChoreId && (
        <ChoreDetailModal
          chore={chores.find((chore) => chore.id === detailChoreId) ?? null}
          assignments={assignmentsByChore.get(detailChoreId) ?? []}
          onClose={() => setDetailChoreId(null)}
          onOpenLegacy={openLegacyFullEditor}
        />
      )}
    </>
  )
}

export default ManageChoresTab

interface ChoreDetailModalProps {
  chore: ReturnType<typeof useManageChoresData>['chores'][number] | null
  assignments: ReturnType<typeof useManageChoresData>['assignments']
  onClose: () => void
  onOpenLegacy: () => void
}

const ChoreDetailModal: React.FC<ChoreDetailModalProps> = ({ chore, assignments, onClose, onOpenLegacy }) => {
  if (!chore) return null

  const assignedChildren = assignments
    .map((assignment) => assignment.child)
    .filter((child): child is { id: string; nickname?: string | null } => Boolean(child && child.id))
  const biddingEnabled = assignments.some((assignment) => assignment.biddingEnabled)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chore details</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{chore.title}</h2>
            {chore.description && <p className="mt-2 text-sm text-slate-600">{chore.description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Close
          </button>
        </header>

        <div className="space-y-4 px-6 py-5 text-sm text-slate-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
              {chore.active ? '✅ Active' : '⏸️ Paused'}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
              ⏰ {chore.frequency.charAt(0).toUpperCase() + chore.frequency.slice(1)}
            </span>
            {chore.baseRewardPence != null && (
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                💷 {(chore.baseRewardPence / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}
              </span>
            )}
            {chore.starsOverride != null && (
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                ⭐ {chore.starsOverride}
              </span>
            )}
            {biddingEnabled && (
              <span className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 font-semibold text-purple-700">
                ⚔️ Showdown enabled
              </span>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned children</p>
            {assignedChildren.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {assignedChildren.map((child) => (
                  <li key={child.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                    <span className="text-lg">👦</span>
                    <span className="font-semibold text-slate-700">{child.nickname || 'Unnamed child'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No children assigned yet.</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Automation & bidding</p>
            <p className="mt-2 text-sm">
              {biddingEnabled
                ? 'This chore is running in showdown mode. Children must bid to complete it.'
                : 'Showdown mode is disabled. Assign the chore directly to a child to control who can complete it.'}
            </p>
          </div>
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onOpenLegacy}
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-700"
          >
            Open full editor
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  )
}

