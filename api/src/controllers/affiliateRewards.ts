import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'
import { cache, cacheKeys, cacheTTL, invalidateFamily } from '../utils/cache.js'
import { 
  rankRewards, 
  isBirthdayMonth, 
  isBirthdaySeason,
  isChristmasSeason,
  daysUntilBirthday,
  daysUntilChristmas,
  getExplorationRewards 
} from '../utils/rewardRanking.js'

// ============================================================================
// PUBLIC ENDPOINTS (Children & Parents)
// ============================================================================

/**
 * GET /rewards/featured
 * Get featured rewards (admin-curated)
 */
export const getFeatured = async (req: FastifyRequest<{ Querystring: { ageGroup?: string; limit?: string } }>, reply: FastifyReply) => {
  try {
    const { familyId, childId, role } = req.claims!
    const { ageGroup, limit = '20' } = req.query
    
    const limitNum = Math.min(parseInt(limit), 50)
    
    // Get featured rewards
    const rewards = await prisma.rewardItem.findMany({
      where: {
        featured: true,
        blocked: false,
        ...(ageGroup && { ageTag: ageGroup })
      },
      orderBy: {
        popularityScore: 'desc'
      },
      take: limitNum
    })
    
    return { rewards, count: rewards.length }
  } catch (error) {
    console.error('Error fetching featured rewards:', error)
    reply.status(500).send({ error: 'Failed to fetch featured rewards' })
  }
}

/**
 * GET /rewards/recommended
 * Get personalized recommendations for a child
 */
export const getRecommended = async (req: FastifyRequest<{ Querystring: { childId: string; limit?: string } }>, reply: FastifyReply) => {
  try {
    const { familyId, role, childId: jwtChildId } = req.claims!
    const { childId, limit = '20' } = req.query
    
    const limitNum = Math.min(parseInt(limit), 50)
    
    // Verify child belongs to family or is the requesting child
    const child = await prisma.child.findFirst({
      where: {
        id: childId,
        familyId
      }
    })
    
    if (!child) {
      return reply.status(404).send({ error: 'Child not found' })
    }
    
    // Check if child can access (must be parent or the child themselves)
    if (role === 'child_player' && jwtChildId !== childId) {
      return reply.status(403).send({ error: 'You can only view your own recommendations' })
    }
    
    // Get child's wallet balance (for budget fit scoring)
    const wallet = await prisma.wallet.findFirst({
      where: { childId, familyId }
    })
    const childStars = wallet ? Math.floor(wallet.balancePence / 10) : 0
    
    // Get parent preferences
    const preferences = await prisma.parentRewardPreferences.findUnique({
      where: { familyId }
    })
    
    const defaultPreferences = {
      maxRewardPence: null,
      allowedCategories: null,
      blockedCategories: null,
      curatedOnlyMode: false,
      affiliateOptIn: true,
      birthdayBonusEnabled: true,
      pinnedRewardIds: null,
      blockedRewardIds: null
    }
    
    const prefs = preferences || defaultPreferences
    
    // If curated-only mode, return featured
    if (prefs.curatedOnlyMode) {
      const rewards = await prisma.rewardItem.findMany({
        where: {
          featured: true,
          blocked: false
        },
        orderBy: {
          popularityScore: 'desc'
        },
        take: limitNum
      })
      
      return { rewards, count: rewards.length, mode: 'curated' }
    }
    
    // Fetch all non-blocked rewards for this child's age group
    const allRewards = await prisma.rewardItem.findMany({
      where: {
        blocked: false,
        ageTag: {
          in: [child.ageGroup || 'all_ages', 'all_ages']
        }
      },
      take: 200 // Fetch more for ranking
    })
    
    // Rank rewards
    const rankedRewards = rankRewards(
      child,
      allRewards,
      childStars,
      prefs
    )
    
    // Add pinned rewards to the top
    const pinnedIds = prefs.pinnedRewardIds ? JSON.parse(JSON.stringify(prefs.pinnedRewardIds)) : []
    const pinned = rankedRewards.filter(r => pinnedIds.includes(r.id))
    const notPinned = rankedRewards.filter(r => !pinnedIds.includes(r.id))
    
    // Combine: pinned first, then ranked
    const finalRewards = [...pinned, ...notPinned].slice(0, limitNum)
    
    // Check if birthday month for bonus notification
    const birthdayBonus = prefs.birthdayBonusEnabled && isBirthdayMonth(child)
    
    // Check seasonal lists
    const showBirthdayList = isBirthdaySeason(child)
    const showChristmasList = isChristmasSeason()
    const daysUntilBday = daysUntilBirthday(child)
    const daysUntilXmas = daysUntilChristmas()
    
    return {
      rewards: finalRewards,
      count: finalRewards.length,
      mode: 'personalized',
      birthdayBonus,
      childStars,
      seasonalLists: {
        showBirthdayList,
        showChristmasList,
        daysUntilBirthday: daysUntilBday,
        daysUntilChristmas: daysUntilXmas
      }
    }
  } catch (error) {
    console.error('Error fetching recommended rewards:', error)
    reply.status(500).send({ error: 'Failed to fetch recommended rewards' })
  }
}

/**
 * GET /rewards/birthday-list
 * Get birthday wish list for a child (shows 1 month before + birthday month)
 */
export const getBirthdayList = async (req: FastifyRequest<{ Querystring: { childId: string; limit?: string } }>, reply: FastifyReply) => {
  try {
    const { familyId, role, childId: jwtChildId } = req.claims!
    const { childId, limit = '30' } = req.query
    
    const limitNum = Math.min(parseInt(limit), 100)
    
    // Verify child belongs to family
    const child = await prisma.child.findFirst({
      where: {
        id: childId,
        familyId
      }
    })
    
    if (!child) {
      return reply.status(404).send({ error: 'Child not found' })
    }
    
    // Check if child can access
    if (role === 'child_player' && jwtChildId !== childId) {
      return reply.status(403).send({ error: 'You can only view your own birthday list' })
    }
    
    // Check if it's birthday season
    const inBirthdaySeason = isBirthdaySeason(child)
    const daysUntilBday = daysUntilBirthday(child)
    
    if (!inBirthdaySeason) {
      return {
        message: 'Birthday list is not available yet',
        daysUntilBirthday: daysUntilBday,
        rewards: [],
        count: 0
      }
    }
    
    // Get parent preferences
    const preferences = await prisma.parentRewardPreferences.findUnique({
      where: { familyId }
    })
    
    const defaultPreferences = {
      maxRewardPence: null,
      allowedCategories: null,
      blockedCategories: null,
      curatedOnlyMode: false,
      affiliateOptIn: true,
      birthdayBonusEnabled: true,
      pinnedRewardIds: null,
      blockedRewardIds: null
    }
    
    const prefs = preferences || defaultPreferences
    
    // Get child's wallet balance
    const wallet = await prisma.wallet.findFirst({
      where: { childId, familyId }
    })
    const childStars = wallet ? Math.floor(wallet.balancePence / 10) : 0
    
    // Fetch all non-blocked rewards for this child's age group
    // For birthday lists, we want more expensive/aspirational items
    const allRewards = await prisma.rewardItem.findMany({
      where: {
        blocked: false,
        ageTag: {
          in: [child.ageGroup || 'all_ages', 'all_ages']
        }
      },
      orderBy: {
        popularityScore: 'desc'
      },
      take: 200
    })
    
    // Rank rewards (but allow higher-priced items for birthday)
    const rankedRewards = rankRewards(
      child,
      allRewards,
      childStars * 3, // Triple the budget fit for birthday lists
      prefs
    )
    
    const finalRewards = rankedRewards.slice(0, limitNum)
    
    return {
      rewards: finalRewards,
      count: finalRewards.length,
      daysUntilBirthday: daysUntilBday,
      message: `Birthday wish list for ${child.nickname}`,
      inBirthdaySeason: true
    }
  } catch (error) {
    console.error('Error fetching birthday list:', error)
    reply.status(500).send({ error: 'Failed to fetch birthday list' })
  }
}

/**
 * GET /rewards/christmas-list
 * Get Christmas wish list (shows November 1 - December 24)
 */
export const getChristmasList = async (req: FastifyRequest<{ Querystring: { childId: string; limit?: string } }>, reply: FastifyReply) => {
  try {
    const { familyId, role, childId: jwtChildId } = req.claims!
    const { childId, limit = '30' } = req.query
    
    const limitNum = Math.min(parseInt(limit), 100)
    
    // Verify child belongs to family
    const child = await prisma.child.findFirst({
      where: {
        id: childId,
        familyId
      }
    })
    
    if (!child) {
      return reply.status(404).send({ error: 'Child not found' })
    }
    
    // Check if child can access
    if (role === 'child_player' && jwtChildId !== childId) {
      return reply.status(403).send({ error: 'You can only view your own Christmas list' })
    }
    
    // Check if it's Christmas season
    const inChristmasSeason = isChristmasSeason()
    const daysUntilXmas = daysUntilChristmas()
    
    if (!inChristmasSeason) {
      return {
        message: 'Christmas list is not available yet',
        daysUntilChristmas: daysUntilXmas,
        rewards: [],
        count: 0
      }
    }
    
    // Get parent preferences
    const preferences = await prisma.parentRewardPreferences.findUnique({
      where: { familyId }
    })
    
    const defaultPreferences = {
      maxRewardPence: null,
      allowedCategories: null,
      blockedCategories: null,
      curatedOnlyMode: false,
      affiliateOptIn: true,
      birthdayBonusEnabled: true,
      pinnedRewardIds: null,
      blockedRewardIds: null
    }
    
    const prefs = preferences || defaultPreferences
    
    // Get child's wallet balance
    const wallet = await prisma.wallet.findFirst({
      where: { childId, familyId }
    })
    const childStars = wallet ? Math.floor(wallet.balancePence / 10) : 0
    
    // Fetch all non-blocked rewards for this child's age group
    // For Christmas lists, we want more expensive/aspirational items
    const allRewards = await prisma.rewardItem.findMany({
      where: {
        blocked: false,
        ageTag: {
          in: [child.ageGroup || 'all_ages', 'all_ages']
        }
      },
      orderBy: {
        popularityScore: 'desc'
      },
      take: 200
    })
    
    // Rank rewards (but allow higher-priced items for Christmas)
    const rankedRewards = rankRewards(
      child,
      allRewards,
      childStars * 5, // 5x budget fit for Christmas lists
      prefs
    )
    
    const finalRewards = rankedRewards.slice(0, limitNum)
    
    return {
      rewards: finalRewards,
      count: finalRewards.length,
      daysUntilChristmas: daysUntilXmas,
      message: `Christmas wish list for ${child.nickname}`,
      inChristmasSeason: true
    }
  } catch (error) {
    console.error('Error fetching Christmas list:', error)
    reply.status(500).send({ error: 'Failed to fetch Christmas list' })
  }
}

/**
 * GET /rewards/explore
 * Get exploration rewards (random, low-popularity items)
 */
export const getExplore = async (req: FastifyRequest<{ Querystring: { ageGroup?: string; limit?: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { ageGroup, limit = '10' } = req.query
    
    const limitNum = Math.min(parseInt(limit), 20)
    
    const allRewards = await prisma.rewardItem.findMany({
      where: {
        blocked: false,
        popularityScore: { lt: 0.3 },
        ...(ageGroup && { ageTag: ageGroup })
      },
      take: 100
    })
    
    const explorationRewards = getExplorationRewards(allRewards, limitNum)
    
    return { rewards: explorationRewards, count: explorationRewards.length }
  } catch (error) {
    console.error('Error fetching exploration rewards:', error)
    reply.status(500).send({ error: 'Failed to fetch exploration rewards' })
  }
}

/**
 * GET /rewards/:id
 * Get a single reward by ID
 */
export const getById = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { id } = req.params
    
    const reward = await prisma.rewardItem.findUnique({
      where: { id }
    })
    
    if (!reward) {
      return reply.status(404).send({ error: 'Reward not found' })
    }
    
    if (reward.blocked) {
      return reply.status(403).send({ error: 'This reward is not available' })
    }
    
    return { reward }
  } catch (error) {
    console.error('Error fetching reward:', error)
    reply.status(500).send({ error: 'Failed to fetch reward' })
  }
}

/**
 * POST /rewards/click/:id
 * Track click and redirect to affiliate link
 */
export const trackClick = async (req: FastifyRequest<{ Params: { id: string }; Body: { childId?: string } }>, reply: FastifyReply) => {
  try {
    const { familyId, sub: userId, role, childId: jwtChildId } = req.claims!
    const { id } = req.params
    const { childId } = req.body
    
    // Get reward
    const reward = await prisma.rewardItem.findUnique({
      where: { id }
    })
    
    if (!reward) {
      return reply.status(404).send({ error: 'Reward not found' })
    }
    
    if (reward.blocked) {
      return reply.status(403).send({ error: 'This reward is not available' })
    }
    
    // Track click (privacy-safe)
    await prisma.rewardClick.create({
      data: {
        rewardId: id,
        familyId,
        childId: childId || (role === 'child_player' ? jwtChildId : null),
        userId: role !== 'child_player' ? userId : null,
        userAgent: req.headers['user-agent'] || null
      }
    })
    
    // Increment popularity score (async, non-blocking)
    prisma.rewardItem.update({
      where: { id },
      data: {
        popularityScore: {
          increment: 0.001 // Small increment per click
        }
      }
    }).catch(err => console.error('Failed to update popularity:', err))
    
    // Return affiliate URL (frontend will redirect)
    return {
      affiliateUrl: reward.affiliateUrl,
      title: reward.title,
      provider: reward.provider
    }
  } catch (error) {
    console.error('Error tracking click:', error)
    reply.status(500).send({ error: 'Failed to track click' })
  }
}

// ============================================================================
// PARENT PREFERENCES
// ============================================================================

/**
 * GET /rewards/preferences
 * Get parent reward preferences
 */
export const getPreferences = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    
    const preferences = await prisma.parentRewardPreferences.findUnique({
      where: { familyId }
    })
    
    if (!preferences) {
      // Return defaults
      return {
        preferences: {
          maxRewardPence: null,
          allowedCategories: null,
          blockedCategories: null,
          curatedOnlyMode: false,
          affiliateOptIn: true,
          birthdayBonusEnabled: true,
          pinnedRewardIds: [],
          blockedRewardIds: []
        }
      }
    }
    
    return { preferences }
  } catch (error) {
    console.error('Error fetching preferences:', error)
    reply.status(500).send({ error: 'Failed to fetch preferences' })
  }
}

/**
 * PATCH /rewards/preferences
 * Update parent reward preferences
 */
interface UpdatePreferencesBody {
  maxRewardPence?: number | null
  allowedCategories?: string[] | null
  blockedCategories?: string[] | null
  curatedOnlyMode?: boolean
  affiliateOptIn?: boolean
  birthdayBonusEnabled?: boolean
  pinnedRewardIds?: string[]
  blockedRewardIds?: string[]
}

export const updatePreferences = async (req: FastifyRequest<{ Body: UpdatePreferencesBody }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const data = req.body
    
    const preferences = await prisma.parentRewardPreferences.upsert({
      where: { familyId },
      create: {
        familyId,
        ...data
      },
      update: data
    })
    
    // Invalidate family cache
    await invalidateFamily(familyId)
    
    return { preferences }
  } catch (error) {
    console.error('Error updating preferences:', error)
    reply.status(500).send({ error: 'Failed to update preferences' })
  }
}

/**
 * POST /rewards/preferences/pin/:id
 * Pin a reward
 */
export const pinReward = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { id } = req.params
    
    const preferences = await prisma.parentRewardPreferences.findUnique({
      where: { familyId }
    })
    
    const currentPinned = preferences?.pinnedRewardIds 
      ? JSON.parse(JSON.stringify(preferences.pinnedRewardIds))
      : []
    
    if (!currentPinned.includes(id)) {
      currentPinned.push(id)
    }
    
    const updated = await prisma.parentRewardPreferences.upsert({
      where: { familyId },
      create: {
        familyId,
        pinnedRewardIds: currentPinned
      },
      update: {
        pinnedRewardIds: currentPinned
      }
    })
    
    await cache.invalidateFamily(familyId)
    
    return { pinned: true, preferences: updated }
  } catch (error) {
    console.error('Error pinning reward:', error)
    reply.status(500).send({ error: 'Failed to pin reward' })
  }
}

/**
 * DELETE /rewards/preferences/pin/:id
 * Unpin a reward
 */
export const unpinReward = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { id } = req.params
    
    const preferences = await prisma.parentRewardPreferences.findUnique({
      where: { familyId }
    })
    
    const currentPinned = preferences?.pinnedRewardIds 
      ? JSON.parse(JSON.stringify(preferences.pinnedRewardIds))
      : []
    
    const updated = await prisma.parentRewardPreferences.upsert({
      where: { familyId },
      create: {
        familyId,
        pinnedRewardIds: []
      },
      update: {
        pinnedRewardIds: currentPinned.filter((pinnedId: string) => pinnedId !== id)
      }
    })
    
    await cache.invalidateFamily(familyId)
    
    return { unpinned: true, preferences: updated }
  } catch (error) {
    console.error('Error unpinning reward:', error)
    reply.status(500).send({ error: 'Failed to unpin reward' })
  }
}

/**
 * POST /rewards/preferences/block/:id
 * Block a reward
 */
export const blockReward = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { id } = req.params
    
    const preferences = await prisma.parentRewardPreferences.findUnique({
      where: { familyId }
    })
    
    const currentBlocked = preferences?.blockedRewardIds 
      ? JSON.parse(JSON.stringify(preferences.blockedRewardIds))
      : []
    
    if (!currentBlocked.includes(id)) {
      currentBlocked.push(id)
    }
    
    const updated = await prisma.parentRewardPreferences.upsert({
      where: { familyId },
      create: {
        familyId,
        blockedRewardIds: currentBlocked
      },
      update: {
        blockedRewardIds: currentBlocked
      }
    })
    
    await cache.invalidateFamily(familyId)
    
    return { blocked: true, preferences: updated }
  } catch (error) {
    console.error('Error blocking reward:', error)
    reply.status(500).send({ error: 'Failed to block reward' })
  }
}

/**
 * DELETE /rewards/preferences/block/:id
 * Unblock a reward
 */
export const unblockReward = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { id } = req.params
    
    const preferences = await prisma.parentRewardPreferences.findUnique({
      where: { familyId }
    })
    
    const currentBlocked = preferences?.blockedRewardIds 
      ? JSON.parse(JSON.stringify(preferences.blockedRewardIds))
      : []
    
    const updated = await prisma.parentRewardPreferences.upsert({
      where: { familyId },
      create: {
        familyId,
        blockedRewardIds: []
      },
      update: {
        blockedRewardIds: currentBlocked.filter((blockedId: string) => blockedId !== id)
      }
    })
    
    await cache.invalidateFamily(familyId)
    
    return { unblocked: true, preferences: updated }
  } catch (error) {
    console.error('Error unblocking reward:', error)
    reply.status(500).send({ error: 'Failed to unblock reward' })
  }
}

// ============================================================================
// ADMIN ENDPOINTS (will be protected by admin role check)
// ============================================================================

/**
 * GET /admin/rewards
 * List all rewards (admin only)
 */
export const adminListRewards = async (req: FastifyRequest<{ Querystring: { provider?: string; blocked?: string; limit?: string } }>, reply: FastifyReply) => {
  try {
    const { role } = req.claims!
    
    if (role !== 'parent_admin') {
      return reply.status(403).send({ error: 'Admin access required' })
    }
    
    const { provider, blocked, limit = '100' } = req.query
    const limitNum = Math.min(parseInt(limit), 500)
    
    const rewards = await prisma.rewardItem.findMany({
      where: {
        ...(provider && { provider }),
        ...(blocked && { blocked: blocked === 'true' })
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limitNum
    })
    
    return { rewards, count: rewards.length }
  } catch (error) {
    console.error('Error listing rewards (admin):', error)
    reply.status(500).send({ error: 'Failed to list rewards' })
  }
}

/**
 * PATCH /admin/rewards/:id
 * Update a reward (admin only)
 */
export const adminUpdateReward = async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
  try {
    const { role } = req.claims!
    
    if (role !== 'parent_admin') {
      return reply.status(403).send({ error: 'Admin access required' })
    }
    
    const { id } = req.params
    const data = req.body
    
    const reward = await prisma.rewardItem.update({
      where: { id },
      data
    })
    
    return { reward }
  } catch (error) {
    console.error('Error updating reward (admin):', error)
    reply.status(500).send({ error: 'Failed to update reward' })
  }
}

/**
 * GET /admin/rewards/metrics
 * Get performance metrics (admin only)
 */
export const adminGetMetrics = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { role, familyId } = req.claims!
    
    if (role !== 'parent_admin') {
      return reply.status(403).send({ error: 'Admin access required' })
    }
    
    // Total rewards
    const totalRewards = await prisma.rewardItem.count()
    
    // Featured count
    const featuredCount = await prisma.rewardItem.count({ where: { featured: true } })
    
    // Blocked count
    const blockedCount = await prisma.rewardItem.count({ where: { blocked: true } })
    
    // Total clicks (all time)
    const totalClicks = await prisma.rewardClick.count()
    
    // Total purchases
    const totalPurchases = await prisma.rewardPurchase.count()
    
    // Clicks this month
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    
    const monthlyClicks = await prisma.rewardClick.count({
      where: {
        clickedAt: { gte: monthStart }
      }
    })
    
    // Top clicked rewards
    const topRewards = await prisma.rewardItem.findMany({
      orderBy: {
        popularityScore: 'desc'
      },
      take: 10,
      select: {
        id: true,
        title: true,
        provider: true,
        popularityScore: true,
        featured: true
      }
    })
    
    return {
      metrics: {
        totalRewards,
        featuredCount,
        blockedCount,
        totalClicks,
        totalPurchases,
        monthlyClicks
      },
      topRewards
    }
  } catch (error) {
    console.error('Error fetching metrics (admin):', error)
    reply.status(500).send({ error: 'Failed to fetch metrics' })
  }
}

