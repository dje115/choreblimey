import React from 'react'

import ParentDashboard from './ParentDashboard'
import { ParentDashboardTabs, ParentDashboardVariantProvider, useParentDashboardVariant } from '../features/parent-dashboard'

const ParentDashboardEntryInner: React.FC = () => {
  const { variant } = useParentDashboardVariant()

  if (variant === 'tabs') {
    return <ParentDashboardTabs />
  }

  return <ParentDashboard />
}

const VariantToggle: React.FC = () => {
  const { variant, setVariant, defaultVariant } = useParentDashboardVariant()
  const nextVariant = variant === 'legacy' ? 'tabs' : 'legacy'
  const isDefault = variant === defaultVariant

  const label =
    variant === 'legacy'
      ? 'Preview the new tabbed dashboard'
      : 'Return to the legacy dashboard'

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 text-sm font-semibold text-slate-700 md:bottom-6 md:right-6">
      {!isDefault && (
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase text-amber-700 shadow">
          Beta preview
        </span>
      )}
      <button
        type="button"
        onClick={() => setVariant(nextVariant, { source: 'floating-toggle' })}
        className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-lg transition hover:translate-y-[-2px] hover:shadow-xl"
        title={label}
      >
        {variant === 'legacy' ? (
          <>
            <span>✨</span>
            <span>Try tabbed dashboard</span>
          </>
        ) : (
          <>
            <span>↩️</span>
            <span>Use legacy dashboard</span>
          </>
        )}
      </button>
    </div>
  )
}

const ParentDashboardEntry: React.FC = () => {
  return (
    <ParentDashboardVariantProvider>
      <VariantToggle />
      <ParentDashboardEntryInner />
    </ParentDashboardVariantProvider>
  )
}

export default ParentDashboardEntry

