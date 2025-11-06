/**
 * Shared validation utilities
 * 
 * Common validation functions used across the application
 * 
 * @module utils/validation
 */

/**
 * Validates email format
 * 
 * @param email - Email address to validate
 * @returns true if email is valid, false otherwise
 * 
 * @example
 * ```typescript
 * if (isValidEmail(userInput)) {
 *   // Process email
 * }
 * ```
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Validates a UUID format
 * 
 * @param uuid - UUID string to validate
 * @returns true if UUID is valid, false otherwise
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * Validates a positive integer
 * 
 * @param value - Value to validate
 * @returns true if value is a positive integer, false otherwise
 */
export function isPositiveInteger(value: any): boolean {
  if (typeof value === 'string') {
    const num = parseInt(value, 10)
    return !isNaN(num) && num > 0 && num.toString() === value.trim()
  }
  return Number.isInteger(value) && value > 0
}

/**
 * Validates a non-negative number (including zero)
 * 
 * @param value - Value to validate
 * @returns true if value is non-negative, false otherwise
 */
export function isNonNegativeNumber(value: any): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return !isNaN(num) && num >= 0
}

/**
 * Validates a string is not empty after trimming
 * 
 * @param value - String to validate
 * @returns true if string is not empty, false otherwise
 */
export function isNonEmptyString(value: any): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Validates a date is in the past
 * 
 * @param date - Date to validate
 * @returns true if date is in the past, false otherwise
 */
export function isPastDate(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  if (isNaN(dateObj.getTime())) return false
  return dateObj < new Date()
}

/**
 * Validates a date is in the future
 * 
 * @param date - Date to validate
 * @returns true if date is in the future, false otherwise
 */
export function isFutureDate(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  if (isNaN(dateObj.getTime())) return false
  return dateObj > new Date()
}

/**
 * Validates a birth year (e.g., between 1900 and current year)
 * 
 * @param year - Year to validate
 * @returns true if year is valid, false otherwise
 */
export function isValidBirthYear(year: number): boolean {
  const currentYear = new Date().getFullYear()
  return Number.isInteger(year) && year >= 1900 && year <= currentYear
}

/**
 * Sanitizes a string by removing potentially dangerous characters
 * Basic XSS prevention - for more robust protection, use DOMPurify
 * 
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(/[<>]/g, '') // Remove < and > characters
    .trim()
}

/**
 * Validates currency amount (pence)
 * 
 * @param amount - Amount in pence
 * @param min - Minimum amount (default: 0)
 * @param max - Maximum amount (optional)
 * @returns true if amount is valid, false otherwise
 */
export function isValidCurrencyAmount(
  amount: number, 
  min: number = 0, 
  max?: number
): boolean {
  if (!Number.isInteger(amount)) return false
  if (amount < min) return false
  if (max !== undefined && amount > max) return false
  return true
}





