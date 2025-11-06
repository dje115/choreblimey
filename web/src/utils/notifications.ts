/**
 * Real-time notification utilities for cross-tab and same-tab communication
 * 
 * This module provides functions to notify other components/tabs about updates
 * using multiple mechanisms for maximum compatibility:
 * 1. Custom Events (same-tab)
 * 2. localStorage (cross-tab)
 * 3. BroadcastChannel (modern browsers, cross-tab) - SINGLETON INSTANCE
 * 
 * @module utils/notifications
 */

/**
 * Notification event types
 */
export type NotificationType = 
  | 'choreUpdated' 
  | 'redemptionUpdated' 
  | 'completionUpdated'
  | 'childJoined'
  | 'giftUpdated'
  | 'familyUpdated'

// Singleton BroadcastChannel instance - keep it open for the lifetime of the app
let broadcastChannelInstance: BroadcastChannel | null = null

/**
 * Get or create the singleton BroadcastChannel instance
 * @internal - Exported for use by useRealtimeUpdates hook
 */
export function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null
  }
  
  if (!broadcastChannelInstance) {
    broadcastChannelInstance = new BroadcastChannel('choreblimey-updates')
    console.log('📡 BroadcastChannel singleton created')
  }
  
  return broadcastChannelInstance
}

/**
 * Broadcasts a notification across all communication channels
 * 
 * @param type - The type of notification event
 * @param data - Optional data to include with the notification
 * 
 * @example
 * ```typescript
 * notifyUpdate('choreUpdated', { choreId: '123' })
 * ```
 */
export function notifyUpdate(type: NotificationType, data?: Record<string, any>): void {
  const timestamp = Date.now()
  const payload = { type, timestamp, ...data }
  
  console.log('📢 notifyUpdate called:', type, { timestamp, data })
  
  // Method 1: Custom event (same-tab communication)
  try {
    const event = new CustomEvent(type, { detail: payload })
    window.dispatchEvent(event)
    console.log('✅ CustomEvent dispatched:', type)
  } catch (error) {
    console.error('❌ Failed to dispatch CustomEvent:', error)
  }
  
  // Method 2: localStorage change (cross-tab communication)
  // Note: storage events only fire in OTHER tabs, not the current tab
  try {
    const storageKey = `${type}_updated`
    localStorage.setItem(storageKey, timestamp.toString())
    console.log('✅ localStorage set:', storageKey, timestamp)
    
    // Force a second update to trigger storage event in other tabs
    // This helps ensure the event is detected even if the first one is missed
    setTimeout(() => {
      localStorage.setItem(storageKey, (timestamp + 1).toString())
      console.log('✅ Second localStorage trigger sent:', storageKey, timestamp + 1)
    }, 50)
  } catch (error) {
    console.error('❌ Failed to set localStorage:', error)
  }
  
  // Method 3: BroadcastChannel (modern browsers, cross-tab)
  // Use singleton instance that stays open
  try {
    const channel = getBroadcastChannel()
    if (channel) {
      channel.postMessage(payload)
      console.log('✅ BroadcastChannel message sent:', type)
    } else {
      console.log('⚠️ BroadcastChannel not available')
    }
  } catch (error) {
    console.error('❌ Failed to send BroadcastChannel message:', error)
  }
}

/**
 * Cleanup function to close the BroadcastChannel (call on app unmount)
 */
export function cleanupNotifications(): void {
  if (broadcastChannelInstance) {
    broadcastChannelInstance.close()
    broadcastChannelInstance = null
    console.log('📡 BroadcastChannel singleton closed')
  }
}

/**
 * Legacy notification functions for backward compatibility
 * These can be removed once all code is updated to use notifyUpdate
 */

/**
 * Notifies child dashboards of chore updates
 * @deprecated Use notifyUpdate('choreUpdated') instead
 */
export function notifyChildDashboards(): void {
  notifyUpdate('choreUpdated')
}

/**
 * Notifies child dashboards of redemption updates
 * @deprecated Use notifyUpdate('redemptionUpdated') instead
 */
export function notifyChildDashboardsOfRedemption(): void {
  notifyUpdate('redemptionUpdated')
}

/**
 * Notifies parent dashboards of completion updates
 * @deprecated Use notifyUpdate('completionUpdated') instead
 */
export function notifyParentDashboards(): void {
  notifyUpdate('completionUpdated')
}
