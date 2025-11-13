export type AdultRole =
  | 'parent_admin'
  | 'parent_co_parent'
  | 'parent_viewer'
  | 'relative_contributor'
  | 'grandparent'
  | 'uncle_aunt'
  | 'helper'

export type ParentCapability =
  | 'chat:view'
  | 'chat:write'
  | 'approvals:view'
  | 'approvals:manage'
  | 'chores:view'
  | 'chores:edit'
  | 'streaks:view'
  | 'streaks:manage'
  | 'finances:view'
  | 'finances:manage'
  | 'family:view'
  | 'family:manage'
  | 'lists:view'
  | 'lists:edit'

const createCapabilitySet = (capabilities: ParentCapability[]): ReadonlySet<ParentCapability> =>
  new Set(capabilities) as ReadonlySet<ParentCapability>

const DEFAULT_CAPABILITIES = createCapabilitySet(['chat:view'])

const ROLE_CAPABILITIES: Record<AdultRole, ReadonlySet<ParentCapability>> = {
  parent_admin: createCapabilitySet([
    'chat:view',
    'chat:write',
    'approvals:view',
    'approvals:manage',
    'chores:view',
    'chores:edit',
    'streaks:view',
    'streaks:manage',
    'finances:view',
    'finances:manage',
    'family:view',
    'family:manage',
    'lists:view',
    'lists:edit',
  ]),
  parent_co_parent: createCapabilitySet([
    'chat:view',
    'chat:write',
    'approvals:view',
    'approvals:manage',
    'chores:view',
    'chores:edit',
    'streaks:view',
    'streaks:manage',
    'finances:view',
    'finances:manage',
    'family:view',
    'family:manage',
    'lists:view',
    'lists:edit',
  ]),
  parent_viewer: createCapabilitySet([
    'chat:view',
    'approvals:view',
    'chores:view',
    'streaks:view',
    'finances:view',
    'family:view',
    'lists:view',
  ]),
  relative_contributor: createCapabilitySet([
    'chat:view',
    'chat:write',
    'approvals:view',
    'chores:view',
    'streaks:view',
    'lists:view',
  ]),
  grandparent: createCapabilitySet(['chat:view', 'chat:write', 'approvals:view', 'finances:view', 'lists:view']),
  uncle_aunt: createCapabilitySet(['chat:view', 'chat:write', 'approvals:view', 'chores:view', 'lists:view']),
  helper: createCapabilitySet(['chat:view', 'approvals:view', 'chores:view']),
}

const ADULT_ROLES: AdultRole[] = [
  'parent_admin',
  'parent_co_parent',
  'parent_viewer',
  'relative_contributor',
  'grandparent',
  'uncle_aunt',
  'helper',
]

const normalizeRole = (role: string | null | undefined): AdultRole | undefined => {
  if (!role) return undefined
  return ADULT_ROLES.includes(role as AdultRole) ? (role as AdultRole) : undefined
}

export const getCapabilitiesForRole = (role: string | null | undefined): ReadonlySet<ParentCapability> => {
  const normalizedRole = normalizeRole(role)
  if (!normalizedRole) {
    return DEFAULT_CAPABILITIES
  }

  return ROLE_CAPABILITIES[normalizedRole] ?? DEFAULT_CAPABILITIES
}

export const hasCapability = (role: string | null | undefined, capability: ParentCapability): boolean =>
  getCapabilitiesForRole(role).has(capability)

