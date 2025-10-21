import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'
import jwt from 'jsonwebtoken'
import { generateToken, generateJoinCode } from '../utils/crypto.js'
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
  gender?: string
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
    console.log('Callback received token:', token)

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
      console.log('Token not found:', token)
      return reply.status(404).send({ error: 'Invalid token' })
    }

    if (authToken.expiresAt < new Date()) {
      console.log('Token expired:', authToken.expiresAt)
      return reply.status(400).send({ error: 'Token has expired' })
    }

    if (authToken.usedAt) {
      console.log('Token already used:', authToken.usedAt)
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
      // Check if user already has a family
      const existingFamilyMember = await prisma.familyMember.findFirst({
        where: { userId: user.id }
      })
      
      console.log('Existing family member lookup:', existingFamilyMember ? 'found' : 'not found')
      
      if (existingFamilyMember) {
        familyId = existingFamilyMember.familyId
        role = existingFamilyMember.role
        console.log('Using existing family:', familyId)
      } else {
        console.log('Creating new family for user:', user.id)
        // This is a new parent - create a family automatically
        const family = await prisma.family.create({
          data: {
            nameCipher: `${user.email.split('@')[0]}'s Family`, // Temporary name
            region: null
          }
        })

        console.log('Created family:', family.id)

        // Add user as admin member of the new family
        await prisma.familyMember.create({
          data: {
            familyId: family.id,
            userId: user.id,
            role: 'parent_admin'
          }
        })

        familyId = family.id
        role = 'parent_admin'
        console.log('Set familyId to:', familyId)
      }
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

    const response = {
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        role
      },
      familyId,
      needsFamily: !familyId
    }
    
    console.log('Callback response:', { userId: user.id, email: user.email, role, familyId })
    return response
  } catch (error) {
    reply.status(500).send({ error: 'Failed to process callback' })
  }
}

export const childJoin = async (req: FastifyRequest<{ Body: ChildJoinBody }>, reply: FastifyReply) => {
  try {
    const { code, qrData, nickname, ageGroup, gender } = req.body

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
        ageGroup: ageGroup || null,
        gender: gender ? (gender as 'male' | 'female' | 'other') : null
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
    console.log('Creating child JWT with familyId:', familyId, 'childId:', child.id)
    const jwtToken = jwt.sign(
      {
        sub: child.id,
        role: 'child_player',
        familyId: familyId || '',
        childId: child.id,
        ageGroup: child.ageGroup,
        nickname: child.nickname
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

interface GenerateJoinCodeBody {
  nickname: string
  ageGroup: string
  gender?: string
}

export const generateChildJoinCode = async (req: FastifyRequest<{ Body: GenerateJoinCodeBody }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { nickname, ageGroup, gender } = req.body

    if (!nickname) {
      return reply.status(400).send({ error: 'Nickname is required' })
    }

    // Generate join code
    const code = generateJoinCode()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const joinCode = await prisma.childJoinCode.create({
      data: {
        familyId,
        code,
        expiresAt
      }
    })

    return {
      joinCode: {
        code: joinCode.code,
        expiresAt: joinCode.expiresAt
      }
    }
  } catch (error) {
    console.error('Failed to generate join code:', error)
    reply.status(500).send({ error: 'Failed to generate join code' })
  }
}
