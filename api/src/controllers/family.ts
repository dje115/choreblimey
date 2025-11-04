import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'
import { generateToken, generateJoinCode } from '../utils/crypto.js'
import { sendMagicLink } from '../utils/email.js'
import { cache, cacheKeys, cacheTTL } from '../utils/cache.js'

interface FamilyCreateBody {
  nameCipher: string
  region?: string
}

interface FamilyInviteBody {
  email?: string
  role: 'parent_admin' | 'parent_viewer' | 'relative_contributor' | 'child_player'
  nameCipher: string
  nickname: string
  ageGroup?: string
  birthYear?: number
  birthMonth?: number
  sendEmail?: boolean
}

interface FamilyUpdateBody {
  nameCipher?: string
  region?: string
  maxBudgetPence?: number
  budgetPeriod?: 'weekly' | 'monthly'
  showLifetimeEarnings?: boolean
  giftsEnabled?: boolean
  // Streak Settings
  streakProtectionDays?: number
  bonusEnabled?: boolean
  bonusDays?: number
  bonusMoneyPence?: number
  bonusStars?: number
  bonusType?: 'money' | 'stars' | 'both'
  penaltyEnabled?: boolean
  firstMissPence?: number
  firstMissStars?: number
  secondMissPence?: number
  secondMissStars?: number
  thirdMissPence?: number
  thirdMissStars?: number
  penaltyType?: 'money' | 'stars' | 'both'
  minBalancePence?: number
  minBalanceStars?: number
  holidayMode?: boolean
  holidayStartDate?: string | null
  holidayEndDate?: string | null
}

/**
 * Create a new family
 * @route POST /family
 * @description Creates a new family and adds the authenticated user as the admin member
 * @param {FastifyRequest<{ Body: FamilyCreateBody }>} req - Request containing family name and optional region
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ family }>} Created family object
 * @throws {400} Bad Request - Family name is required
 * @throws {500} Internal Server Error - Failed to create family
 */
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

/**
 * Invite a member to the family
 * @route POST /family/invite
 * @description Invites a new member (child or adult) to the family. For children, generates a join code.
 *              For adults, sends a magic link email if email is provided.
 * @param {FastifyRequest<{ Body: FamilyInviteBody }>} req - Request containing invite details
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ joinCode?, emailSent?, token? }>} Join code for children, email status for adults
 * @throws {400} Bad Request - Family name and nickname are required
 * @throws {404} Not Found - User not found
 * @throws {500} Internal Server Error - Failed to send invite
 */
export const invite = async (req: FastifyRequest<{ Body: FamilyInviteBody }>, reply: FastifyReply) => {
  try {
    const { sub: userId, familyId } = req.claims!
    const { email, role, nameCipher, nickname, ageGroup, birthYear, birthMonth, sendEmail = true } = req.body

    if (!nameCipher || !nickname) {
      return reply.status(400).send({ error: 'Family name and child nickname are required' })
    }

    // First, let's find the user's family membership to get the correct familyId
    const familyMembership = await prisma.familyMember.findFirst({
      where: { userId },
      include: { family: true }
    })

    let actualFamilyId: string
    let family: any

    if (!familyMembership || !familyMembership.family) {
      // User doesn't have a family - create one automatically
      reply.log.info('User has no family, creating one automatically', { userId })
      
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })
      
      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }
      
      // Create family for the user
      const newFamily = await prisma.family.create({
        data: {
          nameCipher: `${user.email.split('@')[0]}'s Family`,
          region: null
        }
      })
      
      // Add user as admin member
      await prisma.familyMember.create({
        data: {
          familyId: newFamily.id,
          userId: user.id,
          role: 'parent_admin'
        }
      })
      
      reply.log.info('Created family for user', { familyId: newFamily.id, userId })
      
      actualFamilyId = newFamily.id
      family = newFamily
    } else {
      actualFamilyId = familyMembership.familyId
      family = familyMembership.family
    }

    let result: any = {}

    if (role === 'child_player') {
      // Generate child join code
      const joinCode = generateJoinCode()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      const joinCodeRecord = await prisma.childJoinCode.create({
        data: {
          familyId: actualFamilyId,
          code: joinCode,
          intendedNickname: nickname || null,
          expiresAt
        }
      })

      // Store child info in cache for 7 days (to be used when child joins)
      await cache.set(
        `child_info:${joinCode}`,
        JSON.stringify({
          nickname,
          ageGroup,
          birthYear: birthYear || null,
          birthMonth: birthMonth || null
        }),
        604800 // 7 days in seconds
      )

      result.joinCode = joinCode
      result.expiresAt = expiresAt

      if (sendEmail && email) {
        // Send email with QR code and text code
        const { sendChildInvite } = await import('../utils/email.js')
        await sendChildInvite(email, joinCode, nameCipher)
        result.emailSent = true
      }
    } else {
      // Generate magic link for parent/relative invite
      if (!email) {
        return reply.status(400).send({ error: 'Email is required for this invite type' })
      }
      const token = generateToken()
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

      await prisma.authToken.create({
        data: {
          email,
          token,
          type: 'magic_link',
          familyId: actualFamilyId,
          expiresAt
        }
      })

      if (sendEmail && email) {
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

/**
 * Get family details
 * @route GET /family
 * @description Retrieves family information including settings, holiday mode, and streak configuration
 * @param {FastifyRequest} req - Fastify request object
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ family }>} Family object with all settings
 * @throws {404} Not Found - User not part of a family
 */
export const get = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!

    if (!familyId) {
      return reply.status(404).send({ error: 'User not part of a family' })
    }

    // Try to get from cache
    const cached = await cache.get(cacheKeys.family(familyId))
    if (cached) {
      return cached
    }

    const family = await prisma.family.findUnique({
      where: { id: familyId },
      select: {
        id: true,
        nameCipher: true,
        region: true,
        maxBudgetPence: true,
        budgetPeriod: true,
        showLifetimeEarnings: true,
        giftsEnabled: true,
        holidayMode: true,
        holidayStartDate: true,
        holidayEndDate: true,
        // Streak settings
        streakProtectionDays: true,
        bonusEnabled: true,
        bonusDays: true,
        bonusMoneyPence: true,
        bonusStars: true,
        bonusType: true,
        penaltyEnabled: true,
        firstMissPence: true,
        firstMissStars: true,
        secondMissPence: true,
        secondMissStars: true,
        thirdMissPence: true,
        thirdMissStars: true,
        penaltyType: true,
        minBalancePence: true,
        minBalanceStars: true,
        members: {
          select: {
            id: true,
            role: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                email: true,
                createdAt: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        children: {
          select: {
            id: true,
            nickname: true,
            ageGroup: true,
            gender: true,
            email: true,
            birthYear: true,
            birthMonth: true,
            paused: true,
            theme: true,
            holidayMode: true,
            holidayStartDate: true,
            holidayEndDate: true,
            createdAt: true
          },
          orderBy: { createdAt: 'asc' }
        },
        _count: {
          select: {
            members: true,
            children: true,
            chores: true
          }
        }
      }
    })

    if (!family) {
      return reply.status(404).send({ error: 'Family not found' })
    }

    const result = { family }

    // Cache for 1 minute
    await cache.set(cacheKeys.family(familyId), result, cacheTTL.family)

    return result
  } catch (error) {
    console.error('Failed to get family:', error)
    reply.status(500).send({ error: 'Failed to get family information' })
  }
}

export const update = async (req: FastifyRequest<{ Body: FamilyUpdateBody }>, reply: FastifyReply) => {
  try {
    const { familyId: jwtFamilyId, sub: userId } = req.claims!
    const { 
      nameCipher, region, maxBudgetPence, budgetPeriod, showLifetimeEarnings, giftsEnabled,
      streakProtectionDays, bonusEnabled, bonusDays, bonusMoneyPence, bonusStars, bonusType,
      penaltyEnabled, firstMissPence, firstMissStars, secondMissPence, secondMissStars, thirdMissPence, thirdMissStars, penaltyType,
      minBalancePence, minBalanceStars,
      holidayMode, holidayStartDate, holidayEndDate
    } = req.body || {}

    // Try to get familyId from JWT or find it from user's membership
    let familyId = jwtFamilyId

    if (!familyId) {
      let membership = await prisma.familyMember.findFirst({
        where: { userId }
      })
      
      if (!membership) {
        // User has no family - create one automatically (recovery logic)
        const user = await prisma.user.findUnique({
          where: { id: userId }
        })
        
        if (!user) {
          return reply.status(404).send({ error: 'User not found' })
        }
        
        // Create a family for this user
        const newFamily = await prisma.family.create({
          data: {
            nameCipher: `${user.email.split('@')[0]}'s Family`,
            region: null
          }
        })
        
        // Add user as admin
        membership = await prisma.familyMember.create({
          data: {
            familyId: newFamily.id,
            userId: user.id,
            role: 'parent_admin'
          }
        })
        
        reply.log.info('Auto-created family for user', { userId, familyId: newFamily.id })
      }
      
      familyId = membership.familyId
    }

    // Verify user has admin permissions
    const userMembership = await prisma.familyMember.findFirst({
      where: { 
        familyId, 
        userId 
      }
    })

    if (!userMembership || !['parent_admin'].includes(userMembership.role)) {
      return reply.status(403).send({ error: 'Only family admins can update family settings' })
    }

    // Build update data object (only include fields that were provided)
    const updateData: any = {}
    
    if (nameCipher !== undefined) {
      if (!nameCipher.trim()) {
        return reply.status(400).send({ error: 'Family name cannot be empty' })
      }
      updateData.nameCipher = nameCipher.trim()
    }
    
    if (region !== undefined) updateData.region = region || null
    if (maxBudgetPence !== undefined) updateData.maxBudgetPence = maxBudgetPence
    if (budgetPeriod !== undefined) updateData.budgetPeriod = budgetPeriod
    if (showLifetimeEarnings !== undefined) updateData.showLifetimeEarnings = showLifetimeEarnings
    if (giftsEnabled !== undefined) updateData.giftsEnabled = giftsEnabled
    
    // Streak settings
    if (streakProtectionDays !== undefined) updateData.streakProtectionDays = streakProtectionDays
    if (bonusEnabled !== undefined) updateData.bonusEnabled = bonusEnabled
    if (bonusDays !== undefined) updateData.bonusDays = bonusDays
    if (bonusMoneyPence !== undefined) updateData.bonusMoneyPence = bonusMoneyPence
    if (bonusStars !== undefined) updateData.bonusStars = bonusStars
    if (bonusType !== undefined) updateData.bonusType = bonusType
    if (penaltyEnabled !== undefined) updateData.penaltyEnabled = penaltyEnabled
    if (firstMissPence !== undefined) updateData.firstMissPence = firstMissPence
    if (firstMissStars !== undefined) updateData.firstMissStars = firstMissStars
    if (secondMissPence !== undefined) updateData.secondMissPence = secondMissPence
    if (secondMissStars !== undefined) updateData.secondMissStars = secondMissStars
    if (thirdMissPence !== undefined) updateData.thirdMissPence = thirdMissPence
    if (thirdMissStars !== undefined) updateData.thirdMissStars = thirdMissStars
    if (penaltyType !== undefined) updateData.penaltyType = penaltyType
    if (minBalancePence !== undefined) updateData.minBalancePence = minBalancePence
    if (minBalanceStars !== undefined) updateData.minBalanceStars = minBalanceStars
    if (holidayMode !== undefined) updateData.holidayMode = holidayMode
    if (holidayStartDate !== undefined) {
      if (!holidayStartDate) {
        updateData.holidayStartDate = null
      } else {
        const parsed = new Date(holidayStartDate)
        if (Number.isNaN(parsed.getTime())) {
          return reply.status(400).send({ error: 'Invalid holidayStartDate' })
        }
        updateData.holidayStartDate = parsed
      }
    }
    if (holidayEndDate !== undefined) {
      if (!holidayEndDate) {
        updateData.holidayEndDate = null
      } else {
        const parsed = new Date(holidayEndDate)
        if (Number.isNaN(parsed.getTime())) {
          return reply.status(400).send({ error: 'Invalid holidayEndDate' })
        }
        updateData.holidayEndDate = parsed
      }
    }
 
    const updatedFamily = await prisma.family.update({
      where: { id: familyId },
      data: updateData
    })

    // Then fetch with all fields we need
    const familyWithRelations = await prisma.family.findUnique({
      where: { id: familyId },
      select: {
        id: true,
        nameCipher: true,
        region: true,
        maxBudgetPence: true,
        budgetPeriod: true,
        showLifetimeEarnings: true,
        giftsEnabled: true,
        holidayMode: true,
        holidayStartDate: true,
        holidayEndDate: true,
        // Streak settings
        streakProtectionDays: true,
        bonusEnabled: true,
        bonusDays: true,
        bonusMoneyPence: true,
        bonusStars: true,
        bonusType: true,
        penaltyEnabled: true,
        firstMissPence: true,
        firstMissStars: true,
        secondMissPence: true,
        secondMissStars: true,
        thirdMissPence: true,
        thirdMissStars: true,
        penaltyType: true,
        minBalancePence: true,
        minBalanceStars: true,
        members: {
          select: {
            id: true,
            role: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                email: true,
                createdAt: true
              }
            }
          }
        },
        children: {
          select: {
            id: true,
            nickname: true,
            ageGroup: true,
            gender: true,
            createdAt: true
          }
        }
      }
    })

    // Invalidate family cache
    await cache.invalidateFamily(familyId)

    return { family: familyWithRelations }
  } catch (error) {
    reply.log.error('Failed to update family:', error)
    reply.status(500).send({ error: 'Failed to update family' })
  }
}

/**
 * Get all family members
 * @route GET /family/members
 * @description Retrieves all family members (adults and children) with their roles and details
 * @param {FastifyRequest} req - Fastify request object
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ members, children }>} List of adult members and children
 * @throws {404} Not Found - User not part of a family
 */
export const getMembers = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!

    if (!familyId) {
      return reply.status(404).send({ error: 'User not part of a family' })
    }

    // Try to get from cache
    const cached = await cache.get(cacheKeys.familyMembers(familyId))
    if (cached) {
      return cached
    }

    const members = await prisma.familyMember.findMany({
      where: { familyId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    const children = await prisma.child.findMany({
      where: { familyId },
      select: {
        id: true,
        nickname: true,
        ageGroup: true,
        gender: true,
        email: true,
        birthMonth: true,
        birthYear: true,
        theme: true,
        paused: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    })

    const result = { 
      members: members.map(member => ({
        id: member.id,
        role: member.role,
        displayName: member.displayName,
        birthMonth: member.birthMonth,
        birthYear: member.birthYear,
        paused: member.paused,
        joinedAt: member.createdAt,
        user: member.user
      })),
      children
    }

    // Cache for 2 minutes
    await cache.set(cacheKeys.familyMembers(familyId), result, cacheTTL.children)

    return result
  } catch (error) {
    console.error('Failed to get family members:', error)
    reply.status(500).send({ error: 'Failed to get family members' })
  }
}

interface UpdateMemberBody {
  displayName?: string
  birthMonth?: number | null
  birthYear?: number | null
}

/**
 * Update a family member's information
 * @route PATCH /family/members/:id
 * @description Updates a family member's display name, birthday, or other profile information
 * @param {FastifyRequest<{ Params: { id: string }; Body: UpdateMemberBody }>} req - Request with member ID and update data
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ member }>} Updated member object
 * @throws {401} Unauthorized - Not authenticated
 * @throws {404} Not Found - Member not found
 * @throws {500} Internal Server Error - Failed to update member
 */
export const updateMember = async (req: FastifyRequest<{ Params: { id: string }; Body: UpdateMemberBody }>, reply: FastifyReply) => {
  try {
    const { familyId, sub: userId } = req.claims!
    const { id } = req.params
    const { displayName, birthMonth, birthYear } = req.body

    if (!familyId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    // Verify member belongs to family
    const member = await prisma.familyMember.findFirst({
      where: { id, familyId }
    })

    if (!member) {
      return reply.status(404).send({ error: 'Member not found' })
    }

    // Build update data
    const updateData: any = {}
    if (displayName !== undefined) {
      updateData.displayName = displayName || null
    }
    if (birthMonth !== undefined) {
      updateData.birthMonth = birthMonth || null
    }
    if (birthYear !== undefined) {
      updateData.birthYear = birthYear || null
    }

    // Update member
    const updated = await prisma.familyMember.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true
          }
        }
      }
    })

    // Invalidate cache
    await cache.invalidateFamily(familyId)

    return reply.send({
      member: {
        id: updated.id,
        role: updated.role,
        displayName: updated.displayName,
        birthMonth: updated.birthMonth,
        birthYear: updated.birthYear,
        joinedAt: updated.createdAt,
        user: updated.user
      }
    })
  } catch (error: any) {
    console.error('Failed to update member:', error)
    req.log.error(error)
    return reply.status(500).send({ error: 'Failed to update member', details: error.message })
  }
}

/**
 * Generate device access token for a family member
 * @route POST /family/members/:id/device-token
 * @description Generates a magic link token for device access and sends it via email to the member
 * @param {FastifyRequest<{ Params: { id: string } }>} req - Request with member ID
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ emailSent, token?, expiresAt }>} Email send status and optional token
 * @throws {401} Unauthorized - Not authenticated
 * @throws {404} Not Found - Member not found
 * @throws {500} Internal Server Error - Failed to generate token or send email
 */
export const generateDeviceToken = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId, sub: userId } = req.claims!
    const { id } = req.params

    if (!familyId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    // Verify member belongs to family
    const member = await prisma.familyMember.findFirst({
      where: { id, familyId },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    })

    if (!member) {
      return reply.status(404).send({ error: 'Member not found' })
    }

    // Generate device access token (magic link for adults)
    const token = generateToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Delete any existing device access tokens for this email
    await prisma.authToken.deleteMany({
      where: { 
        email: member.user.email, 
        type: 'device_access',
        familyId 
      }
    })

    const authToken = await prisma.authToken.create({
      data: {
        email: member.user.email,
        token,
        type: 'device_access',
        familyId,
        expiresAt
      }
    })

    // Send magic link email to the adult
    try {
      const { sendMagicLink } = await import('../utils/email.js')
      await sendMagicLink(member.user.email, token)
      
      return reply.send({
        message: 'Device access email sent successfully',
        emailSent: true,
        expiresAt: authToken.expiresAt
      })
    } catch (emailError: any) {
      console.error('Failed to send device access email:', emailError)
      // Still return success but note email failed
      return reply.send({
        message: 'Device access token created but email failed to send',
        emailSent: false,
        token: authToken.token, // Return token as fallback
        expiresAt: authToken.expiresAt
      })
    }
  } catch (error: any) {
    console.error('Failed to generate device token:', error)
    req.log.error(error)
    return reply.status(500).send({ error: 'Failed to generate device token', details: error.message })
  }
}

/**
 * Toggle member pause status
 * @route PATCH /family/members/:id/pause
 * @description Pauses or unpauses a family member's account access. Prevents pausing yourself or the last admin.
 * @param {FastifyRequest<{ Params: { id: string } }>} req - Request with member ID
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ message, paused }>} Success message and new pause status
 * @throws {400} Bad Request - Cannot pause yourself or the last admin
 * @throws {401} Unauthorized - Not authenticated
 * @throws {404} Not Found - Member not found
 */
export const toggleMemberPause = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId, sub: userId } = req.claims!
    const { id } = req.params

    if (!familyId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    // Verify member belongs to family
    const member = await prisma.familyMember.findFirst({
      where: { id, familyId }
    })

    if (!member) {
      return reply.status(404).send({ error: 'Member not found' })
    }

    // Prevent pausing yourself
    if (member.userId === userId) {
      return reply.status(400).send({ error: 'Cannot pause your own account' })
    }

    // Prevent pausing the last admin
    if (member.role === 'parent_admin' && !member.paused) {
      const adminCount = await prisma.familyMember.count({
        where: {
          familyId,
          role: 'parent_admin',
          paused: false
        }
      })
      if (adminCount <= 1) {
        return reply.status(400).send({ error: 'Cannot pause the last admin member' })
      }
    }

    // Toggle pause status
    const updated = await prisma.familyMember.update({
      where: { id },
      data: { paused: !member.paused }
    })

    // Invalidate cache
    await cache.invalidateFamily(familyId)

    return reply.send({
      message: `Member ${updated.paused ? 'paused' : 'unpaused'} successfully`,
      paused: updated.paused
    })
  } catch (error: any) {
    console.error('Failed to toggle member pause:', error)
    req.log.error(error)
    return reply.status(500).send({ error: 'Failed to toggle member pause', details: error.message })
  }
}

/**
 * Remove a member from the family
 * @route DELETE /family/members/:id
 * @description Permanently removes a family member. Prevents removing yourself or the last admin.
 * @param {FastifyRequest<{ Params: { id: string } }>} req - Request with member ID
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ message }>} Success message
 * @throws {400} Bad Request - Cannot remove yourself or the last admin
 * @throws {401} Unauthorized - Not authenticated
 * @throws {404} Not Found - Member not found
 */
export const removeMember = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId, sub: userId } = req.claims!
    const { id } = req.params

    if (!familyId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    // Verify member belongs to family
    const member = await prisma.familyMember.findFirst({
      where: { id, familyId },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    })

    if (!member) {
      return reply.status(404).send({ error: 'Member not found' })
    }

    // Prevent removing yourself
    if (member.userId === userId) {
      return reply.status(400).send({ error: 'Cannot remove your own account' })
    }

    // Prevent removing the last admin
    if (member.role === 'parent_admin') {
      const adminCount = await prisma.familyMember.count({
        where: {
          familyId,
          role: 'parent_admin'
        }
      })
      if (adminCount <= 1) {
        return reply.status(400).send({ error: 'Cannot remove the last admin member' })
      }
    }

    // Delete the family member record
    await prisma.familyMember.delete({
      where: { id }
    })

    // Note: We don't delete the User record as they might be part of other families
    // If they have no other family memberships, that's handled by data cleanup

    // Invalidate cache
    await cache.invalidateFamily(familyId)

    return reply.send({
      message: 'Member removed successfully'
    })
  } catch (error: any) {
    console.error('Failed to remove member:', error)
    req.log.error(error)
    return reply.status(500).send({ error: 'Failed to remove member', details: error.message })
  }
}

/**
 * Get member activity statistics
 * @route GET /family/members/:id/stats
 * @description Retrieves statistics for a family member including last login and action counts
 * @param {FastifyRequest<{ Params: { id: string } }>} req - Request with member ID
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ stats }>} Member statistics (lastLogin, actions: assignmentsCreated, payoutsMade, completionsApproved)
 * @throws {401} Unauthorized - Not authenticated
 * @throws {404} Not Found - Member not found
 */
export const getMemberStats = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId, sub: userId } = req.claims!
    const { id } = req.params

    if (!familyId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    // Verify member belongs to family
    const member = await prisma.familyMember.findFirst({
      where: { id, familyId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            lastLoginAt: true
          }
        }
      }
    })

    if (!member) {
      return reply.status(404).send({ error: 'Member not found' })
    }

    // Count actions performed by this user
    const [assignmentsCount, payoutsCount, completionsApprovedCount] = await Promise.all([
      // Count assignments created by this user
      prisma.assignment.count({
        where: {
          familyId,
          createdBy: member.userId
        }
      }),
      
      // Count payouts made by this user
      prisma.payout.count({
        where: {
          familyId,
          paidBy: member.userId
        }
      }),
      
      // Count completions approved by this user
      prisma.completion.count({
        where: {
          familyId,
          status: 'approved',
          approvedBy: member.userId
        }
      })
    ])

    return reply.send({
      stats: {
        lastLogin: member.user.lastLoginAt,
        actions: {
          assignmentsCreated: assignmentsCount,
          payoutsMade: payoutsCount,
          completionsApproved: completionsApprovedCount
        }
      }
    })
  } catch (error: any) {
    console.error('Failed to get member stats:', error)
    req.log.error(error)
    return reply.status(500).send({ error: 'Failed to get member stats', details: error.message })
  }
}

export const getBudget = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!

    const family = await prisma.family.findUnique({
      where: { id: familyId },
      select: {
        maxBudgetPence: true,
        budgetPeriod: true,
        budgetStartDate: true
      }
    })

    if (!family) {
      return reply.status(404).send({ error: 'Family not found' })
    }

    // Calculate allocated budget from assignments (not just all active chores)
    // This matches the frontend calculation in "Estimated Weekly Earnings Per Child"
    const assignments = await prisma.assignment.findMany({
      where: {
        familyId,
        childId: { not: null } // Only count assigned chores
      },
      include: {
        chore: {
          select: {
            baseRewardPence: true,
            frequency: true,
            active: true
          }
        }
      }
    })

    // Calculate weekly cost based on assigned chores only
    let allocatedPence = 0
    for (const assignment of assignments) {
      const chore = assignment.chore
      if (!chore || !chore.active) continue // Only count active chores
      
      if (chore.frequency === 'daily') {
        allocatedPence += chore.baseRewardPence * 7 // 7 days per week
      } else if (chore.frequency === 'weekly') {
        allocatedPence += chore.baseRewardPence
      }
      // 'once' chores don't count towards weekly budget
    }

    // Convert to monthly if needed
    if (family.budgetPeriod === 'monthly') {
      allocatedPence = allocatedPence * 4 // Approx 4 weeks per month
    }

    const remainingPence = (family.maxBudgetPence || 0) - allocatedPence

    return {
      maxBudgetPence: family.maxBudgetPence,
      budgetPeriod: family.budgetPeriod,
      allocatedPence,
      remainingPence,
      percentUsed: family.maxBudgetPence ? Math.round((allocatedPence / family.maxBudgetPence) * 100) : 0
    }
  } catch (error) {
    reply.status(500).send({ error: 'Failed to get budget' })
  }
}

export const getJoinCodes = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!

    if (!familyId) {
      return reply.status(404).send({ error: 'User not part of a family' })
    }

    // Get active (unused and not expired) join codes for this family
    const joinCodes = await prisma.childJoinCode.findMany({
      where: {
        familyId,
        usedAt: null,
        expiresAt: {
          gt: new Date() // Greater than now (not expired)
        }
      },
      select: {
        id: true,
        code: true,
        intendedNickname: true,
        createdAt: true,
        expiresAt: true,
        usedByChildId: true,
        usedByChild: {
          select: {
            id: true,
            nickname: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return { joinCodes }
  } catch (error) {
    console.error('Failed to get join codes:', error)
    reply.status(500).send({ error: 'Failed to get join codes' })
  }
}
