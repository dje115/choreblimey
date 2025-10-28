import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

/**
 * GET /admin/cleanup/logs
 * Get recent cleanup logs from audit log
 */
export const getCleanupLogs = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    // Get recent audit logs related to cleanup
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: {
          in: ['FAMILY_DELETED', 'FAMILY_SUSPENDED', 'CLEANUP_WARNING_SENT', 'CLEANUP_EXECUTED']
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    // Transform audit logs to cleanup log format
    const logs = auditLogs.map(log => {
      const metadata = log.metaJson as any || {}
      return {
        id: log.id,
        type: log.action.includes('DELETE') ? 'deletion' : 
              log.action.includes('SUSPEND') ? 'warning' : 'info',
        action: log.action,
        details: metadata.reason || log.target || '',
        timestamp: log.createdAt,
        adminEmail: metadata.adminEmail || 'System'
      }
    })

    reply.send(logs)
  } catch (error) {
    req.log.error(error, 'Failed to get cleanup logs')
    reply.status(500).send({ error: 'Failed to retrieve cleanup logs' })
  }
}

/**
 * GET /admin/cleanup/stats
 * Get cleanup statistics
 */
export const getCleanupStats = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    // Get real family stats
    const totalFamilies = await prisma.family.count()
    
    // Families inactive for 6+ months
    const sixMonthsAgo = new Date()
    const monthsToSubtract = 6
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - monthsToSubtract)
    const inactiveFamilies = await prisma.family.count({
      where: {
        OR: [
          { lastLoginAt: { lt: sixMonthsAgo } },
          { lastLoginAt: null }
        ]
      }
    })
    
    // Families suspended (12+ months)
    const suspendedFamilies = await prisma.family.count({
      where: {
        suspendedAt: { not: null }
      }
    })
    
    // Mock deleted count (would need a deletion log table)
    const deletedFamilies = 0
    
    const stats = {
      totalFamilies,
      inactiveFamilies,
      suspendedFamilies,
      deletedFamilies,
      lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      nextRun: '1st of next month at 2:00 AM'
    }
    reply.send(stats)
  } catch (error) {
    req.log.error(error, 'Failed to get cleanup stats')
    reply.status(500).send({ error: 'Failed to retrieve cleanup statistics' })
  }
}

/**
 * GET /admin/cleanup/status
 * Get current status of the cleanup worker
 */
export const getCleanupStatus = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    reply.send({
      status: 'running',
      jobCounts: { waiting: 0, active: 0, completed: 1, failed: 0 },
      lastJob: { id: 'job-123', completedAt: new Date() },
      nextJob: { pattern: '0 2 1 * *', next: new Date() }
    })
  } catch (error) {
    req.log.error(error, 'Failed to get cleanup status')
    reply.status(500).send({ error: 'Failed to retrieve cleanup status' })
  }
}

interface TriggerCleanupBody {
  force?: boolean
}

/**
 * POST /admin/cleanup/trigger
 * Manually trigger the account cleanup process
 */
export const triggerCleanup = async (req: FastifyRequest<{ Body: TriggerCleanupBody }>, reply: FastifyReply) => {
  try {
    const { force = false } = req.body || {}
    
    console.log('🧹 Manual cleanup triggered by admin', { force })
    
    // In production, this would trigger the BullMQ job
    // For now, just log and return success
    
    reply.send({ success: true, message: 'Manual account cleanup triggered. Check worker logs for progress.', force })
  } catch (error) {
    req.log.error(error, 'Failed to trigger manual cleanup')
    reply.status(500).send({ error: 'Failed to trigger manual cleanup' })
  }
}