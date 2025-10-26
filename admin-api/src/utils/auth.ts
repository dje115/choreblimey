import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'
import { FastifyRequest, FastifyReply } from 'fastify'

export type AdminClaims = { adminId: string; email: string; role: 'super_admin' | 'admin' }
declare module 'fastify' { interface FastifyRequest { adminClaims?: AdminClaims } }

export const adminAuthPlugin = fp(async (app) => {
  app.decorateRequest('adminClaims', null)
  app.addHook('preHandler', async (req, reply) => {
    // Allow auth routes and health check to pass through
    const url = req.url || ''
    if (url.includes('/admin/auth/') || url.includes('/health')) return
    
    const header = req.headers.authorization || ''
    const token = header.replace('Bearer ', '')
    
    if (!token) {
      return reply.status(401).send({ 
        statusCode: 401, 
        error: 'Unauthorized', 
        message: 'Missing or invalid authorization token' 
      })
    }
    
    try {
      const claims = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as AdminClaims
      console.log('Admin JWT claims decoded:', { adminId: claims.adminId, email: claims.email, role: claims.role })
      req.adminClaims = claims
    } catch (error) {
      return reply.status(401).send({ 
        statusCode: 401, 
        error: 'Unauthorized', 
        message: 'Invalid or expired admin token' 
      })
    }
  })
})

export function generateAdminToken(adminId: string, email: string, role: 'super_admin' | 'admin'): string {
  return jwt.sign({ adminId, email, role }, process.env.ADMIN_JWT_SECRET!, { expiresIn: '1h' })
}