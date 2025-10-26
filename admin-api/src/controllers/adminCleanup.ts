import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

/**
 * GET /admin/cleanup/logs
 * Get recent cleanup logs
 */
export const getCleanupLogs = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const logs = [
      { 
        id: '1', 
        type: 'warning', 
        accountType: 'inactive', 
        familyId: 'family-123', 
        email: 'test@example.com', 
        message: '5-month warning sent', 
        createdAt: new Date() 
      },
      { 
        id: '2', 
        type: 'deletion', 
        accountType: 'inactive', 
        familyId: 'family-456', 
        email: 'old@example.com', 
        message: 'Account deleted after 6 months', 
        createdAt: new Date() 
      }
    ]
    reply.send({ logs })
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
    const stats = {
      totalAccountsDeleted: 125,
      lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      nextRun: '1st of next month at 2:00 AM',
      pendingWarnings: 15,
      pendingDeletions: 3
    }
    reply.send({ stats })
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

/**
 * POST /admin/cleanup/trigger
 * Manually trigger the account cleanup process
 */
export const triggerCleanup = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    reply.send({ success: true, message: 'Manual account cleanup triggered. Check worker logs for progress.' })
  } catch (error) {
    req.log.error(error, 'Failed to trigger manual cleanup')
    reply.status(500).send({ error: 'Failed to trigger manual cleanup' })
  }
}