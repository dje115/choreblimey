import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'
import jwt from 'jsonwebtoken'
import { generateToken } from '../utils/crypto.js'
import { sendMagicLink } from '../utils/email.js'

interface SignupParentBody {
  email: string
}

interface CallbackBody {
  token: string
}

interface ChildJoinBody {
  code?: string
  qrData?: string
  nickname: string
  ageGroup?: string
}

export const signupParent = async (req: FastifyRequest<{ Body: SignupParentBody }>, reply: FastifyReply) => {
  try {
    const { email } = req.body

    if (!email || !email.includes('@')) {
      return reply.status(400).send({ error: 'Valid email is required' })
    }

    // Generate magic link token
    const token = generateToken()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    // Delete any existing tokens for this email first
    await prisma.authToken.deleteMany({
      where: { email, type: 'magic_link' }
    })

    // Create new auth token
    await prisma.authToken.create({
      data: {
        email,
        token,
        type: 'magic_link',
        expiresAt
      }
    })

    // Send magic link email
    await sendMagicLink(email, token)

    return { message: 'Magic link sent to your email' }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to send magic link' })
  }
}

export const callback = async (req: FastifyRequest<{ Querystring: CallbackBody }>, reply: FastifyReply) => {
  try {
    const { token } = req.query

    if (!token) {
      return reply.status(400).send({ error: 'Token is required' })
    }

    // Find and validate token
    const authToken = await prisma.authToken.findUnique({
      where: { token },
      include: {
        family: {
          include: {
            members: {
              include: {
                user: true
              }
            }
          }
        }
      }
    })

    if (!authToken) {
      return reply.status(404).send({ error: 'Invalid token' })
    }

    if (authToken.expiresAt < new Date()) {
      return reply.status(400).send({ error: 'Token has expired' })
    }

    if (authToken.usedAt) {
      return reply.status(400).send({ error: 'Token has already been used' })
    }

    // Mark token as used
    await prisma.authToken.update({
      where: { id: authToken.id },
      data: { usedAt: new Date() }
    })

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: authToken.email }
    })

    if (!user) {
      user = await prisma.user.create({
        data: { email: authToken.email }
      })
    }

    // If this is a family invite, add user to family
    let familyId: string | null = null
    let role: string = 'parent_admin'

    if (authToken.familyId) {
      familyId = authToken.familyId
      // Check if user is already a member
      const existingMember = await prisma.familyMember.findFirst({
        where: { userId: user.id, familyId }
      })

      if (!existingMember) {
        await prisma.familyMember.create({
          data: {
            familyId,
            userId: user.id,
            role: 'parent_admin'
          }
        })
      }
    } else {
      // This is a new parent - we'll create family in the next step
      familyId = null
    }

    // Generate JWT
    const jwtToken = jwt.sign(
      {
        sub: user.id,
        role,
        familyId: familyId || '', // Empty string if no family yet
        email: user.email
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    return {
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email
      },
      familyId,
      needsFamily: !familyId
    }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to process callback' })
  }
}

export const childJoin = async (req: FastifyRequest<{ Body: ChildJoinBody }>, reply: FastifyReply) => {
  try {
    const { code, qrData, nickname, ageGroup } = req.body

    if (!nickname) {
      return reply.status(400).send({ error: 'Nickname is required' })
    }

    let joinCode: string | null = null
    let familyId: string | null = null

    if (qrData) {
      // Try to parse QR data
      const parsed = JSON.parse(qrData)
      if (parsed.type === 'child_join' && parsed.code) {
        joinCode = parsed.code
      } else {
        return reply.status(400).send({ error: 'Invalid QR code data' })
      }
    } else if (code) {
      joinCode = code.toUpperCase()
    } else {
      return reply.status(400).send({ error: 'Either code or qrData is required' })
    }

    // Find the join code
    const joinCodeRecord = await prisma.childJoinCode.findUnique({
      where: { code: joinCode },
      include: { family: true }
    })

    if (!joinCodeRecord) {
      return reply.status(404).send({ error: 'Invalid join code' })
    }

    if (joinCodeRecord.expiresAt < new Date()) {
      return reply.status(400).send({ error: 'Join code has expired' })
    }

    if (joinCodeRecord.usedAt) {
      return reply.status(400).send({ error: 'Join code has already been used' })
    }

    familyId = joinCodeRecord.familyId

    // Create child
    const child = await prisma.child.create({
      data: {
        familyId,
        nickname,
        ageGroup: ageGroup || null
      }
    })

    // Mark join code as used
    await prisma.childJoinCode.update({
      where: { id: joinCodeRecord.id },
      data: {
        usedAt: new Date(),
        usedByChildId: child.id
      }
    })

    // Generate JWT for child (they get child_player role)
    const jwtToken = jwt.sign(
      {
        sub: child.id,
        role: 'child_player',
        familyId,
        childId: child.id
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    return {
      token: jwtToken,
      child: {
        id: child.id,
        nickname: child.nickname,
        ageGroup: child.ageGroup
      },
      family: {
        id: joinCodeRecord.family.id,
        nameCipher: joinCodeRecord.family.nameCipher
      }
    }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to join family' })
  }
}
