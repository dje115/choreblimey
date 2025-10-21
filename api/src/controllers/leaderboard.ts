import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'
import { cache, cacheKeys, cacheTTL } from '../utils/cache.js'

export const weekly = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!

    // Try to get from cache
    const cached = await cache.get(cacheKeys.leaderboard(familyId))
    if (cached) {
      return cached
    }

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
          totalRewardPence: 0,
          totalStars: 0
        }
      }
      acc[childId].completedChores++
      const rewardPence = completion.assignment.chore.baseRewardPence
      acc[childId].totalRewardPence += rewardPence
      // Convert pence to stars: 1 star = 10 pence (£0.10)
      acc[childId].totalStars += Math.floor(rewardPence / 10)
      return acc
    }, {} as Record<string, any>)

    // Convert to array and sort by stars (primary) then by reward amount (tiebreaker)
    const leaderboard = Object.values(childStats)
      .sort((a: any, b: any) => {
        if (b.totalStars !== a.totalStars) {
          return b.totalStars - a.totalStars
        }
        return b.totalRewardPence - a.totalRewardPence
      })
      .map((stat: any, index: number) => ({
        ...stat,
        rank: index + 1
      }))

    const result = { leaderboard, weekStart }

    // Cache the result for 5 minutes
    await cache.set(cacheKeys.leaderboard(familyId), result, cacheTTL.leaderboard)

    return result
  } catch (error) {
    reply.status(500).send({ error: 'Failed to get leaderboard' })
  }
}
