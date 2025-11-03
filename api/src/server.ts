/**
 * ChoreBlimey API Server
 * 
 * Main Fastify application entry point for the user-facing API.
 * Handles authentication, routing, rate limiting, and error handling.
 * 
 * @module server
 */

import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { routes } from './routes/index.js'
import { authPlugin } from './utils/auth.js'
import { prisma } from './db/prisma.js'
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler.js'

const app = Fastify({ 
  logger: true,
  trustProxy: true
})

// Register security plugins
await app.register(helmet, {
  contentSecurityPolicy: false
})

/**
 * Rate limiting configuration
 * Increased from 100 to 500 requests/minute to handle dashboard loads
 * with multiple children/chores and consolidated API calls
 */
await app.register(rateLimit, {
  max: process.env.NODE_ENV === 'production' ? 500 : 5000,
  timeWindow: '1 minute',
  allowList: process.env.NODE_ENV === 'production'
    ? []
    : ['127.0.0.1', '::1', '::ffff:127.0.0.1'],
})

await app.register(cors, { 
  origin: true, 
  credentials: true
})

// Register error handlers
app.setErrorHandler(globalErrorHandler)
app.setNotFoundHandler(notFoundHandler)

// Register auth and routes
await app.register(authPlugin)
await app.register(routes, { prefix: '/v1' })

// Start server
const start = async () => {
  try {
    await app.listen({ port: 1501, host: '0.0.0.0' })
    console.log('🚀 API server ready on http://localhost:1501')
  } catch (err) {
    console.error('❌ Failed to start server:', err)
    process.exit(1)
  }
}

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('🛑 Shutting down gracefully...')
  await prisma.$disconnect()
  await app.close()
  process.exit(0)
}

process.on('SIGINT', gracefulShutdown)
process.on('SIGTERM', gracefulShutdown)

start()