import React, { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../../contexts/AuthContext'
import { useSocket } from '../../contexts/SocketContext'
import { useParentDashboardSnapshot, type ParentDashboardSnapshot } from './hooks/useParentDashboardSnapshot'
import { useParentCapabilities } from './hooks/useParentCapabilities'
import { useApprovalsData } from './hooks/useApprovalsData'
import { useParentDashboardVariant } from './ParentDashboardVariantContext'
import type { ParentCapability } from './roles/capabilities'
import ApprovalsTab from './components/ApprovalsTab'
import ChatTab from './components/ChatTab'
import ManageChoresTab from './components/ManageChoresTab'
import StreakRewardsTab from './components/StreakRewardsTab'
import FinancesTab from './components/FinancesTab'
import FamilyTab from './components/FamilyTab'
import GiftShopTab from './components/GiftShopTab'
import { notifyUpdate } from '../../utils/notifications'

type ParentDashboardTab =
  | 'chat'
  | 'approvals'
  | 'manage-chores'
  | 'streak-rewards'
  | 'finances'
  | 'family'
  | 'lists-ideas'
  | 'gift-shop'

interface DashboardTabDefinition {
  id: ParentDashboardTab
  label: string
  icon: string
  description: string
  soon?: boolean
  requiredCapability?: ParentCapability
}

const TAB_DEFINITIONS: DashboardTabDefinition[] = [
  { id: 'chat', label: 'Chat', icon: '💬', description: 'Catch up with the family in real time.', requiredCapability: 'chat:view' },
  {
    id: 'approvals',
    label: 'Approvals',
    icon: '✅',
    description: 'Review chore completions, purchases, and rewards.',
    requiredCapability: 'approvals:view',
  },
  {
    id: 'manage-chores',
    label: 'Manage Chores',
    icon: '🧹',
    description: 'Assign chores, edit schedules, and templates.',
    requiredCapability: 'chores:view',
  },
  {
    id: 'streak-rewards',
    label: 'Streak Rewards',
    icon: '🔥',
    description: 'Track streaks and bonus incentives.',
    requiredCapability: 'streaks:view',
  },
  {
    id: 'finances',
    label: 'Finances & Payouts',
    icon: '💷',
    description: 'Monitor pocket money, outstanding balances, and payouts.',
    requiredCapability: 'finances:view',
  },
  {
    id: 'family',
    label: 'Family Hub',
    icon: '👨‍👩‍👧‍👦',
    description: 'Manage members, permissions, and devices.',
    requiredCapability: 'family:view',
  },
  {
    id: 'lists-ideas',
    label: 'Lists & Ideas',
    icon: '🎁',
    description: 'Birthday lists, Christmas wishes, and curated gift inspiration.',
    soon: true,
    requiredCapability: 'lists:view',
  },
  {
    id: 'gift-shop',
    label: 'Gift Shop',
    icon: '🎁',
    description: 'Curate and manage the family reward store.',
    requiredCapability: 'streaks:manage',
  },
]

const TAB_STORAGE_KEY = 'cb_parent_dashboard_active_tab'

interface SummaryCard {
  title: string
  value: string
  hint?: string
  accent?: 'info' | 'warning' | 'success'
}

const formatMaybeNumber = (value: number | null, options?: Intl.NumberFormatOptions) => {
  if (value === null || Number.isNaN(value)) {
    return '—'
  }

  return new Intl.NumberFormat('en-GB', options).format(value)
}

const buildSummaryCards = (snapshot: ParentDashboardSnapshot): SummaryCard[] => [
  {
    title: 'Pending Approvals',
    value: formatMaybeNumber(snapshot.pendingApprovals),
    hint: 'Approvals tab',
    accent: snapshot.pendingApprovals ? 'warning' : undefined,
  },
  {
    title: 'Open Chores',
    value: formatMaybeNumber(snapshot.openChores),
    hint: 'Manage chores tab',
  },
  {
    title: 'Active Streaks',
    value: formatMaybeNumber(snapshot.activeStreaks),
    hint: 'Streak rewards tab',
    accent: snapshot.activeStreaks ? 'success' : undefined,
  },
  {
    title: 'Outstanding Pocket Money',
    value:
      snapshot.outstandingPocketMoneyPence === null
        ? '£—'
        : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
            snapshot.outstandingPocketMoneyPence / 100,
          ),
    hint: 'Finances tab',
    accent: snapshot.outstandingPocketMoneyPence ? 'info' : undefined,
  },
]

const TabUnderConstruction: React.FC<{ title: string; description: string; soon?: boolean }> = ({
  title,
  description,
  soon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="rounded-full bg-blue-50 p-4 text-3xl">🚧</div>
      <div>
        <p className="text-lg font-semibold text-slate-900">{title}</p>
        <p className="mt-2 text-sm text-slate-500 max-w-xl">{description}</p>
      </div>
      {soon && (
        <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
          Coming soon
        </span>
      )}
    </div>
  )
}

const ParentDashboardTabs: React.FC = () => {
  const { user } = useAuth()
  const { snapshot, loading, error } = useParentDashboardSnapshot()
  const approvals = useApprovalsData()
  const { setVariant } = useParentDashboardVariant()
  const { hasCapability } = useParentCapabilities()
  const { on, off } = useSocket()
  const availableTabs = useMemo(
    () => TAB_DEFINITIONS.filter((tab) => !tab.requiredCapability || hasCapability(tab.requiredCapability)),
    [hasCapability],
  )
  const summaryCards = useMemo(() => {
    const base = buildSummaryCards(snapshot)
    const pendingApprovalsTotal =
      approvals.completions.length + approvals.redemptions.length + approvals.starPurchases.length

    return base.map((card) =>
      card.title === 'Pending Approvals'
        ? {
            ...card,
            value: formatMaybeNumber(pendingApprovalsTotal),
            accent: pendingApprovalsTotal ? 'warning' : undefined,
          }
        : card,
    )
  }, [snapshot, approvals.completions.length, approvals.redemptions.length, approvals.starPurchases.length])

  const [activeTab, setActiveTab] = useState<ParentDashboardTab>(() => {
    if (typeof window !== 'undefined') {
      const storedTab = localStorage.getItem(TAB_STORAGE_KEY) as ParentDashboardTab | null
      if (storedTab && availableTabs.some((tab) => tab.id === storedTab)) {
        return storedTab
      }
    }
    return availableTabs[0]?.id ?? TAB_DEFINITIONS[0].id
  })

  useEffect(() => {
    const storedTab = localStorage.getItem(TAB_STORAGE_KEY) as ParentDashboardTab | null
    if (storedTab && availableTabs.some((tab) => tab.id === storedTab)) {
      setActiveTab(storedTab)
    }
  }, [availableTabs])

  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, activeTab)
  }, [activeTab])

  useEffect(() => {
    if (!availableTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(availableTabs[0]?.id ?? TAB_DEFINITIONS[0].id)
    }
  }, [availableTabs, activeTab])

  useEffect(() => {
    if (!on || !off) {
      return
    }

    const handlers: Array<{ event: string; handler: () => void }> = [
      {
        event: 'completion:created',
        handler: () => notifyUpdate('completionUpdated'),
      },
      {
        event: 'completion:approved',
        handler: () => notifyUpdate('completionUpdated'),
      },
      {
        event: 'completion:rejected',
        handler: () => notifyUpdate('completionUpdated'),
      },
      {
        event: 'redemption:created',
        handler: () => notifyUpdate('redemptionUpdated'),
      },
      {
        event: 'redemption:fulfilled',
        handler: () => notifyUpdate('redemptionUpdated'),
      },
      {
        event: 'redemption:rejected',
        handler: () => notifyUpdate('redemptionUpdated'),
      },
      {
        event: 'starPurchase:created',
        handler: () => notifyUpdate('redemptionUpdated'),
      },
      {
        event: 'starPurchase:approved',
        handler: () => notifyUpdate('redemptionUpdated'),
      },
      {
        event: 'starPurchase:rejected',
        handler: () => notifyUpdate('redemptionUpdated'),
      },
    ]

    handlers.forEach(({ event, handler }) => on(event, handler))

    return () => {
      handlers.forEach(({ event, handler }) => off(event, handler))
    }
  }, [on, off])

  const renderTabContent = () => {
    const tab = availableTabs.find((definition) => definition.id === activeTab)
    if (!tab) {
      return null
    }

    switch (tab.id) {
      case 'chat':
        return <ChatTab />
      case 'approvals':
        return <ApprovalsTab approvals={approvals} />
      case 'manage-chores':
        return <ManageChoresTab />
      case 'streak-rewards':
        return <StreakRewardsTab />
      case 'finances':
        return <FinancesTab />
      case 'family':
        return <FamilyTab />
      case 'gift-shop':
        return <GiftShopTab />
      case 'lists-ideas':
        return (
          <TabUnderConstruction
            title="Lists & Gift Ideas"
            description="Birthday lists, Christmas wishlists, and curated recommendations will live here."
            soon
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-6 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-rose-500 px-6 py-8 text-white shadow-lg sm:px-8 sm:py-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-white/80">ChoreBlimey! Parent HQ</p>
              <h1 className="text-3xl font-bold sm:text-4xl lg:text-5xl">
                Hey {user?.nickname || user?.nameCipher || 'Super Parent'} 👋
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/90 sm:text-base">
                Stay on top of family chores, rewards, and finances with a mobile-first control centre designed just for
                you.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 self-start rounded-2xl bg-white/15 px-4 py-3 text-sm font-semibold shadow-inner backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="text-white/80">Layout</span>
                <span className="rounded-full bg-white/90 px-3 py-1 text-slate-900">Tabbed beta</span>
              </div>
              <button
                type="button"
                onClick={() => setVariant('legacy', { source: 'tabs-header' })}
                className="rounded-full border border-white/40 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                Open legacy view
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {summaryCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-white/20 bg-white/15 px-4 py-5 shadow-sm backdrop-blur transition-transform hover:-translate-y-0.5 hover:bg-white/20"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{card.title}</p>
                  <p className="mt-3 text-2xl font-bold text-white">
                    {loading ? <span className="inline-flex h-6 w-16 animate-pulse rounded-full bg-white/40" /> : card.value}
                  </p>
                  {card.hint && <p className="mt-2 text-xs text-white/75">{card.hint}</p>}
                </div>
              ))}
          </div>
        </header>

        <div className="mt-8 flex flex-col gap-6 lg:flex-row">
          <aside className="hidden w-full max-w-xs flex-none lg:block">
            <nav className="sticky top-6 flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              {availableTabs.map((tab) => {
                const isActive = tab.id === activeTab
                const badge =
                  tab.id === 'chat'
                    ? snapshot.unreadMessages
                    : tab.id === 'approvals'
                      ? snapshot.pendingApprovals
                      : tab.id === 'manage-chores'
                        ? snapshot.openChores
                        : undefined

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    <span className="text-sm font-semibold">{tab.label}</span>
                    {typeof badge === 'number' && badge > 0 && (
                      <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                    {tab.soon && (
                      <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
                        Soon
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </aside>

          <main className="flex-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:hidden">
              <div className="flex snap-x snap-mandatory overflow-x-auto">
                {availableTabs.map((tab) => {
                  const isActive = tab.id === activeTab
                  const badge =
                    tab.id === 'chat'
                      ? snapshot.unreadMessages
                      : tab.id === 'approvals'
                        ? snapshot.pendingApprovals
                        : tab.id === 'manage-chores'
                          ? snapshot.openChores
                          : undefined

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`mr-2 flex snap-center flex-col items-center rounded-2xl px-4 py-3 text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span className="text-lg">{tab.icon}</span>
                      <span className="mt-1 whitespace-nowrap">{tab.label}</span>
                      {typeof badge === 'number' && badge > 0 && (
                        <span className="mt-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                      {tab.soon && (
                        <span className="mt-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold uppercase text-indigo-700">
                          Soon
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <section className="mt-4 rounded-3xl border border-slate-200 bg-white shadow-sm lg:mt-0">
              {error && (
                <div className="flex items-center gap-3 border-b border-slate-200 bg-rose-50 px-5 py-3 text-sm text-rose-700">
                  <span className="text-lg">⚠️</span>
                  <span>{error}</span>
                </div>
              )}
              {loading && !error && (
                <div className="flex gap-3 border-b border-slate-200 px-5 py-3 text-sm text-slate-500">
                  <span className="h-2 w-2 animate-ping rounded-full bg-indigo-500" />
                  <span>Loading dashboard data…</span>
                </div>
              )}
              {renderTabContent()}
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ParentDashboardTabs

