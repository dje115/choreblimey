import React from 'react'

export interface CreateChoreFormState {
  title: string
  description: string
  frequency: 'daily' | 'weekly' | 'once'
  proof: 'none' | 'photo' | 'note'
  baseRewardPence: number
  starsOverride: number | null
}

export interface CreateChoreAssignmentState {
  childIds: string[]
  biddingEnabled: boolean
}

export interface CreateChoreModalProps {
  isOpen: boolean
  onClose: () => void
  onBackToLibrary: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  newChore: CreateChoreFormState
  setNewChore: React.Dispatch<React.SetStateAction<CreateChoreFormState>>
  children: Array<{ id: string; nickname: string; ageGroup?: string }>
  assignments: CreateChoreAssignmentState
  setAssignments: React.Dispatch<React.SetStateAction<CreateChoreAssignmentState>>
}

const CreateChoreModal: React.FC<CreateChoreModalProps> = ({
  isOpen,
  onClose,
  onBackToLibrary,
  onSubmit,
  newChore,
  setNewChore,
  children,
  assignments,
  setAssignments,
}) => {
  if (!isOpen) return null

  const suggestedStars = Math.max(1, Math.floor(newChore.baseRewardPence / 10))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="cb-card my-8 w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="cb-heading-lg text-[var(--primary)]">➕ Create New Chore</h3>
          <button onClick={onBackToLibrary} className="text-sm text-[var(--secondary)] hover:underline">
            ← Back to Library
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block font-semibold text-[var(--text-primary)]">Chore title *</label>
            <input
              value={newChore.title}
              onChange={(event) => setNewChore((prev) => ({ ...prev, title: event.target.value }))}
              className="w-full rounded-[var(--radius-md)] border-2 border-[var(--card-border)] px-4 py-3 transition-all focus:border-[var(--primary)] focus:outline-none"
              placeholder="Make your bed"
              required
            />
          </div>

          <div>
            <label className="mb-2 block font-semibold text-[var(--text-primary)]">Description</label>
            <textarea
              value={newChore.description}
              onChange={(event) => setNewChore((prev) => ({ ...prev, description: event.target.value }))}
              className="w-full resize-none rounded-[var(--radius-md)] border-2 border-[var(--card-border)] px-4 py-3 transition-all focus:border-[var(--primary)] focus:outline-none"
              rows={3}
              placeholder="Optional details..."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block font-semibold text-[var(--text-primary)]">Frequency</label>
              <select
                value={newChore.frequency}
                onChange={(event) =>
                  setNewChore((prev) => ({ ...prev, frequency: event.target.value as CreateChoreFormState['frequency'] }))
                }
                className="w-full rounded-[var(--radius-md)] border-2 border-[var(--card-border)] px-4 py-3 transition-all focus:border-[var(--primary)] focus:outline-none"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="once">One-time</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block font-semibold text-[var(--text-primary)]">Completion Proof</label>
              <select
                value={newChore.proof}
                onChange={(event) =>
                  setNewChore((prev) => ({ ...prev, proof: event.target.value as CreateChoreFormState['proof'] }))
                }
                className="w-full rounded-[var(--radius-md)] border-2 border-[var(--card-border)] px-4 py-3 transition-all focus:border-[var(--primary)] focus:outline-none"
              >
                <option value="none">Trust-based (No proof needed)</option>
                <option value="note">Ask for explanation note</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block font-semibold text-[var(--text-primary)]">Reward (£)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={(newChore.baseRewardPence / 100).toFixed(2)}
                onChange={(event) =>
                  setNewChore((prev) => ({
                    ...prev,
                    baseRewardPence: Math.round(parseFloat(event.target.value || '0') * 100),
                  }))
                }
                className="w-full rounded-[var(--radius-md)] border-2 border-[var(--card-border)] px-4 py-3 transition-all focus:border-[var(--primary)] focus:outline-none"
                placeholder="0.50"
              />
            </div>
            <div>
              <label className="mb-2 block font-semibold text-[var(--text-primary)]">Stars (⭐)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={newChore.starsOverride ?? suggestedStars}
                onChange={(event) =>
                  setNewChore((prev) => ({
                    ...prev,
                    starsOverride: event.target.value ? parseInt(event.target.value, 10) : null,
                  }))
                }
                className="w-full rounded-[var(--radius-md)] border-2 border-[var(--card-border)] px-4 py-3 transition-all focus:border-[var(--primary)] focus:outline-none"
                placeholder="1"
              />
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Auto-calculated: {suggestedStars} stars (1 per £0.10)
              </p>
            </div>
          </div>

          <div className="border-t-2 border-[var(--card-border)] pt-5">
            <h4 className="mb-3 font-bold text-[var(--text-primary)]">👥 Assign to Children</h4>
            {children.length === 0 ? (
              <p className="text-sm italic text-[var(--text-secondary)]">
                No children in family yet. Invite children to assign chores!
              </p>
            ) : (
              <div className="space-y-3">
                {children.map((child) => (
                  <label
                    key={child.id}
                    className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border-2 border-[var(--card-border)] p-3 transition-all hover:border-[var(--primary)]"
                  >
                    <input
                      type="checkbox"
                      checked={assignments.childIds.includes(child.id)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setAssignments((prev) => ({
                            ...prev,
                            childIds: [...prev.childIds, child.id],
                          }))
                        } else {
                          setAssignments((prev) => ({
                            ...prev,
                            childIds: prev.childIds.filter((id) => id !== child.id),
                          }))
                        }
                      }}
                      className="h-5 w-5 rounded text-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-[var(--text-primary)]">{child.nickname}</div>
                      {child.ageGroup && <div className="text-xs text-[var(--text-secondary)]">Age: {child.ageGroup}</div>}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {assignments.childIds.length > 1 && (
            <div className="border-t-2 border-[var(--card-border)] pt-5">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={assignments.biddingEnabled}
                  onChange={(event) =>
                    setAssignments((prev) => ({
                      ...prev,
                      biddingEnabled: event.target.checked,
                    }))
                  }
                  className="mt-1 h-5 w-5 rounded text-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]"
                />
                <div>
                  <div className="font-bold text-[var(--text-primary)]">⚔️ Enable Sibling Rivalry (Underbid)</div>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Allow siblings to compete for this chore by bidding lower amounts.
                  </p>
                </div>
              </label>
            </div>
          )}

          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={() => {
                onClose()
                setNewChore({
                  title: '',
                  description: '',
                  frequency: 'daily',
                  proof: 'none',
                  baseRewardPence: 50,
                  starsOverride: null,
                })
                setAssignments({
                  childIds: [],
                  biddingEnabled: false,
                })
              }}
              className="flex-1 rounded-[var(--radius-lg)] border-2 border-[var(--card-border)] px-6 py-3 font-semibold transition-all hover:bg-[var(--background)]"
            >
              Cancel
            </button>
            <button type="submit" className="cb-button-primary flex-1 touch-manipulation">
              Create Chore
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateChoreModal

