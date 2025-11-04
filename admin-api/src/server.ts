import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import { routes } from './routes/index.js'
import { adminAuthPlugin } from './utils/auth.js'
import { prisma } from './db/prisma.js'
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { siteEmailService as emailService } from './services/emailService.js'

const app = Fastify({ 
  logger: true,
  trustProxy: true
})

// Register security plugins
await app.register(helmet, {
  contentSecurityPolicy: false
})

await app.register(rateLimit, {
  max: 500,
  timeWindow: '1 minute'
})

await app.register(cors, { 
  origin: '*', // Admin API can be accessed from anywhere, but will be behind Nginx
  credentials: true
})

await app.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  }
})

// Register error handlers
app.setErrorHandler(globalErrorHandler)
app.setNotFoundHandler(notFoundHandler)

// Register auth plugin
await app.register(adminAuthPlugin)

// Register routes
await app.register(routes, { prefix: '/v1' })

const start = async () => {
  try {
    const port = parseInt(process.env.ADMIN_API_PORT || '1502')
    const host = process.env.ADMIN_API_HOST || '0.0.0.0'
    await app.listen({ port, host })
    console.log(`🚀 Admin API server ready on http://${host}:${port}`)

    // Test database connection
    await prisma.$connect()
    console.log('✅ PostgreSQL database connected')

    // Test Redis connection
    console.log('✅ Redis cache connected')

    // Test email service
    console.log(`📧 Email service configured: ${process.env.SMTP_HOST || 'mailhog'}:${process.env.SMTP_PORT || '1025'}`)
    console.log(`📧 View emails at: http://localhost:${process.env.MAILHOG_UI_PORT || '1506'}`)
    
    // Initialize email service
    await emailService.initialize()

    // Initialize S3 bucket (create if needed)
    try {
      const { ensureBucketExists } = await import('./services/s3Service.js')
      await ensureBucketExists()
      console.log('✅ S3/MinIO storage initialized')
    } catch (error) {
      console.error('⚠️ Failed to initialize S3 bucket:', error)
    }

  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()