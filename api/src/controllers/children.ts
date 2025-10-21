import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'
import { generateJoinCode } from '../utils/crypto.js'

interface CreateChildBody {
  nickname: string
  realNameCipher?: string
  dobCipher?: string
  ageGroup?: string
}

export const create = async (req: FastifyRequest<{ Body: CreateChildBody }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { nickname, realNameCipher, dobCipher, ageGroup } = req.body

    if (!nickname) {
      return reply.status(400).send({ error: 'Nickname is required' })
    }

    // Create child
    const child = await prisma.child.create({
      data: {
        familyId,
        nickname,
        realNameCipher: realNameCipher || null,
        dobCipher: dobCipher || null,
        ageGroup: ageGroup || null
      }
    })

    // Generate join code for the child
    const joinCode = generateJoinCode()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    await prisma.childJoinCode.create({
      data: {
        familyId,
        code: joinCode,
        expiresAt
      }
    })

    return {
      child: {
        id: child.id,
        nickname: child.nickname,
        ageGroup: child.ageGroup
      },
      joinCode
    }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to create child' })
  }
}
