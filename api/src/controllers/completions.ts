import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'
import { updateStreak, getChildStreakStats, calculateStreakBonus } from '../utils/streaks.js'
import { cache } from '../utils/cache.js'

interface CompletionCreateBody {
  assignmentId: string
  proofUrl?: string
  note?: string
}

/**
 * Create a new completion (child submits a chore)
 * @route POST /completions
 * @description Creates a completion record when a child submits a completed chore. Handles challenge mode bidding logic.
 * @param {FastifyRequest<{ Body: CompletionCreateBody }>} req - Request containing assignment ID, optional proof URL and note
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ completion }>} Created completion object
 * @throws {400} Bad Request - Child ID not found in authentication
 * @throws {403} Forbidden - Challenge locked or chore not assigned to this child
 * @throws {404} Not Found - Assignment or child not found
 */
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
      },
      include: {
        assignment: {
          include: { chore: true }
        }
      }
    })

    // Update streak immediately when child submits (not when parent approves)
    // This ensures children don't lose streaks due to delayed parent approvals
    await updateStreak(
      familyId,
      actualChildId,
      assignment.chore.id,
      completion.timestamp
    )

    // Invalidate family cache so parent dashboard shows new pending completion immediately
    await cache.invalidateFamily(familyId)

    // Emit WebSocket event to notify all family members
    const { io } = await import('../server.js')
    if (io) {
      const { emitToFamily } = await import('../websocket/socket.js')
      emitToFamily(io, familyId, 'completion:created', {
        completion: {
          id: completion.id,
          assignmentId: completion.assignmentId,
          childId: completion.childId,
          status: completion.status,
          timestamp: completion.timestamp,
          assignment: {
            id: assignment.id,
            chore: {
              id: assignment.chore.id,
              title: assignment.chore.title,
              baseRewardPence: assignment.chore.baseRewardPence
            }
          }
        }
      })
    }

    return { completion }
  } catch (error) {
    console.error('Error creating completion:', error)
    reply.status(500).send({ error: 'Failed to create completion' })
  }
}

/**
 * Approve a completion
 * @route PATCH /completions/:id/approve
 * @description Approves a pending completion, awards rewards, and updates streaks
 * @param {FastifyRequest<{ Params: { id: string } }>} req - Request with completion ID
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ completion, wallet }>} Approved completion and updated wallet
 * @throws {400} Bad Request - Completion already processed
 * @throws {404} Not Found - Completion not found
 * @throws {500} Internal Server Error - Failed to approve completion
 */
export const approve = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId, sub: userId } = req.claims!
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
      data: { 
        status: 'approved',
        approvedBy: userId
      }
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

    // Calculate stars to award (use override if set, otherwise 1 star per £0.10, minimum 1 star)
    const starsToAward = completion.assignment.chore.starsOverride || Math.max(1, Math.floor(rewardAmount / 10))
    
    // Credit wallet (both cash and stars)
    const wallet = await prisma.wallet.upsert({
      where: {
        childId_familyId: {
          childId: completion.childId,
          familyId
        }
      },
      update: {
        balancePence: { increment: rewardAmount },
        stars: { increment: starsToAward }
      },
      create: {
        familyId,
        childId: completion.childId,
        balancePence: rewardAmount,
        stars: starsToAward
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

    // Get streak stats (streak was already updated when child submitted)
    // We recalculate here to check for milestone bonuses that should be awarded on approval
    const streakStats = await getChildStreakStats(familyId, completion.childId)
    
    // Check if they hit a streak milestone and award bonus (using family settings)
    const streakBonus = await calculateStreakBonus(
      familyId, 
      completion.childId, 
      streakStats.currentStreak
    )
    
    let bonusWallet = wallet
    let totalBonusPence = 0
    let totalBonusStars = 0
    
    if (streakBonus.shouldAward) {
      // Award bonus money and/or stars
      const updateData: any = {}
      
      if (streakBonus.bonusMoneyPence > 0) {
        updateData.balancePence = { increment: streakBonus.bonusMoneyPence }
        totalBonusPence = streakBonus.bonusMoneyPence
      }
      
      if (streakBonus.bonusStars > 0) {
        updateData.stars = { increment: streakBonus.bonusStars }
        totalBonusStars = streakBonus.bonusStars
      }

      if (Object.keys(updateData).length > 0) {
        bonusWallet = await prisma.wallet.update({
          where: { id: wallet.id },
          data: updateData
        })
      }

      // Create bonus transaction(s) - record both money and stars separately
      if (totalBonusPence > 0 || totalBonusStars > 0) {
        // Record money bonus if any
        if (totalBonusPence > 0) {
          await prisma.transaction.create({
            data: {
              walletId: wallet.id,
              familyId,
              type: 'credit',
              amountPence: totalBonusPence,
              source: 'system',
              metaJson: { 
                type: 'streak_bonus',
                streakLength: streakStats.currentStreak,
                bonusMoneyPence: streakBonus.bonusMoneyPence,
                bonusStars: streakBonus.bonusStars
              }
            }
          })
        }
      }
    }

    // Invalidate caches (wallet, leaderboard)
    await cache.invalidateWallet(completion.childId)
    await cache.invalidateLeaderboard(familyId)

    // Emit WebSocket event to notify all family members of approval
    const { io } = await import('../server.js')
    if (io) {
      const { emitToFamily } = await import('../websocket/socket.js')
      emitToFamily(io, familyId, 'completion:approved', {
        completion: {
          id: completion.id,
          childId: completion.childId,
          status: 'approved',
          assignment: {
            id: completion.assignment.id,
            chore: {
              id: completion.assignment.chore.id,
              title: completion.assignment.chore.title,
              baseRewardPence: completion.assignment.chore.baseRewardPence
            }
          }
        },
        wallet: {
          balancePence: bonusWallet.balancePence,
          stars: bonusWallet.stars
        },
        rivalryBonus: rivalryBonus ? {
          originalReward: completion.assignment.chore.baseRewardPence,
          doubledReward: rewardAmount
        } : undefined,
        streakBonus: streakBonus.shouldAward ? {
          moneyPence: streakBonus.bonusMoneyPence,
          stars: streakBonus.bonusStars,
          streakLength: streakStats.currentStreak
        } : undefined
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
      streakBonus: streakBonus.shouldAward ? {
        moneyPence: streakBonus.bonusMoneyPence,
        stars: streakBonus.bonusStars,
        streakLength: streakStats.currentStreak
      } : undefined
    }
  } catch (error) {
    console.error('Error approving completion:', error)
    reply.status(500).send({ error: 'Failed to approve completion' })
  }
}

/**
 * Reject a completion
 * @route PATCH /completions/:id/reject
 * @description Rejects a pending completion with an optional reason
 * @param {FastifyRequest<{ Params: { id: string }, Body: { reason?: string } }>} req - Request with completion ID and optional rejection reason
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ completion }>} Rejected completion object
 * @throws {400} Bad Request - Completion already processed
 * @throws {404} Not Found - Completion not found
 * @throws {500} Internal Server Error - Failed to reject completion
 */
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

    // Get completion with assignment details before updating
    const completionWithDetails = await prisma.completion.findFirst({
      where: { id, familyId },
      include: {
        assignment: {
          include: { chore: true }
        }
      }
    })

    // Update completion status
    await prisma.completion.update({
      where: { id },
      data: { 
        status: 'rejected',
        note: reason ? `Rejected: ${reason}` : completion.note
      }
    })

    // Invalidate family cache so dashboard updates immediately
    await cache.invalidateFamily(familyId)

    // Emit WebSocket event to notify all family members
    if (completionWithDetails) {
      const { io } = await import('../server.js')
      if (io) {
        const { emitToFamily } = await import('../websocket/socket.js')
        emitToFamily(io, familyId, 'completion:rejected', {
          completion: {
            id: completionWithDetails.id,
            childId: completionWithDetails.childId,
            status: 'rejected',
            assignment: {
              id: completionWithDetails.assignment.id,
              chore: {
                id: completionWithDetails.assignment.chore.id,
                title: completionWithDetails.assignment.chore.title
              }
            }
          }
        })
      }
    }

    return { ok: true }
  } catch (error) {
    console.error('Error rejecting completion:', error)
    reply.status(500).send({ error: 'Failed to reject completion' })
  }
}

/**
 * List completions
 * @route GET /completions
 * @description Retrieves completions for the family, optionally filtered by status
 * @param {FastifyRequest<{ Querystring: { status?: string } }>} req - Request with optional status filter
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ completions }>} List of completion objects
 */
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
