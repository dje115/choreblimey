import type { FastifyRequest, FastifyReply } from 'fastify'

export const create = async (req: FastifyRequest, reply: FastifyReply) => {
  // TODO: Implement child creation
  reply.status(501).send({ error: 'Not implemented yet' })
}
