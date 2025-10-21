import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'
import { updateStreak, getChildStreakStats, calculateStreakBonusStars } from '../utils/streaks.js'

interface CompletionCreateBody {
  assignmentId: string
  proofUrl?: string
  note?: string
}

export const create = async (req: FastifyRequest<{ Body: CompletionCreateBody }>, reply: FastifyReply) => {
  try {
    const { familyId, childId, sub } = req.claims!
    const { assignmentId, proofUrl, note } = req.body

    // Get childId from JWT claims (child_player role) or from sub if not present
    const actualChildId = childId || sub

    if (!actualChildId) {
      return reply.status(400).send({ error: 'Child ID not found in authentication' })
    }

    // Verify assignment belongs to family
    const assignment = await prisma.assignment.findFirst({
      where: { id: assignmentId, familyId },
      include: { chore: true }
    })

    if (!assignment) {
      return reply.status(404).send({ error: 'Assignment not found' })
    }

    // Verify child belongs to family
    const child = await prisma.child.findFirst({
      where: { id: actualChildId, familyId }
    })

    if (!child) {
      return reply.status(404).send({ error: 'Child not found' })
    }

    // CHALLENGE MODE: If bidding is enabled, only the current champion can complete it
    let bidAmountPence: number | null = null
    
    if (assignment.biddingEnabled) {
      const bids = await prisma.bid.findMany({
        where: { 
          assignmentId,
          familyId 
        },
        orderBy: { amountPence: 'asc' } // Lowest bid first
      })

      if (bids.length > 0) {
        const currentChampion = bids[0]
        if (currentChampion.childId !== actualChildId) {
          return reply.status(403).send({ 
            error: 'Challenge locked! Only the current champion can complete this chore. Beat their offer first!' 
          })
        }
        // Save the bid amount for the completion record
        bidAmountPence = currentChampion.amountPence
      } else {
        // No one has claimed it yet
        return reply.status(403).send({ 
          error: 'No one has claimed this challenge yet! Go to Showdown and claim it first!' 
        })
      }
    }

    // Verify assignment is assigned to this child (if it has a specific child assigned)
    if (assignment.childId && assignment.childId !== actualChildId) {
      return reply.status(403).send({ error: 'This chore is not assigned to you' })
    }

    const completion = await prisma.completion.create({
      data: {
        assignmentId,
        familyId,
        childId: actualChildId,
        proofUrl: proofUrl || null,
        note: note || null,
        bidAmountPence: bidAmountPence
      }
    })

    return { completion }
  } catch (error) {
    console.error('Error creating completion:', error)
    reply.status(500).send({ error: 'Failed to create completion' })
  }
}

export const approve = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { id } = req.params

    // Find and update completion
    const completion = await prisma.completion.findFirst({
      where: { id, familyId },
      include: {
        assignment: {
          include: { chore: true }
        }
      }
    })

    if (!completion) {
      return reply.status(404).send({ error: 'Completion not found' })
    }

    if (completion.status !== 'pending') {
      return reply.status(400).send({ error: 'Completion has already been processed' })
    }

    // Update completion status
    await prisma.completion.update({
      where: { id },
      data: { status: 'approved' }
    })

    // Check if this is a bidding chore and if child won the rivalry
    let rewardAmount = completion.assignment.chore.baseRewardPence
    let rivalryBonus = false
    
    if (completion.assignment.biddingEnabled) {
      // Get all bids for this assignment
      const bids = await prisma.bid.findMany({
        where: { 
          assignmentId: completion.assignmentId,
          familyId 
        },
        orderBy: { amountPence: 'asc' },
        include: { child: true }
      })
      
      // Check if the completing child had the lowest bid
      const lowestBid = bids[0]
      if (lowestBid && lowestBid.childId === completion.childId) {
        // DOUBLE STARS for rivalry winner! 🏆
        // They get the BID AMOUNT in money, but it counts as DOUBLE STARS
        rewardAmount = completion.bidAmountPence || lowestBid.amountPence
        rivalryBonus = true
        
        // Create a rivalry victory event
        await prisma.rivalryEvent.create({
          data: {
            familyId,
            actorChildId: completion.childId,
            targetChildId: null, // Beat all siblings
            type: 'victory',
            amountPence: rewardAmount,
            metaJson: { 
              completionId: id,
              originalReward: completion.assignment.chore.baseRewardPence,
              doubledReward: rewardAmount,
              bidAmount: lowestBid.amountPence
            }
          }
        })
      }
    }

    // Credit wallet
    const wallet = await prisma.wallet.upsert({
      where: {
        childId_familyId: {
          childId: completion.childId,
          familyId
        }
      },
      update: {
        balancePence: { increment: rewardAmount }
      },
      create: {
        familyId,
        childId: completion.childId,
        balancePence: rewardAmount
      }
    })

    // Create transaction record
    await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        familyId,
        type: 'credit',
        amountPence: rewardAmount,
        source: 'system',
        metaJson: { 
          completionId: id,
          rivalryBonus: rivalryBonus,
          baseReward: completion.assignment.chore.baseRewardPence
        }
      }
    })

    // Update streak for this chore
    await updateStreak(
      familyId,
      completion.childId,
      completion.assignment.choreId,
      completion.timestamp
    )

    // Get updated streak stats
    const streakStats = await getChildStreakStats(familyId, completion.childId)
    
    // Check if they hit a streak milestone and award bonus
    const bonusStars = calculateStreakBonusStars(streakStats.currentStreak)
    let bonusWallet = wallet
    
    if (bonusStars > 0) {
      // Award bonus stars (convert to pence: 1 star = 10 pence)
      const bonusPence = bonusStars * 10
      
      bonusWallet = await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balancePence: { increment: bonusPence }
        }
      })

      // Create bonus transaction
      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          familyId,
          type: 'credit',
          amountPence: bonusPence,
          source: 'system',
          metaJson: { 
            type: 'streak_bonus',
            streakLength: streakStats.currentStreak,
            bonusStars
          }
        }
      })
    }

    return { 
      ok: true, 
      wallet: bonusWallet,
      rivalryBonus: rivalryBonus ? {
        originalReward: completion.assignment.chore.baseRewardPence,
        doubledReward: rewardAmount,
        message: '🏆 RIVALRY WINNER! DOUBLE STARS!'
      } : undefined,
      streakBonus: bonusStars > 0 ? {
        stars: bonusStars,
        streakLength: streakStats.currentStreak
      } : undefined
    }
  } catch (error) {
    console.error('Error approving completion:', error)
    reply.status(500).send({ error: 'Failed to approve completion' })
  }
}

export const reject = async (req: FastifyRequest<{ Params: { id: string }, Body: { reason?: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { id } = req.params
    const { reason } = req.body

    // Find completion
    const completion = await prisma.completion.findFirst({
      where: { id, familyId }
    })

    if (!completion) {
      return reply.status(404).send({ error: 'Completion not found' })
    }

    if (completion.status !== 'pending') {
      return reply.status(400).send({ error: 'Completion has already been processed' })
    }

    // Update completion status
    await prisma.completion.update({
      where: { id },
      data: { 
        status: 'rejected',
        note: reason ? `Rejected: ${reason}` : completion.note
      }
    })

    return { ok: true }
  } catch (error) {
    console.error('Error rejecting completion:', error)
    reply.status(500).send({ error: 'Failed to reject completion' })
  }
}

export const list = async (req: FastifyRequest<{ Querystring: { status?: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { status } = req.query

    const whereClause: any = { familyId }
    if (status) {
      whereClause.status = status
    }

    const completions = await prisma.completion.findMany({
      where: whereClause,
      include: {
        assignment: {
          include: {
            chore: true
          }
        },
        child: {
          select: {
            id: true,
            nickname: true,
            ageGroup: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 50 // Limit to recent 50
    })

    return { completions }
  } catch (error) {
    console.error('Error listing completions:', error)
    reply.status(500).send({ error: 'Failed to list completions' })
  }
}
