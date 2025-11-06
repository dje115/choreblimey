import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

interface AssignmentCreateBody {
  choreId: string
  childId?: string
  biddingEnabled?: boolean
}

interface AssignmentLinkBody {
  assignmentId1: string
  assignmentId2: string
}

export const list = async (req: FastifyRequest<{ Querystring: { childId?: string } }>, reply: FastifyReply) => {
  try {
    const { familyId, childId: jwtChildId, role } = req.claims!
    const { childId: queryChildId } = req.query

    // Determine which childId to use
    let childId = queryChildId
    if (role === 'child_player' && !childId) {
      childId = jwtChildId // Child accessing their own assignments
    }

    const whereClause: any = { familyId }
    if (childId) {
      whereClause.childId = childId
    }

    const assignments = await prisma.assignment.findMany({
      where: whereClause,
      include: {
        chore: {
          select: {
            id: true,
            title: true,
            description: true,
            frequency: true,
            proof: true,
            baseRewardPence: true,
            starsOverride: true,
            minBidPence: true,
            maxBidPence: true,
            active: true
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
      orderBy: { createdAt: 'desc' }
    })

    return { assignments }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to list assignments' })
  }
}

export const create = async (req: FastifyRequest<{ Body: AssignmentCreateBody }>, reply: FastifyReply) => {
  try {
    const { familyId, sub: userId } = req.claims!
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
        biddingEnabled,
        createdBy: userId
      },
      include: {
        chore: true,
        child: true
      }
    })

    // Emit WebSocket event to notify all family members
    const { io } = await import('../server.js')
    if (io) {
      const { emitToFamily } = await import('../websocket/socket.js')
      emitToFamily(io, familyId, 'assignment:created', {
        assignment: {
          id: assignment.id,
          choreId: assignment.choreId,
          childId: assignment.childId,
          biddingEnabled: assignment.biddingEnabled,
          chore: {
            id: assignment.chore.id,
            title: assignment.chore.title,
            baseRewardPence: assignment.chore.baseRewardPence
          }
        }
      })
    }

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

export const remove = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { id } = req.params

    // Verify assignment belongs to family
    const assignment = await prisma.assignment.findFirst({
      where: { id, familyId }
    })

    if (!assignment) {
      return reply.status(404).send({ error: 'Assignment not found' })
    }

    // Delete the assignment
    await prisma.assignment.delete({
      where: { id }
    })

    // Emit WebSocket event to notify all family members
    const { io } = await import('../server.js')
    if (io) {
      const { emitToFamily } = await import('../websocket/socket.js')
      emitToFamily(io, familyId, 'assignment:deleted', {
        assignmentId: id
      })
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to delete assignment:', error)
    reply.status(500).send({ error: 'Failed to delete assignment' })
  }
}
