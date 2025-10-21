import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

interface BidCompeteBody {
  assignmentId: string
  childId: string
  amountPence: number
  targetChildId?: string
}

export const list = async (req: FastifyRequest<{ Querystring: { assignmentId: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { assignmentId } = req.query

    if (!assignmentId) {
      return reply.status(400).send({ error: 'assignmentId is required' })
    }

    const bids = await prisma.bid.findMany({
      where: { 
        assignmentId,
        familyId 
      },
      include: {
        child: {
          select: {
            id: true,
            nickname: true,
            ageGroup: true
          }
        }
      },
      orderBy: { amountPence: 'asc' } // Lowest bid first
    })

    return { bids }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to list bids' })
  }
}

export const compete = async (req: FastifyRequest<{ Body: BidCompeteBody }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { assignmentId, childId, amountPence, targetChildId } = req.body

    // Verify assignment exists and bidding is enabled
    const assignment = await prisma.assignment.findFirst({
      where: { id: assignmentId, familyId, biddingEnabled: true },
      include: { chore: true }
    })

    if (!assignment) {
      return reply.status(404).send({ error: 'Assignment not found or bidding not enabled' })
    }

    // Verify child belongs to family
    const child = await prisma.child.findFirst({
      where: { id: childId, familyId }
    })

    if (!child) {
      return reply.status(404).send({ error: 'Child not found' })
    }

    // Clamp bid amount within allowed range
    const minBid = assignment.chore.minBidPence ?? Math.floor(assignment.chore.baseRewardPence * 0.5)
    const maxBid = assignment.chore.maxBidPence ?? Math.floor(assignment.chore.baseRewardPence * 1.5)
    const clampedAmount = Math.max(minBid, Math.min(maxBid, amountPence))

    // Create the bid
    const bid = await prisma.bid.create({
      data: {
        assignmentId,
        familyId,
        childId,
        amountPence: clampedAmount,
        disruptTargetChildId: targetChildId || null
      }
    })

    // Create rivalry event
    await prisma.rivalryEvent.create({
      data: {
        familyId,
        actorChildId: childId,
        targetChildId: targetChildId || null,
        type: 'underbid',
        amountPence: clampedAmount
      }
    })

    return { ok: true, bid }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to create bid' })
  }
}
