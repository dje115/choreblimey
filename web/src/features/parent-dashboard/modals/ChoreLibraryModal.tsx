import React from 'react'

export interface ChoreTemplateSummary {
  id: string
  title: string
  description: string
  icon: string
  category: string
  frequency: 'daily' | 'weekly' | 'once'
  ageGroup?: string | null
}

interface BudgetSummary {
  maxBudgetPence?: number | null
  budgetPeriod?: 'weekly' | 'monthly' | null
}

interface ChoreLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  templates: ChoreTemplateSummary[]
  chores: Array<{ title: string }>
  budget?: BudgetSummary | null
  selectedCategory: string
  setSelectedCategory: (category: string) => void
  categoryLabels: Record<string, { label: string; icon: string }>
  calculateSuggestedReward: (template: ChoreTemplateSummary, budgetPence: number) => number
  onSelectTemplate: (template: ChoreTemplateSummary) => void
  onCreateCustomChore: () => void
}

const ChoreLibraryModal: React.FC<ChoreLibraryModalProps> = ({
  isOpen,
  onClose,
  templates,
  chores,
  budget,
  selectedCategory,
  setSelectedCategory,
  categoryLabels,
  calculateSuggestedReward,
  onSelectTemplate,
  onCreateCustomChore,
}) => {
  if (!isOpen) {
    return null
  }

  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    const alreadyExists = chores.some(
      (chore) => chore.title.toLowerCase().trim() === template.title.toLowerCase().trim(),
    )
    return matchesCategory && !alreadyExists
  })

  const weeklyBudgetPence = budget?.maxBudgetPence ?? 2000
  const effectiveBudget = budget?.budgetPeriod === 'monthly' ? weeklyBudgetPence / 4 : weeklyBudgetPence

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="cb-card my-8 w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="cb-heading-lg text-[var(--primary)]">📚 Chore Library</h3>
          <button
            onClick={onClose}
            className="text-2xl text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              selectedCategory === 'all'
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--background)] text-[var(--text-secondary)]'
            }`}
            type="button"
          >
            ✨ All
          </button>
          {Object.entries(categoryLabels).map(([key, { label, icon }]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                selectedCategory === key
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--background)] text-[var(--text-secondary)]'
              }`}
              type="button"
            >
              {icon} {label}
            </button>
          ))}
        </div>

        <div className="grid max-h-[60vh] gap-3 overflow-y-auto p-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.length === 0 ? (
            <div className="col-span-full py-12 text-center">
              <div className="mb-4 text-6xl">✅</div>
              <h4 className="mb-2 font-bold text-[var(--text-primary)]">All set!</h4>
              <p className="text-[var(--text-secondary)]">
                You've already created all the chores in this category.
                <br />
                Try a different category or create a custom chore below!
              </p>
            </div>
          ) : (
            filteredTemplates.map((template) => {
              const suggestedReward = calculateSuggestedReward(template, effectiveBudget)
              return (
                <button
                  key={template.id}
                  onClick={() => onSelectTemplate(template)}
                  className="rounded-[var(--radius-lg)] border-2 border-[var(--card-border)] bg-white p-4 text-left transition-all hover:border-[var(--primary)] hover:shadow-lg"
                  type="button"
                >
                  <div className="mb-2 flex items-start gap-3">
                    <span className="text-3xl">{template.icon}</span>
                    <div className="min-w-0 flex-1">
                      <h4 className="mb-1 text-sm font-bold text-[var(--text-primary)]">{template.title}</h4>
                      <p className="line-clamp-2 text-xs text-[var(--text-secondary)]">{template.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="cb-chip bg-[var(--success)]/10 text-xs text-[var(--success)]">
                      💰 £{(suggestedReward / 100).toFixed(2)}
                    </span>
                    <span className="cb-chip bg-[var(--secondary)]/10 text-xs text-[var(--secondary)]">
                      {template.frequency === 'daily'
                        ? '📅 Daily'
                        : template.frequency === 'weekly'
                        ? '📆 Weekly'
                        : '🎯 Once'}
                    </span>
                    {template.ageGroup && (
                      <span className="cb-chip bg-purple-50 text-xs text-purple-700">{template.ageGroup}</span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="mt-6 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--primary)]/30 bg-gradient-to-r from-[var(--primary)]/10 to-[var(--secondary)]/10 p-4">
          <button onClick={onCreateCustomChore} className="w-full text-center" type="button">
            <div className="mb-2 text-4xl">➕</div>
            <h4 className="mb-1 font-bold text-[var(--text-primary)]">Create Custom Chore</h4>
            <p className="text-sm text-[var(--text-secondary)]">Build your own chore from scratch</p>
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChoreLibraryModal
