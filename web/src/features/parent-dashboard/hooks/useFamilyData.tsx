import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiClient } from '../../../lib/api'
import { useSocket } from '../../../contexts/SocketContext'
import { getBroadcastChannel, notifyUpdate, type NotificationType } from '../../../utils/notifications'

interface JoinCode {
  id: string
  code: string
  expiresAt: string
  intendedNickname?: string | null
  usedAt?: string | null
  usedByChild?: { id: string; nickname?: string | null }
}

interface FamilyMember {
  id: string
  displayName?: string | null
  role: string
  email?: string | null
  user?: { id: string; email?: string | null }
  chatEnabled?: boolean | null
  giftStarsEnabled?: boolean | null
  giftMoneyEnabled?: boolean | null
  birthMonth?: number | null
  birthYear?: number | null
  joinedAt?: string | null
  createdAt?: string | null
  paused?: boolean | null
}

export type FamilyAdult = FamilyMember

interface ChildMember {
  id: string
  nickname: string
  ageGroup?: string | null
  chatEnabled?: boolean | null
  birthYear?: number | null
  birthMonth?: number | null
  gender?: string | null
  email?: string | null
  paused?: boolean | null
  holidayMode?: boolean | null
  holidayStartDate?: string | null
  holidayEndDate?: string | null
  createdAt?: string | null
}

export type FamilyChild = ChildMember

interface FamilyMembersResponse {
  members: FamilyMember[]
  children: ChildMember[]
}

interface FamilyResponse {
  family: {
    id: string
    nameCipher: string
    holidayMode?: boolean | null
    holidayStartDate?: string | null
    holidayEndDate?: string | null
  }
}

interface FamilyState {
  loading: boolean
  refreshing: boolean
  error?: string
  family?: {
    id: string
    nameCipher: string
    holidayMode?: boolean | null
    holidayStartDate?: string | null
    holidayEndDate?: string | null
  }
  adults: FamilyMember[]
  children: ChildMember[]
  joinCodes: JoinCode[]
  familyName?: string
}

export interface UseFamilyDataResult extends FamilyState {
  refresh: () => Promise<void>
  generateJoinCode: (data: { nickname: string; ageGroup: string; gender?: string }) => Promise<any>
  inviteAdult: (data: {
    email: string
    nameCipher: string
    role: 'parent_admin' | 'parent_co_parent' | 'parent_viewer' | 'grandparent' | 'uncle_aunt' | 'relative_contributor'
    sendEmail?: boolean
  }) => Promise<void>
  inviteChild: (data: {
    nameCipher: string
    nickname: string
    ageGroup: string
    birthYear?: number
    birthMonth?: number
    email?: string
    sendEmail?: boolean
  }) => Promise<void>
  updateAdult: (
    memberId: string,
    data: {
      displayName?: string
      chatEnabled?: boolean
      giftStarsEnabled?: boolean
      giftMoneyEnabled?: boolean
      birthMonth?: number | null
      birthYear?: number | null
    },
  ) => Promise<void>
  removeAdult: (memberId: string) => Promise<void>
  toggleAdultPause: (memberId: string) => Promise<boolean>
  updateChildMember: (
    childId: string,
    data: {
      nickname?: string
      ageGroup?: string
      gender?: string
      email?: string
      birthMonth?: number | null
      birthYear?: number | null
    },
  ) => Promise<void>
  removeChildMember: (childId: string) => Promise<void>
  generateAdultDeviceToken: (
    memberId: string,
  ) => Promise<{ token?: string; emailSent?: boolean; expiresAt?: string }>
  toggleChildPause: (childId: string) => Promise<boolean>
  updateFamilyName: (nameCipher: string) => Promise<void>
  updateFamilyHoliday: (settings: { enabled: boolean; startDate?: string | null; endDate?: string | null }) => Promise<void>
  updateChildHoliday: (childId: string, settings: { enabled: boolean; startDate?: string | null; endDate?: string | null }) => Promise<void>
  busyAdultIds: Set<string>
  busyChildIds: Set<string>
  creatingJoinCode: boolean
  invitingAdult: boolean
  invitingChild: boolean
}

export const useFamilyData = (): UseFamilyDataResult => {
  const [state, setState] = useState<FamilyState>({
    loading: true,
    refreshing: false,
    adults: [],
    children: [],
    joinCodes: [],
  })
  const [busyAdultIds, setBusyAdultIds] = useState<Set<string>>(new Set())
  const [busyChildIds, setBusyChildIds] = useState<Set<string>>(new Set())
  const [creatingJoinCode, setCreatingJoinCode] = useState(false)
  const [invitingAdult, setInvitingAdult] = useState(false)
  const [invitingChild, setInvitingChild] = useState(false)
  const { on, off } = useSocket()

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    setState((previous) => ({
      ...previous,
      loading: silent ? previous.loading : true,
      refreshing: silent ? true : false,
      error: undefined,
    }))

    try {
      const [familyRes, membersRes, joinCodesRes] = await Promise.all([
        apiClient.getFamily() as Promise<FamilyResponse>,
        apiClient.getFamilyMembers() as Promise<FamilyMembersResponse>,
        apiClient.getFamilyJoinCodes() as Promise<{ joinCodes: JoinCode[] }>,
      ])

      const familyMembers = membersRes.members ?? []
      const adultMembers = familyMembers.map((member) => ({
        ...member,
        giftStarsEnabled: member.giftStarsEnabled ?? false,
        giftMoneyEnabled: member.giftMoneyEnabled ?? false,
        chatEnabled: member.chatEnabled ?? true,
      })).filter((member) => member.role !== 'child_player')
      const children = (membersRes.children ?? []).map((child) => ({
        ...child,
        holidayMode: child.holidayMode ?? false,
        holidayStartDate: child.holidayStartDate ?? null,
        holidayEndDate: child.holidayEndDate ?? null,
      }))
      const joinCodes = (joinCodesRes.joinCodes ?? []).filter((code) => !code.usedAt)

      setState({
        loading: false,
        refreshing: false,
        error: undefined,
        family: familyRes.family
          ? {
              id: familyRes.family.id,
              nameCipher: familyRes.family.nameCipher,
              holidayMode: familyRes.family.holidayMode ?? null,
              holidayStartDate: familyRes.family.holidayStartDate ?? null,
              holidayEndDate: familyRes.family.holidayEndDate ?? null,
            }
          : undefined,
        adults: adultMembers,
        children,
        joinCodes,
        familyName: familyRes.family?.nameCipher,
      })
    } catch (error) {
      console.error('Failed to load family data', error)
      setState((previous) => ({
        ...previous,
        loading: false,
        refreshing: false,
        error: error instanceof Error ? error.message : 'Failed to load family data',
      }))
    }
  }, [])

  const refresh = useCallback(async () => {
    await load({ silent: true })
  }, [load])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const relevant: NotificationType[] = ['familyUpdated', 'childJoined']

    const handleCustomEvent = () => {
      void load({ silent: true })
    }

    const handleStorage = (event: StorageEvent) => {
      if (!event.key) return
      if (relevant.some((type) => `${type}_updated` === event.key)) {
        void load({ silent: true })
      }
    }

    const channel = getBroadcastChannel()
    const handleBroadcast = (event: MessageEvent<{ type?: NotificationType }>) => {
      if (event.data?.type && relevant.includes(event.data.type)) {
        void load({ silent: true })
      }
    }

    relevant.forEach((type) => window.addEventListener(type, handleCustomEvent))
    window.addEventListener('storage', handleStorage)
    channel?.addEventListener('message', handleBroadcast)

    return () => {
      relevant.forEach((type) => window.removeEventListener(type, handleCustomEvent))
      window.removeEventListener('storage', handleStorage)
      channel?.removeEventListener('message', handleBroadcast)
    }
  }, [load])

  useEffect(() => {
    if (!on || !off) {
      return
    }

    const handleJoinCodesUpdated = () => {
      void refresh()
    }

    on('family:join-codes:updated', handleJoinCodesUpdated)

    return () => {
      off('family:join-codes:updated', handleJoinCodesUpdated)
    }
  }, [on, off, refresh])

  const generateJoinCode = useCallback(
    async (data: { nickname: string; ageGroup: string; gender?: string }) => {
      setCreatingJoinCode(true)
      try {
        const response = await apiClient.generateChildJoinCode(data)
        notifyUpdate('familyUpdated')
        await load({ silent: true })
        return response
      } finally {
        setCreatingJoinCode(false)
      }
    },
    [load],
  )

  const inviteAdult = useCallback(
    async (data: {
      email: string
      nameCipher: string
      role: 'parent_admin' | 'parent_co_parent' | 'parent_viewer' | 'grandparent' | 'uncle_aunt' | 'relative_contributor'
      sendEmail?: boolean
    }) => {
      setInvitingAdult(true)
      try {
        await apiClient.inviteToFamily({
          ...data,
          nickname: data.nameCipher,
          role: data.role,
        })
        notifyUpdate('familyUpdated')
        await load({ silent: true })
      } finally {
        setInvitingAdult(false)
      }
    },
    [load],
  )

  const inviteChild = useCallback(
    async (data: {
      nameCipher: string
      nickname: string
      ageGroup: string
      birthYear?: number
      birthMonth?: number
      email?: string
      sendEmail?: boolean
    }) => {
      setInvitingChild(true)
      try {
        await apiClient.inviteToFamily({
          role: 'child_player',
          nameCipher: data.nameCipher,
          nickname: data.nickname,
          ageGroup: data.ageGroup,
          birthYear: data.birthYear,
          birthMonth: data.birthMonth,
          email: data.email,
          sendEmail: data.sendEmail ?? Boolean(data.email),
        })
        notifyUpdate('familyUpdated')
        await load({ silent: true })
      } finally {
        setInvitingChild(false)
      }
    },
    [load],
  )

  const updateAdult = useCallback(
    async (
      memberId: string,
      data: {
        displayName?: string
        chatEnabled?: boolean
        giftStarsEnabled?: boolean
        giftMoneyEnabled?: boolean
        birthMonth?: number | null
        birthYear?: number | null
      },
    ) => {
      setBusyAdultIds((prev) => new Set(prev).add(memberId))
      try {
        await apiClient.updateFamilyMember(memberId, data)
        notifyUpdate('familyUpdated')
        await load({ silent: true })
      } finally {
        setBusyAdultIds((prev) => {
          const next = new Set(prev)
          next.delete(memberId)
          return next
        })
      }
    },
    [load],
  )

  const removeAdult = useCallback(
    async (memberId: string) => {
      setBusyAdultIds((prev) => new Set(prev).add(memberId))
      try {
        await apiClient.removeMember(memberId)
        notifyUpdate('familyUpdated')
        await load({ silent: true })
      } finally {
        setBusyAdultIds((prev) => {
          const next = new Set(prev)
          next.delete(memberId)
          return next
        })
      }
    },
    [load],
  )

  const toggleAdultPause = useCallback(
    async (memberId: string) => {
      const response = await apiClient.toggleMemberPause(memberId)
      notifyUpdate('familyUpdated')
      await load({ silent: true })
      return Boolean(response?.paused)
    },
    [load],
  )

  const updateChildMember = useCallback(
    async (
      childId: string,
      data: {
        nickname?: string
        ageGroup?: string
        gender?: string
        email?: string
        birthMonth?: number | null
        birthYear?: number | null
      },
    ) => {
      setBusyChildIds((prev) => new Set(prev).add(childId))
      try {
        await apiClient.updateChild(childId, {
          nickname: data.nickname,
          ageGroup: data.ageGroup,
          gender: data.gender,
          email: data.email,
          birthMonth: data.birthMonth ?? undefined,
          birthYear: data.birthYear ?? undefined,
        })
        notifyUpdate('familyUpdated')
        await load({ silent: true })
      } finally {
        setBusyChildIds((prev) => {
          const next = new Set(prev)
          next.delete(childId)
          return next
        })
      }
    },
    [load],
  )

  const removeChildMember = useCallback(
    async (childId: string) => {
      setBusyChildIds((prev) => new Set(prev).add(childId))
      try {
        await apiClient.removeChild(childId)
        notifyUpdate('familyUpdated')
        await load({ silent: true })
      } finally {
        setBusyChildIds((prev) => {
          const next = new Set(prev)
          next.delete(childId)
          return next
        })
      }
    },
    [load],
  )

  const generateAdultDeviceToken = useCallback(
    async (memberId: string) => {
      const response = await apiClient.generateDeviceToken(memberId)
      notifyUpdate('familyUpdated')
      return response as { token?: string; emailSent?: boolean; expiresAt?: string }
    },
    [],
  )

  const toggleChildPause = useCallback(
    async (childId: string) => {
      const result = await apiClient.toggleChildPause(childId)
      notifyUpdate('familyUpdated')
      await load({ silent: true })
      return Boolean(result?.paused)
    },
    [load],
  )

  const updateFamilyName = useCallback(
    async (nameCipher: string) => {
      await apiClient.updateFamily({ nameCipher })
      notifyUpdate('familyUpdated')
      await load({ silent: true })
    },
    [load],
  )

  const updateFamilyHoliday = useCallback(
    async ({ enabled, startDate, endDate }: { enabled: boolean; startDate?: string | null; endDate?: string | null }) => {
      await apiClient.updateFamily({
        holidayMode: enabled,
        holidayStartDate: enabled ? startDate ?? null : null,
        holidayEndDate: enabled ? endDate ?? null : null,
      })
      notifyUpdate('familyUpdated')
      await load({ silent: true })
    },
    [load],
  )

  const updateChildHoliday = useCallback(
    async (
      childId: string,
      { enabled, startDate, endDate }: { enabled: boolean; startDate?: string | null; endDate?: string | null },
    ) => {
      await apiClient.updateChild(childId, {
        holidayMode: enabled,
        holidayStartDate: enabled ? startDate ?? null : null,
        holidayEndDate: enabled ? endDate ?? null : null,
      })
      notifyUpdate('familyUpdated')
      await load({ silent: true })
    },
    [load],
  )

  return useMemo(
    () => ({
      ...state,
      refresh,
      generateJoinCode,
      inviteAdult,
      inviteChild,
      updateAdult,
      removeAdult,
      toggleAdultPause,
      updateChildMember,
      removeChildMember,
      generateAdultDeviceToken,
      toggleChildPause,
      updateFamilyName,
      updateFamilyHoliday,
      updateChildHoliday,
      busyAdultIds,
      busyChildIds,
      creatingJoinCode,
      invitingAdult,
      invitingChild,
    }),
    [
      state,
      refresh,
      generateJoinCode,
      inviteAdult,
      inviteChild,
      updateAdult,
      removeAdult,
      toggleAdultPause,
      updateChildMember,
      removeChildMember,
      generateAdultDeviceToken,
      toggleChildPause,
      updateFamilyName,
      updateFamilyHoliday,
      updateChildHoliday,
      busyAdultIds,
      busyChildIds,
      creatingJoinCode,
      invitingAdult,
      invitingChild,
    ],
  )
}

