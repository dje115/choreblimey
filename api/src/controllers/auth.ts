import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'
import jwt from 'jsonwebtoken'
import { generateToken, generateJoinCode } from '../utils/crypto.js'
import { emitFamilyJoinCodesUpdated } from '../events/familyJoinCodes.js'
import { sendMagicLink } from '../utils/email.js'
import { cache } from '../utils/cache.js'

interface SignupParentBody {
  email: string
}

interface CallbackBody {
  token: string
}

interface ChildJoinBody {
  code?: string
  qrData?: string
  nickname?: string // Optional - will use intendedNickname from join code if not provided
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
    } else {
      // Update last login time
      user = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
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
    const { code, qrData, nickname } = req.body

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

    // Use intendedNickname from join code if nickname not provided in request
    // This prevents duplicate names being created
    const finalNickname = nickname?.trim() || joinCodeRecord.intendedNickname

    if (!finalNickname) {
      return reply.status(400).send({ error: 'Join code does not have an associated nickname. Please contact your parent.' })
    }

    // Check if join code has been used by a different child
    if (joinCodeRecord.usedAt && joinCodeRecord.usedByChildId) {
      // Check if the existing child matches the nickname being used
      const existingChild = await prisma.child.findUnique({
        where: { id: joinCodeRecord.usedByChildId }
      })
      
      if (existingChild && existingChild.nickname !== finalNickname) {
        return reply.status(400).send({ error: 'Join code has already been used by a different child' })
      }
    }

    familyId = joinCodeRecord.familyId

    // Check if a child with this nickname already exists in the family
    let child = await prisma.child.findFirst({
      where: {
        familyId,
        nickname: finalNickname
      }
    })

    if (child) {
      // Child already exists - re-authenticate them
      console.log('Re-authenticating existing child:', child.id, 'nickname:', child.nickname)
    } else {
      // Retrieve cached child info (if available)
      let childInfo: any = { ageGroup: '5-8', birthYear: null, birthMonth: null }
      try {
        const cachedInfo = await cache.get(`child_info:${joinCode}`)
        if (cachedInfo) {
          childInfo = JSON.parse(cachedInfo)
          console.log('Retrieved cached child info:', childInfo)
        }
      } catch (error) {
        console.log('No cached child info found, using defaults')
      }

      // Create new child with birth year/month from cached info
      console.log('Creating new child for nickname:', finalNickname)
      child = await prisma.child.create({
        data: {
          familyId,
          nickname: finalNickname,
          ageGroup: childInfo.ageGroup || '5-8',
          birthYear: childInfo.birthYear || null,
          birthMonth: childInfo.birthMonth || null,
          gender: null // Parent will set this in parent portal
        }
      })
      
      // Clean up cached info after use
      await cache.del(`child_info:${joinCode}`)
    }

    // Ensure no other join codes point to this child (avoid unique constraint issues)
    await prisma.childJoinCode.updateMany({
      where: {
        usedByChildId: child.id,
        id: { not: joinCodeRecord.id }
      },
      data: {
        usedByChildId: null,
        usedAt: null
      }
    })

    // Mark join code as used (only if not already used)
    if (!joinCodeRecord.usedAt) {
      await prisma.childJoinCode.update({
        where: { id: joinCodeRecord.id },
        data: {
          usedAt: new Date(),
          usedByChildId: child.id
        }
      })
    }

    // Invalidate family cache so parent dashboard shows new child immediately
    await cache.invalidateFamily(familyId)

    // Notify family dashboards that join codes changed (child redeemed code)
    await emitFamilyJoinCodesUpdated(familyId, {
      action: 'consumed',
      code: joinCodeRecord.code,
      childId: child.id,
      nickname: child.nickname,
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
    console.error('Failed to join family:', error)
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
        intendedNickname: nickname,
        expiresAt
      }
    })

    await emitFamilyJoinCodesUpdated(familyId, {
      action: 'created',
      code: joinCode.code,
      nickname,
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

/**
 * Delete user account and all associated data
 * @route DELETE /auth/account
 * @description Deletes the authenticated user's account and all associated data
 * @param {FastifyRequest} req - Request with authenticated user
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ message }>} Success message
 * @throws {401} Unauthorized - Not authenticated
 * @throws {403} Forbidden - User is the only admin of a family
 * @throws {500} Internal Server Error - Failed to delete account
 */
export const deleteAccount = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { sub: userId, familyId } = req.claims!

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    // Get user with all memberships
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        members: {
          include: {
            family: {
              include: {
                members: true
              }
            }
          }
        }
      }
    })

    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    // Check if user is the only admin of any family
    for (const membership of user.members) {
      const adminMembers = membership.family.members.filter(m => m.role === 'parent_admin')
      if (adminMembers.length === 1 && adminMembers[0].userId === userId) {
        return reply.status(403).send({ 
          error: 'Cannot delete account: You are the only admin of a family. Please transfer admin rights or delete the family first.' 
        })
      }
    }

    // Delete user's memberships (this will cascade delete related data)
    await prisma.familyMember.deleteMany({
      where: { userId }
    })

    // Delete user's auth tokens
    await prisma.authToken.deleteMany({
      where: { email: user.email }
    })

    // Delete the user
    await prisma.user.delete({
      where: { id: userId }
    })

    // Invalidate caches for all families the user was a member of
    for (const membership of user.members) {
      await cache.invalidateFamily(membership.familyId)
    }

    return { message: 'Account deleted successfully' }
  } catch (error: any) {
    console.error('Failed to delete account:', error)
    reply.status(500).send({ error: 'Failed to delete account' })
  }
}

/**
 * Suspend user account
 * @route POST /auth/account/suspend
 * @description Suspends the authenticated user's account
 * @param {FastifyRequest} req - Request with authenticated user
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ message, suspended }>} Success message and suspension status
 * @throws {401} Unauthorized - Not authenticated
 * @throws {500} Internal Server Error - Failed to suspend account
 */
export const suspendAccount = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { sub: userId, familyId } = req.claims!

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    // Get user's family memberships
    const memberships = await prisma.familyMember.findMany({
      where: { userId },
      include: { family: true }
    })

    if (memberships.length === 0) {
      return reply.status(404).send({ error: 'User not found in any family' })
    }

    // Suspend all families the user is admin of
    const familyIds = memberships
      .filter(m => m.role === 'parent_admin')
      .map(m => m.familyId)

    if (familyIds.length > 0) {
      await prisma.family.updateMany({
        where: { id: { in: familyIds } },
        data: { suspendedAt: new Date() }
      })

      // Invalidate caches
      for (const fid of familyIds) {
        await cache.invalidateFamily(fid)
      }
    }

    return { 
      message: 'Account suspended successfully',
      suspended: true
    }
  } catch (error: any) {
    console.error('Failed to suspend account:', error)
    reply.status(500).send({ error: 'Failed to suspend account' })
  }
}

interface ChangeEmailBody {
  newEmail: string
}

/**
 * Change user email address
 * @route POST /auth/account/change-email
 * @description Initiates email change process by sending verification email to new address
 * @param {FastifyRequest<{ Body: ChangeEmailBody }>} req - Request with new email
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ message }>} Success message
 * @throws {400} Bad Request - Invalid email or email already in use
 * @throws {401} Unauthorized - Not authenticated
 * @throws {500} Internal Server Error - Failed to initiate email change
 */
export const changeEmail = async (req: FastifyRequest<{ Body: ChangeEmailBody }>, reply: FastifyReply) => {
  try {
    const { sub: userId } = req.claims!
    const { newEmail } = req.body

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    if (!newEmail || !newEmail.includes('@')) {
      return reply.status(400).send({ error: 'Valid email is required' })
    }

    // Check if email is already in use
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail }
    })

    if (existingUser && existingUser.id !== userId) {
      return reply.status(400).send({ error: 'Email address is already in use' })
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    // Generate verification token
    const token = generateToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Delete any existing email change tokens for this user
    await prisma.authToken.deleteMany({
      where: { 
        email: user.email, 
        type: 'email_change'
      }
    })

    // Create email change token
    await prisma.authToken.create({
      data: {
        email: newEmail, // Token is sent to new email
        token,
        type: 'email_change',
        expiresAt,
        metaJson: {
          oldEmail: user.email,
          userId: userId
        }
      }
    })

    // Send verification email to new address
    // TODO: Create email template for email change verification
    await sendMagicLink(newEmail, token)

    return { 
      message: 'Verification email sent to new address. Please check your email to complete the change.' 
    }
  } catch (error: any) {
    console.error('Failed to initiate email change:', error)
    reply.status(500).send({ error: 'Failed to initiate email change' })
  }
}
