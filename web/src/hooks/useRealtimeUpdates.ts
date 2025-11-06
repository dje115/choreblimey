/**
 * Custom hook for real-time updates using multiple communication channels
 * 
 * This hook listens for updates across tabs and within the same tab using:
 * 1. Custom Events (same-tab)
 * 2. localStorage events (cross-tab)
 * 3. BroadcastChannel (modern browsers, cross-tab) - SINGLETON INSTANCE
 * 4. Polling with Page Visibility API (fallback)
 * 
 * @module hooks/useRealtimeUpdates
 */

import { useEffect, useRef, useCallback } from 'react'
import { getBroadcastChannel } from '../utils/notifications'

/**
 * Configuration options for real-time updates
 */
export interface RealtimeUpdateOptions {
  /** Event types to listen for */
  eventTypes: string[]
  /** Callback function when update is detected */
  onUpdate: () => void
  /** Enable polling fallback (default: false) */
  enablePolling?: boolean
  /** Polling interval in milliseconds (default: 5000) */
  pollingInterval?: number
  /** Enable Page Visibility API (only poll when tab is visible) */
  useVisibilityAPI?: boolean
}

/**
 * Custom hook for listening to real-time updates
 * 
 * @param options - Configuration options for real-time updates
 * 
 * @example
 * ```typescript
 * useRealtimeUpdates({
 *   eventTypes: ['choreUpdated', 'redemptionUpdated'],
 *   onUpdate: () => loadDashboard(),
 *   enablePolling: true,
 *   pollingInterval: 5000,
 *   useVisibilityAPI: true
 * })
 * ```
 */
export function useRealtimeUpdates(options: RealtimeUpdateOptions): void {
  const {
    eventTypes,
    onUpdate,
    enablePolling = false,
    pollingInterval = 5000,
    useVisibilityAPI = true
  } = options

  const pollingIntervalRef = useRef<number | null>(null)
  const immediatePollIntervalRef = useRef<number | null>(null)
  const lastUpdateTimeRef = useRef<number>(0)
  const isMountedRef = useRef<boolean>(true)
  
  // Store event types and onUpdate in refs to avoid recreating listeners
  const eventTypesRef = useRef<string[]>(eventTypes)
  const onUpdateRef = useRef<() => void>(onUpdate)
  
  // Update refs when they change
  useEffect(() => {
    eventTypesRef.current = eventTypes
    onUpdateRef.current = onUpdate
  }, [eventTypes, onUpdate])

  // Debug logging (only on mount)
  useEffect(() => {
    console.log('🔧 useRealtimeUpdates hook initialized', { 
      eventTypes, 
      enablePolling, 
      pollingInterval 
    })
    isMountedRef.current = true
    
    return () => {
      isMountedRef.current = false
    }
  }, []) // Only log on mount

  /**
   * Check if tab is visible (Page Visibility API)
   */
  const isTabVisible = useCallback((): boolean => {
    if (!useVisibilityAPI) return true
    return document.visibilityState === 'visible'
  }, [useVisibilityAPI])

  /**
   * Handle custom events (same-tab)
   */
  const handleCustomEvent = useCallback((event: Event) => {
    if (!isMountedRef.current) return
    
    // Check if this is one of our event types
    if (!eventTypesRef.current.includes(event.type)) {
      console.log('⏭️ Not listening for this event type, ignoring:', event.type, 'listening for:', eventTypesRef.current)
      return
    }
    
    const customEvent = event as CustomEvent
    const timestamp = customEvent.detail?.timestamp || Date.now()
    
    console.log('📢 CustomEvent received:', event.type, { timestamp, lastUpdate: lastUpdateTimeRef.current })
    
    // Prevent duplicate updates within 500ms
    if (timestamp - lastUpdateTimeRef.current < 500) {
      console.log('⏭️ Skipping duplicate update (within 500ms)')
      return
    }
    
    lastUpdateTimeRef.current = timestamp
    console.log('✅ Triggering onUpdate from CustomEvent')
    onUpdateRef.current()
  }, []) // Empty deps - use refs instead

  /**
   * Handle localStorage events (cross-tab)
   * Note: storage events only fire in OTHER tabs, not the current tab
   */
  const handleStorageEvent = useCallback((e: StorageEvent) => {
    if (!isMountedRef.current) return
    if (!e.key) return
    
    console.log('💾 StorageEvent received:', e.key, { newValue: e.newValue, oldValue: e.oldValue })
    
    // Check if this is one of our event types
    // Storage keys are in format: `${type}_updated`
    const isOurEvent = eventTypesRef.current.some(type => e.key === `${type}_updated`)
    if (!isOurEvent) {
      console.log('⏭️ Not our event type, ignoring:', e.key, 'listening for:', eventTypesRef.current.map(t => `${t}_updated`))
      return
    }
    
    // Prevent duplicate updates
    const newTimestamp = parseInt(e.newValue || '0', 10)
    if (newTimestamp - lastUpdateTimeRef.current < 500) {
      console.log('⏭️ Skipping duplicate update (within 500ms)')
      return
    }
    
    lastUpdateTimeRef.current = newTimestamp
    console.log('✅ Triggering onUpdate from StorageEvent for:', e.key)
    onUpdateRef.current()
  }, []) // Empty deps - use refs instead

  /**
   * Handle BroadcastChannel messages (cross-tab, modern browsers)
   * Uses singleton instance from notifications.ts
   */
  const handleBroadcastMessage = useCallback((event: MessageEvent) => {
    if (!isMountedRef.current) return
    if (!event.data || typeof event.data !== 'object') return
    
    const { type, timestamp } = event.data
    console.log('📡 BroadcastChannel message received:', type, { timestamp, listeningFor: eventTypesRef.current })
    
    if (!eventTypesRef.current.includes(type)) {
      console.log('⏭️ Not listening for this event type, ignoring:', type, 'listening for:', eventTypesRef.current)
      return
    }
    
    // Prevent duplicate updates
    const eventTimestamp = timestamp || Date.now()
    if (eventTimestamp - lastUpdateTimeRef.current < 500) {
      console.log('⏭️ Skipping duplicate update (within 500ms)')
      return
    }
    
    lastUpdateTimeRef.current = eventTimestamp
    console.log('✅ Triggering onUpdate from BroadcastChannel for:', type)
    onUpdateRef.current()
  }, []) // Empty deps - use refs instead

  /**
   * Polling fallback with Page Visibility API
   */
  const startPolling = useCallback(() => {
    if (!enablePolling) return
    
    const poll = () => {
      if (!isMountedRef.current) return
      
      // Only poll if tab is visible
      if (!isTabVisible()) return
      
      // Check localStorage for updates
      eventTypesRef.current.forEach(eventType => {
        const storageKey = `${eventType}_updated`
        const storedTimestamp = localStorage.getItem(storageKey)
        
        if (storedTimestamp) {
          const timestamp = parseInt(storedTimestamp, 10)
          if (timestamp > lastUpdateTimeRef.current) {
            console.log('🔍 Polling detected update:', eventType, { timestamp, lastUpdate: lastUpdateTimeRef.current })
            lastUpdateTimeRef.current = timestamp
            console.log('✅ Triggering onUpdate from polling for:', eventType)
            onUpdateRef.current()
            // Clean up after processing (with small delay to allow other tabs to see it)
            setTimeout(() => {
              if (isMountedRef.current) {
                localStorage.removeItem(storageKey)
              }
            }, 1000)
          }
        }
      })
    }
    
    // Poll immediately on setup
    poll()
    
    // Poll more aggressively for the first few seconds (every 500ms)
    // This ensures immediate updates when events are fired
    let immediatePollCount = 0
    immediatePollIntervalRef.current = window.setInterval(() => {
      if (!isMountedRef.current) {
        if (immediatePollIntervalRef.current !== null) {
          clearInterval(immediatePollIntervalRef.current)
          immediatePollIntervalRef.current = null
        }
        return
      }
      poll()
      immediatePollCount++
      if (immediatePollCount >= 6) { // Poll 6 times (3 seconds) then switch to normal interval
        if (immediatePollIntervalRef.current !== null) {
          clearInterval(immediatePollIntervalRef.current)
          immediatePollIntervalRef.current = null
        }
      }
    }, 500)
    
    // Then poll at normal interval
    pollingIntervalRef.current = window.setInterval(() => {
      if (!isMountedRef.current) {
        if (pollingIntervalRef.current !== null) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        return
      }
      poll()
    }, pollingInterval)
  }, [enablePolling, pollingInterval, isTabVisible])

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current !== null) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    if (immediatePollIntervalRef.current !== null) {
      clearInterval(immediatePollIntervalRef.current)
      immediatePollIntervalRef.current = null
    }
  }, [])

  // Set up event listeners (only once on mount)
  useEffect(() => {
    // Set up Custom Event listeners
    eventTypes.forEach(eventType => {
      window.addEventListener(eventType, handleCustomEvent)
      console.log('👂 Listening for CustomEvent:', eventType)
    })

    // Set up localStorage listener
    window.addEventListener('storage', handleStorageEvent)
    console.log('👂 Listening for StorageEvent')

    // Set up BroadcastChannel listener (use singleton instance)
    const channel = getBroadcastChannel()
    if (channel) {
      channel.onmessage = handleBroadcastMessage
      console.log('👂 Listening for BroadcastChannel messages')
    }

    // Start polling if enabled
    if (enablePolling) {
      startPolling()
    }

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up useRealtimeUpdates listeners')
      eventTypes.forEach(eventType => {
        window.removeEventListener(eventType, handleCustomEvent)
      })
      window.removeEventListener('storage', handleStorageEvent)
      
      // Don't close the BroadcastChannel here - it's a singleton shared across all hooks
      // Just remove our message handler
      if (channel) {
        channel.onmessage = null
      }
      
      stopPolling()
    }
  }, []) // Empty deps - set up listeners only once on mount

  // Update polling when options change
  useEffect(() => {
    if (enablePolling) {
      stopPolling()
      startPolling()
    } else {
      stopPolling()
    }
  }, [enablePolling, pollingInterval, startPolling, stopPolling])
}
