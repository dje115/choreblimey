import type { SocketIOServer } from 'socket.io'

interface JoinCodeEventPayload {
  action?: 'created' | 'consumed' | 'revoked'
  code?: string
  childId?: string | null
  nickname?: string | null
}

const emit = (io: SocketIOServer | null, familyId: string, payload: JoinCodeEventPayload = {}): void => {
  if (!io) {
    return
  }

  import('../websocket/socket.js').then(({ emitToFamily }) => {
    emitToFamily(io, familyId, 'family:join-codes:updated', {
      familyId,
      timestamp: new Date().toISOString(),
      ...payload,
    })
  }).catch((error) => {
    console.error('❌ Failed to emit family join code update via websocket', { familyId, error })
  })
}

export const emitFamilyJoinCodesUpdated = async (
  familyId: string | null | undefined,
  payload: JoinCodeEventPayload = {},
): Promise<void> => {
  if (!familyId) {
    return
  }

  try {
    const { io } = await import('../server.js')
    emit(io, familyId, payload)
  } catch (error) {
    console.error('❌ Failed to load websocket server for family join code update', { familyId, error })
  }
}

