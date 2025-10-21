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
    const { familyId, childId: jwtChildId } = req.claims!
    const { rewardId, childId } = req.body

    // Use childId from JWT if available (child accessing their own rewards)
    const actualChildId = childId || jwtChildId

    if (!actualChildId) {
      return reply.status(400).send({ error: 'Child ID is required' })
    }

    // Verify reward belongs to family
    const reward = await prisma.reward.findFirst({
      where: { id: rewardId, familyId }
    })

    if (!reward) {
      return reply.status(404).send({ error: 'Reward not found' })
    }

    // Verify child belongs to family
    const child = await prisma.child.findFirst({
      where: { id: actualChildId, familyId }
    })

    if (!child) {
      return reply.status(404).send({ error: 'Child not found' })
    }

    // Get child's wallet
    const wallet = await prisma.wallet.findFirst({
      where: { childId: actualChildId, familyId }
    })

    if (!wallet) {
      return reply.status(404).send({ error: 'Wallet not found' })
    }

    // Calculate stars (10 pence = 1 star)
    const currentStars = Math.floor(wallet.balancePence / 10)

    // Check if child has enough stars
    if (currentStars < reward.starsRequired) {
      return reply.status(400).send({ 
        error: 'Not enough stars',
        required: reward.starsRequired,
        current: currentStars
      })
    }

    // Calculate pence to deduct (stars * 10)
    const penceToDeduct = reward.starsRequired * 10

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Deduct from wallet
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balancePence: { decrement: penceToDeduct }
        }
      })

      // Create transaction record
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          familyId,
          type: 'debit',
          amountPence: penceToDeduct,
          source: 'system',
          metaJson: { 
            rewardId,
            rewardTitle: reward.title,
            starsSpent: reward.starsRequired
          }
        }
      })

      // Create redemption
      const redemption = await tx.redemption.create({
        data: {
          rewardId,
          familyId,
          childId: actualChildId,
          status: 'pending'
        },
        include: {
          reward: true,
          child: {
            select: {
              id: true,
              nickname: true,
              ageGroup: true
            }
          }
        }
      })

      return { redemption, wallet: updatedWallet }
    })

    return result
  } catch (error) {
    console.error('Failed to redeem reward:', error)
    reply.status(500).send({ error: 'Failed to create redemption' })
  }
}

export const listRedemptions = async (req: FastifyRequest<{ Querystring: { status?: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { status } = req.query

    const whereClause: any = { familyId }
    if (status) {
      whereClause.status = status
    }

    const redemptions = await prisma.redemption.findMany({
      where: whereClause,
      include: {
        reward: true,
        child: {
          select: {
            id: true,
            nickname: true,
            ageGroup: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return { redemptions }
  } catch (error) {
    console.error('Failed to list redemptions:', error)
    reply.status(500).send({ error: 'Failed to list redemptions' })
  }
}

export const fulfillRedemption = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { id } = req.params

    // Find redemption
    const redemption = await prisma.redemption.findFirst({
      where: { id, familyId }
    })

    if (!redemption) {
      return reply.status(404).send({ error: 'Redemption not found' })
    }

    if (redemption.status !== 'pending') {
      return reply.status(400).send({ error: 'Redemption has already been processed' })
    }

    // Update redemption status
    const updatedRedemption = await prisma.redemption.update({
      where: { id },
      data: { 
        status: 'fulfilled'
      },
      include: {
        reward: true,
        child: {
          select: {
            id: true,
            nickname: true,
            ageGroup: true
          }
        }
      }
    })

    return { redemption: updatedRedemption }
  } catch (error) {
    console.error('Failed to fulfill redemption:', error)
    reply.status(500).send({ error: 'Failed to fulfill redemption' })
  }
}
