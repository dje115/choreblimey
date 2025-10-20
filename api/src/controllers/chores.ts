import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.ts'

interface ChoreCreateBody {
  title: string
  description?: string
  frequency: 'daily' | 'weekly' | 'once'
  proof: 'none' | 'photo' | 'note'
  baseRewardPence: number
  minBidPence?: number
  maxBidPence?: number
  startDate?: string
  endDate?: string
}

interface ChoreUpdateBody {
  title?: string
  description?: string
  frequency?: 'daily' | 'weekly' | 'once'
  proof?: 'none' | 'photo' | 'note'
  baseRewardPence?: number
  minBidPence?: number
  maxBidPence?: number
  startDate?: string
  endDate?: string
  active?: boolean
}

export const list = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    
    const chores = await prisma.chore.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' }
    })

    return { chores }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to fetch chores' })
  }
}

export const create = async (req: FastifyRequest<{ Body: ChoreCreateBody }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { title, description, frequency, proof, baseRewardPence, minBidPence, maxBidPence, startDate, endDate } = req.body

    if (!title || !frequency || typeof baseRewardPence !== 'number') {
      return reply.status(400).send({ error: 'Missing required fields' })
    }

    const chore = await prisma.chore.create({
      data: {
        familyId,
        title,
        description,
        frequency,
        proof: proof || 'none',
        baseRewardPence,
        minBidPence: minBidPence || Math.floor(baseRewardPence * 0.5),
        maxBidPence: maxBidPence || Math.floor(baseRewardPence * 1.5),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null
      }
    })

    return { chore }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to create chore' })
  }
}

export const update = async (req: FastifyRequest<{ Params: { id: string }, Body: ChoreUpdateBody }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { id } = req.params
    const updateData = req.body

    // First verify the chore belongs to the family
    const existingChore = await prisma.chore.findFirst({
      where: { id, familyId }
    })

    if (!existingChore) {
      return reply.status(404).send({ error: 'Chore not found' })
    }

    // Convert date strings to Date objects if provided
    const dataToUpdate: any = { ...updateData }
    if (updateData.startDate !== undefined) {
      dataToUpdate.startDate = updateData.startDate ? new Date(updateData.startDate) : null
    }
    if (updateData.endDate !== undefined) {
      dataToUpdate.endDate = updateData.endDate ? new Date(updateData.endDate) : null
    }

    const chore = await prisma.chore.update({
      where: { id },
      data: dataToUpdate
    })

    return { chore }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to update chore' })
  }
}
