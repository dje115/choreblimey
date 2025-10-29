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
      nameCipher, region, maxBudgetPence, budgetPeriod, showLifetimeEarnings,
      streakProtectionDays, bonusEnabled, bonusDays, bonusMoneyPence, bonusStars, bonusType,
      penaltyEnabled, firstMissPence, firstMissStars, secondMissPence, secondMissStars, thirdMissPence, thirdMissStars, penaltyType,
      minBalancePence, minBalanceStars
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

    // Calculate allocated budget from active chores
    const activeChores = await prisma.chore.findMany({
      where: {
        familyId,
        active: true
      },
      select: {
        baseRewardPence: true,
        frequency: true
      }
    })

    // Calculate weekly cost
    let allocatedPence = 0
    for (const chore of activeChores) {
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
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        code: true,
        createdAt: true,
        expiresAt: true
      }
    })

    return { joinCodes }
  } catch (error) {
    console.error('Failed to get join codes:', error)
    reply.status(500).send({ error: 'Failed to get join codes' })
  }
}
