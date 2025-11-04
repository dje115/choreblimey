import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

interface RedemptionBody {
  rewardId?: string // Legacy reward ID (deprecated)
  familyGiftId?: string // New: Family gift ID
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
    const { rewardId, familyGiftId, childId } = req.body

    // Use childId from JWT if available (child accessing their own rewards)
    const actualChildId = childId || jwtChildId

    if (!actualChildId) {
      return reply.status(400).send({ error: 'Child ID is required' })
    }

    // Support both old Reward system and new FamilyGift system
    if (!rewardId && !familyGiftId) {
      return reply.status(400).send({ error: 'Either rewardId or familyGiftId is required' })
    }

    let starsRequired = 0
    let giftTitle = ''

    // New system: FamilyGift
    if (familyGiftId) {
      const familyGift = await prisma.familyGift.findFirst({
        where: { id: familyGiftId, familyId, active: true }
      })

      if (!familyGift) {
        return reply.status(404).send({ error: 'Gift not found or inactive' })
      }

      // Check if gift is available for this child
      if (!familyGift.availableForAll) {
        const childIds = familyGift.availableForChildIds as string[] | null
        if (!childIds || !childIds.includes(actualChildId)) {
          return reply.status(403).send({ error: 'This gift is not available for this child' })
        }
      }

      starsRequired = familyGift.starsRequired
      giftTitle = familyGift.title
    } 
    // Legacy system: Reward
    else if (rewardId) {
      const reward = await prisma.reward.findFirst({
        where: { id: rewardId, familyId }
      })

      if (!reward) {
        return reply.status(404).send({ error: 'Reward not found' })
      }

      starsRequired = reward.starsRequired
      giftTitle = reward.title
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

    // Check if child has enough stars (use wallet.stars field directly)
    if (wallet.stars < starsRequired) {
      return reply.status(400).send({ 
        error: 'Not enough stars',
        required: starsRequired,
        current: wallet.stars
      })
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Deduct stars from wallet
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          stars: { decrement: starsRequired }
        }
      })

      // Create transaction record (optional - for audit trail)
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          familyId,
          type: 'debit',
          amountPence: 0, // Stars-only transaction (no money deducted)
          source: 'system',
          metaJson: { 
            rewardId: rewardId || null,
            familyGiftId: familyGiftId || null,
            giftTitle: giftTitle,
            starsSpent: starsRequired
          }
        }
      })

      // Create redemption
      const redemption = await tx.redemption.create({
        data: {
          rewardId: rewardId || null, // Legacy support
          familyGiftId: familyGiftId || null, // New system
          familyId,
          childId: actualChildId,
          costPaid: starsRequired,
          status: 'pending'
        },
        include: {
          reward: rewardId ? { select: { id: true, title: true, starsRequired: true } } : false,
          familyGift: familyGiftId ? { select: { id: true, title: true, starsRequired: true } } : false,
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

export const listRedemptions = async (req: FastifyRequest<{ Querystring: { status?: string; childId?: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { status, childId } = req.query

    const whereClause: any = { familyId }
    if (status) {
      whereClause.status = status
    }
    if (childId) {
      whereClause.childId = childId
    }

    const redemptions = await prisma.redemption.findMany({
      where: whereClause,
      include: {
        reward: true,
        familyGift: {
          include: {
            createdByUser: {
              select: {
                id: true,
                email: true
              }
            }
          }
        },
        child: {
          select: {
            id: true,
            nickname: true,
            ageGroup: true
          }
        },
        approvedByUser: {
          select: {
            id: true,
            email: true
          }
        },
        rejectedByUser: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    return { redemptions }
  } catch (error) {
    console.error('Failed to list redemptions:', error)
    reply.status(500).send({ error: 'Failed to list redemptions' })
  }
}

/**
 * Approve/fulfill a redemption
 * @route POST /redemptions/:id/fulfill
 */
export const fulfillRedemption = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId, sub: userId } = req.claims!
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
        status: 'fulfilled',
        approvedBy: userId,
        processedAt: new Date()
      },
      include: {
        reward: true,
        familyGift: {
          include: {
            createdByUser: {
              select: {
                id: true,
                email: true
              }
            }
          }
        },
        child: {
          select: {
            id: true,
            nickname: true,
            ageGroup: true
          }
        },
        approvedByUser: {
          select: {
            id: true,
            email: true
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

/**
 * Reject a redemption (refund stars to child)
 * @route POST /redemptions/:id/reject
 */
export const rejectRedemption = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId, sub: userId } = req.claims!
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

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Refund stars to child's wallet
      const wallet = await tx.wallet.findFirst({
        where: { childId: redemption.childId, familyId }
      })

      if (wallet) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            stars: { increment: redemption.costPaid }
          }
        })

        // Create transaction record for refund
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            familyId,
            type: 'credit',
            amountPence: 0, // Stars-only transaction
            source: 'system',
            metaJson: {
              redemptionId: redemption.id,
              type: 'redemption_refund',
              starsRefunded: redemption.costPaid,
              reason: 'Redemption rejected'
            }
          }
        })
      }

      // Update redemption status
      const updatedRedemption = await tx.redemption.update({
        where: { id },
        data: {
          status: 'rejected',
          rejectedBy: userId,
          processedAt: new Date()
        },
        include: {
          reward: true,
          familyGift: {
            include: {
              createdByUser: {
                select: {
                  id: true,
                  email: true
                }
              }
            }
          },
          child: {
            select: {
              id: true,
              nickname: true,
              ageGroup: true
            }
          },
          rejectedByUser: {
            select: {
              id: true,
              email: true
            }
          }
        }
      })

      return updatedRedemption
    })

    return { redemption: result }
  } catch (error) {
    console.error('Failed to reject redemption:', error)
    reply.status(500).send({ error: 'Failed to reject redemption' })
  }
}
