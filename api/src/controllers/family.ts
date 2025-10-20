import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.ts'
import { generateToken, generateJoinCode } from '../utils/crypto.ts'
import { sendMagicLink } from '../utils/email.ts'

interface FamilyCreateBody {
  nameCipher: string
  region?: string
}

interface FamilyInviteBody {
  email: string
  role: 'parent_admin' | 'parent_viewer' | 'relative_contributor'
  nameCipher: string
  nickname: string
  ageGroup?: string
  sendEmail?: boolean
}

export const create = async (req: FastifyRequest<{ Body: FamilyCreateBody }>, reply: FastifyReply) => {
  try {
    const { sub: userId } = req.claims!
    const { nameCipher, region } = req.body

    if (!nameCipher) {
      return reply.status(400).send({ error: 'Family name is required' })
    }

    // Create family
    const family = await prisma.family.create({
      data: {
        nameCipher,
        region: region || null
      }
    })

    // Add user as admin member
    await prisma.familyMember.create({
      data: {
        familyId: family.id,
        userId,
        role: 'parent_admin'
      }
    })

    return { family }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to create family' })
  }
}

export const invite = async (req: FastifyRequest<{ Body: FamilyInviteBody }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { email, role, nameCipher, nickname, ageGroup, sendEmail = true } = req.body

    if (!email || !nameCipher || !nickname) {
      return reply.status(400).send({ error: 'Email, family name, and child nickname are required' })
    }

    // Verify family exists and user has permission
    const family = await prisma.family.findFirst({
      where: { id: familyId }
    })

    if (!family) {
      return reply.status(404).send({ error: 'Family not found' })
    }

    let result: any = {}

    if (role === 'child_player') {
      // Generate child join code
      const joinCode = generateJoinCode()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      const joinCodeRecord = await prisma.childJoinCode.create({
        data: {
          familyId,
          code: joinCode,
          expiresAt
        }
      })

      result.joinCode = joinCode
      result.expiresAt = expiresAt

      if (sendEmail) {
        // Send email with QR code and text code
        const { sendChildInvite } = await import('../utils/email.js')
        await sendChildInvite(email, joinCode, nameCipher)
        result.emailSent = true
      }
    } else {
      // Generate magic link for parent/relative invite
      const token = generateToken()
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

      await prisma.authToken.create({
        data: {
          email,
          token,
          type: 'magic_link',
          familyId,
          expiresAt
        }
      })

      if (sendEmail) {
        await sendMagicLink(email, token)
        result.emailSent = true
      }

      result.token = token
      result.expiresAt = expiresAt
    }

    return result
  } catch (error) {
    reply.status(500).send({ error: 'Failed to send invitation' })
  }
}
