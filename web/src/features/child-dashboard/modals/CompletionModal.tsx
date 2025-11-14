import React, { useState } from 'react'
import { apiClient } from '../../../lib/api'
import { handleApiError } from '../../../utils/errorHandler'

interface Assignment {
  id: string
  choreId: string
  chore?: {
    id: string
    title: string
    description?: string
    proof: 'none' | 'photo' | 'note'
    baseRewardPence: number
    starsOverride?: number
  }
  [key: string]: any
}

interface CompletionModalProps {
  assignment: Assignment
  onClose: () => void
  onSubmitted: () => Promise<void>
}

const CompletionModal: React.FC<CompletionModalProps> = ({ assignment, onClose, onSubmitted }) => {
  const [completionNote, setCompletionNote] = useState('')
  const [completingChore, setCompletingChore] = useState(false)
  const [error, setError] = useState<string>('')

  const chore = assignment.chore
  const requiresNote = chore?.proof === 'note'

  const handleSubmit = async () => {
    if (requiresNote && !completionNote.trim()) {
      setError('Please provide an explanation note')
      return
    }

    try {
      setCompletingChore(true)
      setError('')
      await apiClient.createCompletion({
        assignmentId: assignment.id,
        note: completionNote.trim() || undefined,
      })
      await onSubmitted()
    } catch (err: any) {
      const appError = handleApiError(err, 'Submitting completion')
      setError(appError.message)
    } finally {
      setCompletingChore(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overscroll-contain">
      <div className="cb-card w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
        <h3 className="cb-heading-lg text-center mb-4 text-[var(--primary)]">✅ Complete Chore</h3>

        {chore && (
          <div className="mb-6 space-y-3">
            <div className="bg-gradient-to-br from-[var(--primary)]/10 to-[var(--secondary)]/10 rounded-xl p-4 border-2 border-[var(--primary)]/20">
              <h4 className="font-bold text-lg text-[var(--text-primary)] mb-2">{chore.title}</h4>
              {chore.description && <p className="text-sm text-[var(--text-secondary)]">{chore.description}</p>}
            </div>

            <div className="flex items-center gap-2">
              <span className="cb-chip bg-[var(--success)] text-white font-bold">
                💰 £{(chore.baseRewardPence / 100).toFixed(2)}
              </span>
              <span className="cb-chip bg-yellow-500 text-white font-bold">
                ⭐ {chore.starsOverride || Math.max(1, Math.floor(chore.baseRewardPence / 10))}
              </span>
            </div>
          </div>
        )}

        {requiresNote && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
              Explanation Note {requiresNote && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              placeholder="Explain how you completed this chore..."
              rows={4}
              className="w-full px-4 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] bg-[var(--card-bg)] text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none resize-none"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="min-h-[44px] flex-1 px-6 py-3 border-2 border-[var(--card-border)] rounded-[var(--radius-lg)] font-semibold hover:bg-[var(--background)] active:bg-[var(--card-border)] transition-all touch-manipulation"
            disabled={completingChore}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={completingChore || (requiresNote && !completionNote.trim())}
            className="min-h-[44px] flex-1 cb-button-primary disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            {completingChore ? '⏳ Submitting...' : '✅ Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CompletionModal


