export const LOGOUT_EVENT_NAME = 'cb:auth:logout' as const

export interface LogoutEventDetail {
  reason?: string
}

declare global {
  interface WindowEventMap {
    [LOGOUT_EVENT_NAME]: CustomEvent<LogoutEventDetail>
  }
}

export const forceLogout = (reason?: string): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem('auth_token')
    window.localStorage.removeItem('user_data')
  } catch (error) {
    console.error('Failed to clear auth storage during forceLogout', error)
  }

  const event: CustomEvent<LogoutEventDetail> = new CustomEvent(LOGOUT_EVENT_NAME, {
    detail: { reason },
  })

  window.dispatchEvent(event)
}

