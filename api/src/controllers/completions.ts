import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

interface CompletionCreateBody {
  assignmentId: string
  childId: string
  proofUrl?: string
  note?: string
}

export const create = async (req: FastifyRequest<{ Body: CompletionCreateBody }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { assignmentId, childId, proofUrl, note } = req.body

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
      where: { id: childId, familyId }
    })

    if (!child) {
      return reply.status(404).send({ error: 'Child not found' })
    }

    const completion = await prisma.completion.create({
      data: {
        assignmentId,
        familyId,
        childId,
        proofUrl: proofUrl || null,
        note: note || null
      }
    })

    return { completion }
  } catch (error) {
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
    reply.status(500).send({ error: 'Failed to approve completion' })
  }
}
