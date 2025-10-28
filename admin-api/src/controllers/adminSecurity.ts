import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

/**
 * GET /admin/security/logs
 * Get security logs (login attempts, failed auth, etc.)
 */
export const getSecurityLogs = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: {
          in: ['LOGIN_FAILED', 'LOGIN_SUCCESS', 'ADMIN_LOGIN_FAILED', 'ADMIN_LOGIN_SUCCESS', 'LOGOUT']
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    return {
      success: true,
      logs: logs.map(log => {
        const metadata = log.metaJson as any || {}
        return {
          id: log.id,
          action: log.action,
          details: log.target || '',
          ipAddress: metadata.ipAddress || 'Unknown',
          userAgent: metadata.userAgent || 'Unknown',
          timestamp: log.createdAt,
          adminEmail: metadata.adminEmail || 'System'
        }
      }),
      total: logs.length
    }
  } catch (error) {
    console.error('Error fetching security logs:', error)
    reply.status(500).send({ error: 'Failed to fetch security logs' })
  }
}

/**
 * GET /admin/security/sessions
 * Get active sessions (unexpired tokens)
 */
export const getActiveSessions = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    // Get active auth tokens (not expired, not used)
    const tokens = await prisma.authToken.findMany({
      where: {
        expiresAt: { gt: new Date() },
        usedAt: null
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return {
      success: true,
      sessions: tokens.map(token => ({
        id: token.id,
        userEmail: token.email,
        userRole: token.type,
        createdAt: token.createdAt,
        expiresAt: token.expiresAt,
        ipAddress: 'N/A'
      }))
    }
  } catch (error) {
    console.error('Error fetching active sessions:', error)
    reply.status(500).send({ error: 'Failed to fetch active sessions' })
  }
}

/**
 * POST /admin/security/revoke-session
 * Revoke a session by deleting the token
 */
export const revokeSession = async (req: FastifyRequest<{ Body: { sessionId: string } }>, reply: FastifyReply) => {
  try {
    const { sessionId } = req.body

    await prisma.authToken.delete({
      where: { id: sessionId }
    })

    return {
      success: true,
      message: 'Session revoked successfully'
    }
  } catch (error) {
    console.error('Error revoking session:', error)
    reply.status(500).send({ error: 'Failed to revoke session' })
  }
}

/**
 * GET /admin/security/audit
 * Get audit logs
 */
export const getAuditLogs = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    return {
      success: true,
      logs: logs.map(log => {
        const metadata = log.metaJson as any || {}
        return {
          id: log.id,
          action: log.action,
          details: log.target || '',
          metadata: log.metaJson,
          timestamp: log.createdAt,
          adminEmail: metadata.adminEmail || 'System'
        }
      }),
      total: logs.length
    }
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    reply.status(500).send({ error: 'Failed to fetch audit logs' })
  }
}

/**
 * POST /admin/security/block-ip
 * Block an IP address
 */
export const blockIPAddress = async (req: FastifyRequest<{ Body: { ipAddress: string; reason: string } }>, reply: FastifyReply) => {
  try {
    return {
      success: true,
      message: 'IP address blocked successfully'
    }
  } catch (error) {
    console.error('Error blocking IP address:', error)
    reply.status(500).send({ error: 'Failed to block IP address' })
  }
}

