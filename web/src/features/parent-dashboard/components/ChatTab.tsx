import React from 'react'

import { FamilyChat } from '../../../components/FamilyChat'
import { useParentCapabilities } from '../hooks/useParentCapabilities'

const ChatTab: React.FC = () => {
  const { hasCapability } = useParentCapabilities()
  const canView = hasCapability('chat:view')
  const canSend = hasCapability('chat:write')

  if (!canView) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 px-6 py-12 text-center">
        <div className="space-y-2">
          <p className="text-lg font-semibold text-slate-700">Chat not available</p>
          <p className="text-sm text-slate-500">
            Your role does not include access to the family chat. Ask a family admin if you believe this is a mistake.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase text-indigo-700">Chat</div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Family Chat Lounge</h1>
        </div>
        <p className="text-sm text-slate-600 sm:max-w-3xl">
          Keep everyone in sync with quick updates and encouragement. Messages post instantly to every device.
        </p>
        {!canSend && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            <span>🔒</span>
            <span>Read-only mode — you can view family chat history but cannot post messages with this role.</span>
          </div>
        )}
      </header>

      <div className="min-h-[420px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <FamilyChat canSend={canSend} />
      </div>
    </div>
  )
}

export default ChatTab

