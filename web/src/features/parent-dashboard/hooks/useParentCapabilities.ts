import { useCallback, useMemo } from 'react'

import { useAuth } from '../../../contexts/AuthContext'
import { getCapabilitiesForRole, hasCapability, type ParentCapability } from '../roles/capabilities'

export interface ParentCapabilitiesResult {
  role: string | null | undefined
  capabilities: ReadonlySet<ParentCapability>
  hasCapability: (capability: ParentCapability) => boolean
}

export const useParentCapabilities = (): ParentCapabilitiesResult => {
  const { user } = useAuth()
  const role = user?.role

  const capabilities = useMemo(() => getCapabilitiesForRole(role), [role])

  const memoizedHasCapability = useCallback(
    (capability: ParentCapability) => hasCapability(role, capability),
    [role],
  )

  return {
    role,
    capabilities,
    hasCapability: memoizedHasCapability,
  }
}

