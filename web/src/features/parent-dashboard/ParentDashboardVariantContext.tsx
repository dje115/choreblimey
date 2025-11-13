import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

export type ParentDashboardVariant = 'legacy' | 'tabs'

interface ParentDashboardVariantContextValue {
  variant: ParentDashboardVariant
  setVariant: (variant: ParentDashboardVariant, options?: { source?: string; suppressPersist?: boolean }) => void
  defaultVariant: ParentDashboardVariant
  lastUpdateSource?: string
}

const ParentDashboardVariantContext = createContext<ParentDashboardVariantContextValue | undefined>(undefined)

const VARIANT_STORAGE_KEY = 'cb_parent_dashboard_variant'
const VARIANT_QUERY_KEY = 'parentDashboard'

const normalizeVariant = (value: string | null | undefined): ParentDashboardVariant | undefined => {
  if (!value) return undefined
  const lower = value.toLowerCase()
  if (lower === 'tabs' || lower === 'legacy') {
    return lower as ParentDashboardVariant
  }
  return undefined
}

const resolveDefaultVariant = (): ParentDashboardVariant => {
  const envDefault = import.meta.env.VITE_PARENT_DASHBOARD_TABS_DEFAULT
  if (envDefault && envDefault.toLowerCase() === 'tabs') {
    return 'tabs'
  }
  return 'legacy'
}

export const ParentDashboardVariantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const defaultVariantRef = useRef<ParentDashboardVariant>(resolveDefaultVariant())
  const getInitialVariant = useCallback((): ParentDashboardVariant => {
    if (typeof window !== 'undefined') {
      const queryVariant = normalizeVariant(new URLSearchParams(window.location.search).get(VARIANT_QUERY_KEY))
      if (queryVariant) {
        return queryVariant
      }

      const storedVariant = normalizeVariant(window.localStorage.getItem(VARIANT_STORAGE_KEY))
      if (storedVariant) {
        return storedVariant
      }
    }

    return defaultVariantRef.current
  }, [])

  const [variant, setVariantState] = useState<ParentDashboardVariant>(() => getInitialVariant())
  const [lastUpdateSource, setLastUpdateSource] = useState<string | undefined>()

  const setVariant = useCallback(
    (next: ParentDashboardVariant, options?: { source?: string; suppressPersist?: boolean }) => {
      setVariantState(next)
      setLastUpdateSource(options?.source)

      if (options?.suppressPersist) {
        return
      }

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        if (next === defaultVariantRef.current) {
          window.localStorage.removeItem(VARIANT_STORAGE_KEY)
          params.delete(VARIANT_QUERY_KEY)
        } else {
          window.localStorage.setItem(VARIANT_STORAGE_KEY, next)
          params.set(VARIANT_QUERY_KEY, next)
        }

        const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`
        window.history.replaceState({}, '', nextUrl)
      }
    },
    []
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== VARIANT_STORAGE_KEY) {
        return
      }

      const next = normalizeVariant(event.newValue) ?? defaultVariantRef.current
      setVariantState(next)
      setLastUpdateSource('storage')
    }

    const handlePopState = () => {
      const queryVariant = normalizeVariant(new URLSearchParams(window.location.search).get(VARIANT_QUERY_KEY))
      if (queryVariant && queryVariant !== variant) {
        setVariant(queryVariant, { source: 'url', suppressPersist: true })
      } else if (!queryVariant && variant !== defaultVariantRef.current) {
        setVariant(defaultVariantRef.current, { source: 'url', suppressPersist: true })
      }
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [setVariant, variant])

  const value = useMemo<ParentDashboardVariantContextValue>(
    () => ({
      variant,
      setVariant,
      defaultVariant: defaultVariantRef.current,
      lastUpdateSource,
    }),
    [variant, setVariant, lastUpdateSource]
  )

  return <ParentDashboardVariantContext.Provider value={value}>{children}</ParentDashboardVariantContext.Provider>
}

export const useParentDashboardVariant = (): ParentDashboardVariantContextValue => {
  const context = useContext(ParentDashboardVariantContext)
  if (!context) {
    throw new Error('useParentDashboardVariant must be used within a ParentDashboardVariantProvider')
  }
  return context
}

