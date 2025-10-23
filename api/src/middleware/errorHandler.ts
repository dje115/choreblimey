import { FastifyRequest, FastifyReply, FastifyError } from 'fastify'
import { ErrorCode, createError } from '../utils/errors.js'

/**
 * Global error handler middleware for Fastify
 * @param error - The error that occurred
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 */
export async function globalErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Log the error for debugging
  console.error('Global error handler caught:', {
    message: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
    timestamp: new Date().toISOString()
  })

  // Handle different types of errors
  if (error.validation) {
    // Validation errors from Fastify schema validation
    reply.status(400).send({
      error: createError(
        ErrorCode.VALIDATION_INVALID_INPUT,
        'Request validation failed',
        error.validation
      )
    })
    return
  }

  if (error.statusCode) {
    // HTTP status code errors
    const statusCode = error.statusCode
    let errorCode = ErrorCode.SYSTEM_INTERNAL_ERROR
    let message = error.message

    switch (statusCode) {
      case 400:
        errorCode = ErrorCode.VALIDATION_INVALID_INPUT
        break
      case 401:
        errorCode = ErrorCode.AUTH_INVALID_CREDENTIALS
        break
      case 403:
        errorCode = ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS
        break
      case 404:
        errorCode = ErrorCode.RESOURCE_NOT_FOUND
        break
      case 409:
        errorCode = ErrorCode.RESOURCE_CONFLICT
        break
      case 422:
        errorCode = ErrorCode.VALIDATION_INVALID_INPUT
        break
      default:
        errorCode = ErrorCode.SYSTEM_INTERNAL_ERROR
    }

    reply.status(statusCode).send({
      error: createError(errorCode, message)
    })
    return
  }

  // Handle Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any
    
    switch (prismaError.code) {
      case 'P2002':
        reply.status(409).send({
          error: createError(
            ErrorCode.RESOURCE_ALREADY_EXISTS,
            'Resource already exists',
            { field: prismaError.meta?.target }
          )
        })
        return
      case 'P2025':
        reply.status(404).send({
          error: createError(ErrorCode.RESOURCE_NOT_FOUND, 'Resource not found')
        })
        return
      case 'P2003':
        reply.status(400).send({
          error: createError(
            ErrorCode.VALIDATION_INVALID_INPUT,
            'Invalid reference to related resource'
          )
        })
        return
      default:
        reply.status(500).send({
          error: createError(ErrorCode.SYSTEM_DATABASE_ERROR, 'Database operation failed')
        })
        return
    }
  }

  // Handle Prisma validation errors
  if (error.name === 'PrismaClientValidationError') {
    reply.status(400).send({
      error: createError(
        ErrorCode.VALIDATION_INVALID_INPUT,
        'Invalid data provided',
        { details: error.message }
      )
    })
    return
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    reply.status(401).send({
      error: createError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Invalid token')
    })
    return
  }

  if (error.name === 'TokenExpiredError') {
    reply.status(401).send({
      error: createError(ErrorCode.AUTH_TOKEN_EXPIRED, 'Token has expired')
    })
    return
  }

  // Handle rate limiting errors
  if (error.statusCode === 429) {
    reply.status(429).send({
      error: createError(
        ErrorCode.SYSTEM_INTERNAL_ERROR,
        'Too many requests, please try again later'
      )
    })
    return
  }

  // Handle external service errors
  if (error.name === 'FetchError' || error.message.includes('fetch')) {
    reply.status(502).send({
      error: createError(
        ErrorCode.SYSTEM_EXTERNAL_SERVICE_ERROR,
        'External service unavailable'
      )
    })
    return
  }

  // Default error handling
  reply.status(500).send({
    error: createError(
      ErrorCode.SYSTEM_INTERNAL_ERROR,
      'An unexpected error occurred'
    )
  })
}

/**
 * Not found handler for unmatched routes
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 */
export async function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  reply.status(404).send({
    error: createError(
      ErrorCode.RESOURCE_NOT_FOUND,
      `Route ${request.method} ${request.url} not found`
    )
  })
}

/**
 * Request timeout handler
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 */
export async function timeoutHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  reply.status(408).send({
    error: createError(
      ErrorCode.SYSTEM_INTERNAL_ERROR,
      'Request timeout'
    )
  })
}
