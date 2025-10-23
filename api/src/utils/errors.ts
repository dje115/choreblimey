/**
 * Standardized error codes for the ChoreBlimey API
 */
export enum ErrorCode {
  // Authentication errors
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_INSUFFICIENT_PERMISSIONS = 'AUTH_INSUFFICIENT_PERMISSIONS',
  
  // Validation errors
  VALIDATION_MISSING_FIELDS = 'VALIDATION_MISSING_FIELDS',
  VALIDATION_INVALID_INPUT = 'VALIDATION_INVALID_INPUT',
  VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',
  
  // Resource errors
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  
  // Business logic errors
  BUSINESS_INVALID_OPERATION = 'BUSINESS_INVALID_OPERATION',
  BUSINESS_INSUFFICIENT_FUNDS = 'BUSINESS_INSUFFICIENT_FUNDS',
  BUSINESS_CHALLENGE_LOCKED = 'BUSINESS_CHALLENGE_LOCKED',
  
  // System errors
  SYSTEM_DATABASE_ERROR = 'SYSTEM_DATABASE_ERROR',
  SYSTEM_EXTERNAL_SERVICE_ERROR = 'SYSTEM_EXTERNAL_SERVICE_ERROR',
  SYSTEM_INTERNAL_ERROR = 'SYSTEM_INTERNAL_ERROR'
}

/**
 * Standardized API error response
 */
export interface APIError {
  code: ErrorCode
  message: string
  details?: any
  timestamp: string
}

/**
 * Create a standardized error response
 * @param code - Error code
 * @param message - Human-readable error message
 * @param details - Additional error details (optional)
 * @returns Standardized error object
 */
export function createError(code: ErrorCode, message: string, details?: any): APIError {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString()
  }
}

/**
 * Common error messages
 */
export const ErrorMessages = {
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'Invalid credentials provided',
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 'Authentication token has expired',
  [ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions for this operation',
  
  [ErrorCode.VALIDATION_MISSING_FIELDS]: 'Required fields are missing',
  [ErrorCode.VALIDATION_INVALID_INPUT]: 'Invalid input provided',
  [ErrorCode.VALIDATION_INVALID_FORMAT]: 'Invalid format provided',
  
  [ErrorCode.RESOURCE_NOT_FOUND]: 'Requested resource not found',
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 'Resource already exists',
  [ErrorCode.RESOURCE_CONFLICT]: 'Resource conflict detected',
  
  [ErrorCode.BUSINESS_INVALID_OPERATION]: 'Invalid operation for current state',
  [ErrorCode.BUSINESS_INSUFFICIENT_FUNDS]: 'Insufficient funds for operation',
  [ErrorCode.BUSINESS_CHALLENGE_LOCKED]: 'Challenge is locked by another user',
  
  [ErrorCode.SYSTEM_DATABASE_ERROR]: 'Database operation failed',
  [ErrorCode.SYSTEM_EXTERNAL_SERVICE_ERROR]: 'External service error',
  [ErrorCode.SYSTEM_INTERNAL_ERROR]: 'Internal server error'
} as const

/**
 * Send standardized error response
 * @param reply - Fastify reply object
 * @param code - Error code
 * @param message - Error message
 * @param statusCode - HTTP status code
 * @param details - Additional details
 */
export function sendError(
  reply: any, 
  code: ErrorCode, 
  message: string, 
  statusCode: number = 500, 
  details?: any
): void {
  const error = createError(code, message, details)
  reply.status(statusCode).send({ error })
}

/**
 * Handle database errors consistently
 * @param error - Database error
 * @param reply - Fastify reply object
 * @param operation - Operation being performed
 */
export function handleDatabaseError(error: any, reply: any, operation: string): void {
  console.error(`Database error during ${operation}:`, error)
  
  if (error.code === 'P2002') {
    sendError(reply, ErrorCode.RESOURCE_ALREADY_EXISTS, 'Resource already exists', 409)
  } else if (error.code === 'P2025') {
    sendError(reply, ErrorCode.RESOURCE_NOT_FOUND, 'Resource not found', 404)
  } else {
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, `Failed to ${operation}`, 500)
  }
}
