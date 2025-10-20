import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

interface RedemptionBody {
  rewardId: string
  childId: string
}

export const list = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!

    const rewards = await prisma.reward.findMany({
      where: { familyId },
      orderBy: { starsRequired: 'asc' }
    })

    return { rewards }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to get rewards' })
  }
}

export const redeem = async (req: FastifyRequest<{ Body: RedemptionBody }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { rewardId, childId } = req.body

    // Verify reward belongs to family
    const reward = await prisma.reward.findFirst({
      where: { id: rewardId, familyId }
    })

    if (!reward) {
      return reply.status(404).send({ error: 'Reward not found' })
    }

    // Verify child belongs to family
    const child = await prisma.child.findFirst({
      where: { id: childId, familyId }
    })

    if (!child) {
      return reply.status(404).send({ error: 'Child not found' })
    }

    // TODO: Check if child has enough stars (would need to track stars separately)
    // For now, just create the redemption

    const redemption = await prisma.redemption.create({
      data: {
        rewardId,
        familyId,
        childId,
        status: 'pending'
      }
    })

    return { redemption }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to create redemption' })
  }
}
