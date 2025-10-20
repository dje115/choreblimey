import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

export const weekly = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!

    // Get completed chores this week with rewards
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const weeklyStats = await prisma.completion.findMany({
      where: {
        familyId,
        status: 'approved',
        timestamp: { gte: weekStart }
      },
      include: {
        child: true,
        assignment: {
          include: { chore: true }
        }
      }
    })

    // Aggregate by child
    const childStats = weeklyStats.reduce((acc, completion) => {
      const childId = completion.childId
      if (!acc[childId]) {
        acc[childId] = {
          childId,
          child: completion.child,
          completedChores: 0,
          totalRewardPence: 0
        }
      }
      acc[childId].completedChores++
      acc[childId].totalRewardPence += completion.assignment.chore.baseRewardPence
      return acc
    }, {} as Record<string, any>)

    // Convert to array and sort by reward amount
    const leaderboard = Object.values(childStats)
      .sort((a: any, b: any) => b.totalRewardPence - a.totalRewardPence)

    return { leaderboard }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to get leaderboard' })
  }
}
