import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'
export type Claims = { sub: string; role: string; familyId: string; email?: string; childId?: string; userId?: string; ageGroup?: string; nickname?: string }
declare module 'fastify' { interface FastifyRequest { claims?: Claims } }

export const authPlugin = fp(async (app) => {
  app.decorateRequest('claims', null)
  app.addHook('preHandler', async (req, reply) => {
    // Allow specific auth routes and health check to pass through
    const url = req.url || ''
    const allowedAuthRoutes = [
      '/auth/signup-parent',
      '/auth/callback', 
      '/auth/child-join'
    ]
    
    if (url.includes('/health') || allowedAuthRoutes.some(route => url.includes(route))) return
    
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
      const claims = jwt.verify(token, process.env.JWT_SECRET!) as Claims
      console.log('JWT claims decoded:', { familyId: claims.familyId, sub: claims.sub, role: claims.role, email: claims.email })
      req.claims = claims
      req.headers['x-cb-family'] = claims.familyId
    } catch (error) {
      return reply.status(401).send({ 
        statusCode: 401, 
        error: 'Unauthorized', 
        message: 'Invalid or expired token' 
      })
    }
  })
})
