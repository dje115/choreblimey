/**
 * Shared error handling utilities
 * 
 * Common error handling patterns used across the application
 * 
 * @module utils/errorHandler
 */

/**
 * Error types that can occur in the application
 */
export type ErrorType = 
  | 'network'
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'server'
  | 'unknown'

/**
 * Structured error information
 */
export interface AppError {
  type: ErrorType
  message: string
  code?: string
  details?: any
}

/**
 * Extracts error message from various error types
 * 
 * @param error - Error object (can be Error, string, or API error response)
 * @returns User-friendly error message
 * 
 * @example
 * ```typescript
 * try {
 *   await apiCall()
 * } catch (error) {
 *   const message = getErrorMessage(error)
 *   showToast(message, 'error')
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  if (error && typeof error === 'object') {
    // Handle API error response
    const apiError = error as { error?: string; message?: string }
    if (apiError.error) return apiError.error
    if (apiError.message) return apiError.message
  }
  
  return 'An unexpected error occurred. Please try again.'
}

/**
 * Parses an error into a structured AppError object
 * 
 * @param error - Error to parse
 * @returns Structured error object
 */
export function parseError(error: unknown): AppError {
  const message = getErrorMessage(error)
  
  // Try to determine error type from message
  let type: ErrorType = 'unknown'
  
  if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
    type = 'network'
  } else if (message.toLowerCase().includes('validation') || message.toLowerCase().includes('invalid')) {
    type = 'validation'
  } else if (message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('login')) {
    type = 'authentication'
  } else if (message.toLowerCase().includes('forbidden') || message.toLowerCase().includes('permission')) {
    type = 'authorization'
  } else if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('404')) {
    type = 'not_found'
  } else if (message.toLowerCase().includes('server') || message.toLowerCase().includes('500')) {
    type = 'server'
  }
  
  return {
    type,
    message,
    details: error
  }
}

/**
 * Handles API errors with consistent logging and user feedback
 * 
 * @param error - Error to handle
 * @param context - Additional context about where the error occurred
 * @returns Structured error object
 * 
 * @example
 * ```typescript
 * try {
 *   await apiCall()
 * } catch (error) {
 *   const appError = handleApiError(error, 'Loading dashboard')
 *   console.error('Dashboard load failed:', appError)
 *   showToast(appError.message, 'error')
 * }
 * ```
 */
export function handleApiError(error: unknown, context?: string): AppError {
  const appError = parseError(error)
  
  // Log error with context
  const logMessage = context 
    ? `[${context}] ${appError.message}`
    : appError.message
  
  console.error('API Error:', logMessage, appError.details)
  
  return appError
}

/**
 * Checks if an error is a network error (offline, timeout, etc.)
 * 
 * @param error - Error to check
 * @returns true if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase()
  return message.includes('network') || 
         message.includes('fetch') || 
         message.includes('timeout') ||
         message.includes('offline')
}

/**
 * Checks if an error is an authentication error
 * 
 * @param error - Error to check
 * @returns true if error is an authentication error
 */
export function isAuthenticationError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase()
  return message.includes('unauthorized') || 
         message.includes('login') ||
         message.includes('token') ||
         message.includes('401')
}





