import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'
import { generateJoinCode } from '../utils/crypto.js'
import { cache } from '../utils/cache.js'

/**
 * Calculate age group from birth month and year
 * @param birthMonth 1-12
 * @param birthYear e.g., 2015
 * @returns age group string
 */
function calculateAgeGroup(birthMonth: number | null, birthYear: number): string {
  const now = new Date()
  const currentYear = now.getFullYear()
  
  let age = currentYear - birthYear
  
  // If month is provided, adjust age if birthday hasn't occurred this year
  if (birthMonth !== null && birthMonth !== undefined) {
    const currentMonth = now.getMonth() + 1 // getMonth() returns 0-11
    if (currentMonth < birthMonth) {
      age--
    }
  }
  
  if (age <= 8) return '5-8'
  if (age <= 11) return '9-11'
  if (age <= 15) return '12-15'
  return '12-15' // Default to oldest group
}

interface CreateChildBody {
  nickname: string
  realNameCipher?: string
  dobCipher?: string
  ageGroup?: string
}

interface UpdateChildBody {
  nickname?: string
  ageGroup?: string
  gender?: string
  email?: string
  birthMonth?: number
  birthYear?: number
  theme?: string
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
        intendedNickname: nickname,
        expiresAt
      }
    })

    // Invalidate family cache so parent dashboard shows new child immediately
    await cache.invalidateFamily(familyId)

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

export const update = async (req: FastifyRequest<{ Params: { id: string }; Body: UpdateChildBody }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { id } = req.params
    const { nickname, ageGroup, gender, email, birthMonth, birthYear, theme } = req.body

    // Verify child belongs to family
    const existingChild = await prisma.child.findFirst({
      where: { id, familyId }
    })

    if (!existingChild) {
      return reply.status(404).send({ error: 'Child not found' })
    }

    // Auto-calculate age group if birth year is provided (month is optional)
    let calculatedAgeGroup = ageGroup
    if (birthYear !== undefined && birthYear !== null) {
      calculatedAgeGroup = calculateAgeGroup(birthMonth, birthYear)
    }

    // Update child
    const child = await prisma.child.update({
      where: { id },
      data: {
        nickname: nickname !== undefined ? nickname : undefined,
        ageGroup: calculatedAgeGroup !== undefined ? calculatedAgeGroup : undefined,
        gender: gender !== undefined ? gender : undefined,
        email: email !== undefined ? email : undefined,
        birthMonth: birthMonth !== undefined ? birthMonth : undefined,
        birthYear: birthYear !== undefined ? birthYear : undefined,
        theme: theme !== undefined ? theme : undefined
      }
    })

    // Invalidate family cache so changes are reflected immediately
    await cache.invalidateFamily(familyId)

    return {
      child: {
        id: child.id,
        nickname: child.nickname,
        ageGroup: child.ageGroup,
        gender: child.gender,
        email: child.email,
        birthMonth: child.birthMonth,
        birthYear: child.birthYear,
        theme: child.theme
      }
    }
  } catch (error) {
    console.error('Failed to update child:', error)
    reply.status(500).send({ error: 'Failed to update child' })
  }
}

export const togglePause = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { id } = req.params

    // Verify child belongs to family
    const existingChild = await prisma.child.findFirst({
      where: { id, familyId }
    })

    if (!existingChild) {
      return reply.status(404).send({ error: 'Child not found' })
    }

    // Toggle the pause status
    const updatedChild = await prisma.child.update({
      where: { id },
      data: { paused: !existingChild.paused }
    })

    console.log(`⏸️ Child ${existingChild.nickname} ${updatedChild.paused ? 'paused' : 'unpaused'} successfully`)

    // Invalidate family cache so changes are reflected immediately
    await cache.invalidateFamily(familyId)

    return { 
      message: `Child ${updatedChild.paused ? 'paused' : 'unpaused'} successfully`,
      paused: updatedChild.paused
    }
  } catch (error) {
    console.error('Failed to toggle pause status:', error)
    reply.status(500).send({ error: 'Failed to toggle pause status' })
  }
}

export const remove = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { id } = req.params

    // Verify child belongs to family
    const existingChild = await prisma.child.findFirst({
      where: { id, familyId },
      include: {
        assignments: true,
        completions: true,
        wallets: true,
        streaks: true,
        bids: true,
        redemptions: true,
        payouts: true
      }
    })

    if (!existingChild) {
      return reply.status(404).send({ error: 'Child not found' })
    }

    console.log(`🗑️ Removing child ${existingChild.nickname} (ID: ${id}) and all related data...`)

    // Get wallet IDs for this child
    const walletIds = existingChild.wallets.map(wallet => wallet.id)

    // Delete in correct order to avoid foreign key constraints
    // Delete transactions by walletId
    if (walletIds.length > 0) {
      await prisma.transaction.deleteMany({
        where: { walletId: { in: walletIds } }
      })
    }

    await prisma.completion.deleteMany({
      where: { childId: id }
    })

    await prisma.bid.deleteMany({
      where: { childId: id }
    })

    await prisma.assignment.deleteMany({
      where: { childId: id }
    })

    await prisma.streak.deleteMany({
      where: { childId: id }
    })

    await prisma.payout.deleteMany({
      where: { childId: id }
    })

    await prisma.redemption.deleteMany({
      where: { childId: id }
    })

    await prisma.wallet.deleteMany({
      where: { childId: id }
    })

    // Clear any join codes that reference this child
    await prisma.childJoinCode.updateMany({
      where: { usedByChildId: id },
      data: { usedByChildId: null }
    })

    // Finally delete the child
    await prisma.child.delete({
      where: { id }
    })

    // Invalidate family cache so changes are reflected immediately
    await cache.invalidateFamily(familyId)

    console.log(`✅ Successfully removed child ${existingChild.nickname} and all related data`)

    return { message: 'Child removed successfully' }
  } catch (error) {
    console.error('Failed to remove child:', error)
    reply.status(500).send({ error: 'Failed to remove child' })
  }
}
