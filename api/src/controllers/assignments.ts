import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.ts'

interface AssignmentCreateBody {
  choreId: string
  childId?: string
  biddingEnabled?: boolean
}

interface AssignmentLinkBody {
  assignmentId1: string
  assignmentId2: string
}

export const create = async (req: FastifyRequest<{ Body: AssignmentCreateBody }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { choreId, childId, biddingEnabled = false } = req.body

    if (!choreId) {
      return reply.status(400).send({ error: 'choreId is required' })
    }

    // Verify chore belongs to family
    const chore = await prisma.chore.findFirst({
      where: { id: choreId, familyId }
    })

    if (!chore) {
      return reply.status(404).send({ error: 'Chore not found' })
    }

    // If childId provided, verify child belongs to family
    if (childId) {
      const child = await prisma.child.findFirst({
        where: { id: childId, familyId }
      })

      if (!child) {
        return reply.status(404).send({ error: 'Child not found' })
      }
    }

    const assignment = await prisma.assignment.create({
      data: {
        choreId,
        familyId,
        childId: childId || null,
        biddingEnabled
      },
      include: {
        chore: true,
        child: true
      }
    })

    return { assignment }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to create assignment' })
  }
}

export const link = async (req: FastifyRequest<{ Body: AssignmentLinkBody }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { assignmentId1, assignmentId2 } = req.body

    // Verify both assignments belong to family
    const assignments = await prisma.assignment.findMany({
      where: {
        id: { in: [assignmentId1, assignmentId2] },
        familyId
      }
    })

    if (assignments.length !== 2) {
      return reply.status(404).send({ error: 'One or more assignments not found' })
    }

    // Update both assignments to link them
    await prisma.$transaction([
      prisma.assignment.update({
        where: { id: assignmentId1 },
        data: { linkedAssignmentId: assignmentId2 }
      }),
      prisma.assignment.update({
        where: { id: assignmentId2 },
        data: { linkedAssignmentId: assignmentId1 }
      })
    ])

    return { success: true }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to link assignments' })
  }
}
