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

    // Debug logging - use process.stderr.write for guaranteed visibility
    process.stderr.write(`\n[STREAK API DEBUG] Child: ${actualChildId}\n`)
    process.stderr.write(`[STREAK API DEBUG] Current Streak: ${stats.currentStreak}\n`)
    process.stderr.write(`[STREAK API DEBUG] Best Streak: ${stats.bestStreak}\n`)
    process.stderr.write(`[STREAK API DEBUG] Total Completed Days: ${stats.totalCompletedDays}\n`)
    process.stderr.write(`[STREAK API DEBUG] Response: ${JSON.stringify(stats)}\n\n`)
    console.error(`[STREAK API] Child: ${actualChildId}, Current Streak: ${stats.currentStreak}, Best: ${stats.bestStreak}`)

    return { stats }
  } catch (error) {
    console.error('Error getting streak stats:', error)
    reply.status(500).send({ error: 'Failed to get streak stats' })
  }
}

