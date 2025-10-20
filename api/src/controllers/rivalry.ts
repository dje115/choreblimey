import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

export const feed = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!

    const rivalryEvents = await prisma.rivalryEvent.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        family: {
          include: {
            children: true
          }
        }
      }
    })

    // Transform events for feed display
    const feed = rivalryEvents.map(event => ({
      id: event.id,
      type: event.type,
      actorChildId: event.actorChildId,
      targetChildId: event.targetChildId,
      amountPence: event.amountPence,
      createdAt: event.createdAt,
      metaJson: event.metaJson
    }))

    return { feed }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to get rivalry feed' })
  }
}
