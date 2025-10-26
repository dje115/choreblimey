import { FastifyRequest, FastifyReply } from 'fastify'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface CleanupLog {
  id: string
  type: 'warning' | 'deletion'
  accountType: 'inactive' | 'suspended'
  familyId: string
  email: string
  message: string
  createdAt: Date
}

/**
 * GET /admin/cleanup/logs
 * Get cleanup logs for admin dashboard
 */
export const getCleanupLogs = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    // For now, we'll return mock data since we don't have a cleanup logs table yet
    // In production, you'd query a cleanup_logs table
    const mockLogs: CleanupLog[] = [
      {
        id: '1',
        type: 'warning',
        accountType: 'inactive',
        familyId: 'family-123',
        email: 'parent@example.com',
        message: '5-month warning email sent',
        createdAt: new Date(Date.now() - 86400000) // 1 day ago
      },
      {
        id: '2',
        type: 'deletion',
        accountType: 'inactive',
        familyId: 'family-456',
        email: 'parent2@example.com',
        message: '6-month inactive account deleted',
        createdAt: new Date(Date.now() - 172800000) // 2 days ago
      }
    ]

    return {
      success: true,
      logs: mockLogs,
      total: mockLogs.length
    }
  } catch (error) {
    console.error('Error fetching cleanup logs:', error)
    reply.status(500).send({ error: 'Failed to fetch cleanup logs' })
  }
}

/**
 * GET /admin/cleanup/stats
 * Get cleanup statistics
 */
export const getCleanupStats = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    // Get family statistics
    const totalFamilies = await prisma.family.count()
    const inactiveFamilies = await prisma.family.count({
      where: {
        lastLoginAt: {
          lt: new Date(Date.now() - 5 * 30 * 24 * 60 * 60 * 1000) // 5 months ago
        }
      }
    })
    const suspendedFamilies = await prisma.family.count({
      where: {
        suspendedAt: {
          not: null
        }
      }
    })

    return {
      success: true,
      stats: {
        totalFamilies,
        inactiveFamilies,
        suspendedFamilies,
        lastCleanup: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        nextCleanup: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week from now
      }
    }
  } catch (error) {
    console.error('Error fetching cleanup stats:', error)
    reply.status(500).send({ error: 'Failed to fetch cleanup statistics' })
  }
}

/**
 * POST /admin/cleanup/trigger
 * Manually trigger account cleanup
 */
export const triggerCleanup = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    // In production, this would trigger the worker job
    // For now, we'll return a success message
    console.log('🧹 Manual cleanup triggered by admin')
    
    return {
      success: true,
      message: 'Account cleanup triggered successfully. Check worker logs for progress.',
      timestamp: new Date()
    }
  } catch (error) {
    console.error('Error triggering cleanup:', error)
    reply.status(500).send({ error: 'Failed to trigger cleanup' })
  }
}

/**
 * GET /admin/cleanup/status
 * Get cleanup worker status
 */
export const getCleanupStatus = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    return {
      success: true,
      status: {
        workerRunning: true,
        lastRun: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        nextRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        schedule: 'Monthly (1st of month at 2:00 AM)',
        emailWarnings: {
          inactive: '5 months (30 days before deletion)',
          suspended: '11 months (30 days before deletion)'
        },
        deletionTimeline: {
          inactive: '6 months',
          suspended: '12 months'
        }
      }
    }
  } catch (error) {
    console.error('Error fetching cleanup status:', error)
    reply.status(500).send({ error: 'Failed to fetch cleanup status' })
  }
}

