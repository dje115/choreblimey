import type { FastifyRequest, FastifyReply } from 'fastify'
import { getChildStreakStats } from '../utils/streaks.js'

export const getStats = async (req: FastifyRequest<{ Params: { childId: string } }>, reply: FastifyReply) => {
  try {
    const { familyId, role, childId: jwtChildId } = req.claims!
    const { childId } = req.params

    // For child users accessing their own stats, use their JWT childId
    const actualChildId = role === 'child_player' ? (jwtChildId || childId) : childId

    if (!actualChildId) {
      return reply.status(400).send({ error: 'Child ID is required' })
    }

    const stats = await getChildStreakStats(familyId, actualChildId)

    return { stats }
  } catch (error) {
    console.error('Error getting streak stats:', error)
    reply.status(500).send({ error: 'Failed to get streak stats' })
  }
}

