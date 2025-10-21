import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

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
        note: note || null
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

    // Credit wallet
    const rewardAmount = completion.assignment.chore.baseRewardPence
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
        metaJson: { completionId: id }
      }
    })

    return { ok: true, wallet }
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
