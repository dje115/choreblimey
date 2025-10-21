import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

interface RedemptionBody {
  rewardId: string
  childId: string
}

export const list = async (req: FastifyRequest<{ Querystring: { childId?: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { childId } = req.query

    // Base query for family rewards
    let whereClause: any = { familyId }

    // If childId is provided, filter by age and gender
    if (childId) {
      const child = await prisma.child.findFirst({
        where: { id: childId, familyId }
      })

      if (child) {
        // Build age and gender filtering
        const ageGenderConditions: any[] = []

        // Age filtering
        if (child.ageGroup) {
          ageGenderConditions.push({
            OR: [
              { ageTag: null }, // No age restriction
              { ageTag: child.ageGroup }, // Exact age match
              { ageTag: 'all' } // All ages
            ]
          })
        }

        // Gender filtering
        if (child.gender) {
          ageGenderConditions.push({
            OR: [
              { genderTag: null }, // No gender restriction
              { genderTag: child.gender }, // Exact gender match
              { genderTag: 'both' }, // Both genders
              { genderTag: 'all' } // All genders
            ]
          })
        }

        // Apply age and gender filters if we have conditions
        if (ageGenderConditions.length > 0) {
          whereClause.AND = ageGenderConditions
        }
      }
    }

    const rewards = await prisma.reward.findMany({
      where: whereClause,
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
