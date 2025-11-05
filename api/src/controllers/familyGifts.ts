import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'
import { ErrorCode, sendError } from '../utils/errors.js'
import { cache, cacheKeys, cacheTTL } from '../utils/cache.js'

/**
 * Request body for creating a family gift
 */
interface CreateFamilyGiftBody {
  giftTemplateId?: string // If adding from admin template
  isCustom: boolean
  type: 'amazon_product' | 'activity' | 'custom'
  provider?: 'amazon_associates' | 'amazon_sitestripe'
  amazonAsin?: string
  affiliateUrl?: string
  affiliateTag?: string
  sitestripeUrl?: string
  pricePence?: number
  title: string
  description?: string
  imageUrl?: string
  category?: string
  starsRequired: number
  ageTag?: string
  genderTag?: string
  availableForAll?: boolean
  availableForChildIds?: string[]
  active?: boolean
  recurring?: boolean
}

/**
 * Request body for updating a family gift
 */
interface UpdateFamilyGiftBody {
  starsRequired?: number
  availableForAll?: boolean
  availableForChildIds?: string[]
  active?: boolean
  recurring?: boolean
  title?: string
  description?: string
}

/**
 * List gift templates (read-only for users)
 * @route GET /gift-templates
 * @description Browse available gift templates that parents can select from
 * @param {FastifyRequest<{ Querystring: { type?: string; category?: string; age?: string; gender?: string } }>} req - Request with optional filters
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ templates }>} List of active gift templates
 */
export const list = async (
  req: FastifyRequest<{ 
    Querystring: { 
      type?: string
      category?: string
      age?: string
      gender?: string
      featured?: string
    } 
  }>,
  reply: FastifyReply
) => {
  try {
    const { type, category, age, gender, featured } = req.query
    
    const whereClause: any = {
      active: true // Only show active templates
    }
    
    if (type) {
      whereClause.type = type
    }
    
    if (category) {
      whereClause.category = category
    }
    
    if (featured === 'true') {
      whereClause.featured = true
    }
    
    // Age filtering (check if age range matches)
    if (age) {
      whereClause.OR = [
        { suggestedAgeRanges: { array_contains: [age] } },
        { suggestedAgeRanges: null }
      ]
    }
    
    // Gender filtering
    if (gender) {
      whereClause.OR = [
        ...(whereClause.OR || []),
        { suggestedGender: gender },
        { suggestedGender: 'both' },
        { suggestedGender: 'unisex' },
        { suggestedGender: null }
      ]
    }
    
    const templates = await prisma.giftTemplate.findMany({
      where: whereClause,
      orderBy: [
        { featured: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 100
    })
    
    return { templates }
  } catch (error) {
    console.error('Error listing gift templates:', error)
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, 'Failed to fetch gift templates', 500)
  }
}

/**
 * List family gifts
 * @route GET /family/gifts
 * @description Retrieves all gifts available to the family (admin templates + custom)
 * @param {FastifyRequest<{ Querystring: { childId?: string; type?: string; active?: string } }>} req - Request with optional filters
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ gifts }>} List of family gifts
 */
export const listFamilyGifts = async (
  req: FastifyRequest<{ 
    Querystring: { 
      childId?: string
      type?: string
      active?: string
    } 
  }>,
  reply: FastifyReply
) => {
  try {
    const { familyId } = req.claims!
    const { childId, type, active } = req.query
    
    const whereClause: any = { familyId }
    
    if (type) {
      whereClause.type = type
    }
    
    if (active !== undefined) {
      whereClause.active = active === 'true'
    }
    
    // Filter by child availability
    if (childId) {
      // For MVP, we'll filter in application layer
      // Prisma JSON array filtering is complex
      whereClause.OR = [
        { availableForAll: true }
        // Note: availableForChildIds filtering will be done in application layer
      ]
    }
    
    let gifts = await prisma.familyGift.findMany({
      where: whereClause,
      include: {
        giftTemplate: {
          select: {
            id: true,
            title: true,
            featured: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: [
        { createdAt: 'desc' }
      ]
    })
    
    // Filter by childId in application layer if needed
    if (childId) {
      gifts = gifts.filter(gift => {
        if (gift.availableForAll) return true
        const childIds = gift.availableForChildIds as string[] | null
        return childIds && childIds.includes(childId)
      })
      
      // For child shop view: Filter out non-recurring gifts that have already been redeemed by this child
      // This ensures non-recurring gifts don't show in child shop after purchase
      // Note: Gifts remain visible on parent dashboard (when childId is not provided)
      const redeemedGiftIds = await prisma.redemption.findMany({
        where: {
          childId,
          familyGiftId: { in: gifts.map(g => g.id) },
          status: { in: ['pending', 'fulfilled'] } // Count both pending and fulfilled
        },
        select: {
          familyGiftId: true
        }
      })
      
      const redeemedIds = new Set(redeemedGiftIds.map(r => r.familyGiftId).filter(Boolean))
      
      gifts = gifts.filter(gift => {
        // If gift is recurring, always show it (can be purchased multiple times)
        if (gift.recurring) return true
        // If gift is not recurring, only show if not redeemed by this child
        return !redeemedIds.has(gift.id)
      })
    }
    
    return { gifts }
  } catch (error) {
    console.error('Error listing family gifts:', error)
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, 'Failed to fetch family gifts', 500)
  }
}

/**
 * Get a single family gift
 * @route GET /family/gifts/:id
 * @description Retrieves a specific family gift by ID
 * @param {FastifyRequest<{ Params: { id: string } }>} req - Request with gift ID
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ gift }>} Family gift object
 */
export const get = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const { familyId } = req.claims!
    const { id } = req.params
    
    const gift = await prisma.familyGift.findFirst({
      where: { id, familyId },
      include: {
        giftTemplate: true
      }
    })
    
    if (!gift) {
      return reply.status(404).send({ error: 'Gift not found' })
    }
    
    return { gift }
  } catch (error) {
    console.error('Error fetching family gift:', error)
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, 'Failed to fetch gift', 500)
  }
}

/**
 * Create a custom family gift
 * @route POST /family/gifts
 * @description Creates a custom gift for the family (not from admin template)
 * @param {FastifyRequest<{ Body: CreateFamilyGiftBody }>} req - Request with gift data
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ gift }>} Created family gift
 */
export const create = async (
  req: FastifyRequest<{ Body: CreateFamilyGiftBody }>,
  reply: FastifyReply
) => {
  try {
    const { familyId } = req.claims!
    const body = req.body
    
    // Validation
    if (!body.title || !body.starsRequired) {
      return reply.status(400).send({ error: 'Title and stars required are required' })
    }
    
    if (body.type === 'amazon_product' && !body.provider) {
      return reply.status(400).send({ error: 'Provider is required for Amazon products' })
    }
    
    // Generate affiliate URL if ASIN and tag provided
    let affiliateUrl = body.affiliateUrl
    if (body.type === 'amazon_product' && body.provider === 'amazon_associates' && body.amazonAsin && body.affiliateTag) {
      affiliateUrl = `https://amazon.co.uk/dp/${body.amazonAsin}?tag=${body.affiliateTag}`
    }
    
    const { sub: userId } = req.claims!
    
    const gift = await prisma.familyGift.create({
      data: {
        familyId,
        giftTemplateId: body.giftTemplateId || null,
        isCustom: body.isCustom,
        type: body.type,
        provider: body.provider || null,
        amazonAsin: body.amazonAsin || null,
        affiliateUrl: affiliateUrl || body.affiliateUrl || null,
        affiliateTag: body.affiliateTag || null,
        sitestripeUrl: body.sitestripeUrl || null,
        pricePence: body.pricePence || null,
        title: body.title,
        description: body.description || null,
        imageUrl: body.imageUrl || null,
        category: body.category || null,
        starsRequired: body.starsRequired,
        ageTag: body.ageTag || null,
        genderTag: body.genderTag || null,
        availableForAll: body.availableForAll !== undefined ? body.availableForAll : true,
        availableForChildIds: body.availableForChildIds || null,
        active: body.active !== undefined ? body.active : true,
        recurring: body.recurring !== undefined ? body.recurring : false,
        createdBy: userId
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            email: true
          }
        }
      }
    })
    
    // Invalidate family cache
    await cache.invalidateFamily(familyId)
    
    return { gift }
  } catch (error) {
    console.error('Error creating family gift:', error)
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, 'Failed to create gift', 500)
  }
}

/**
 * Add a gift from admin template to family
 * @route POST /family/gifts/:templateId/add
 * @description Adds an admin gift template to the family with customizable star cost
 * @param {FastifyRequest<{ Params: { templateId: string }; Body: { starsRequired?: number; availableForAll?: boolean; availableForChildIds?: string[] } }>} req - Request with template ID and customization
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ gift }>} Created family gift
 */
export const addFromTemplate = async (
  req: FastifyRequest<{ 
    Params: { templateId: string }
    Body: { 
      starsRequired?: number
      availableForAll?: boolean
      availableForChildIds?: string[]
      recurring?: boolean
    } 
  }>,
  reply: FastifyReply
) => {
  try {
    const { familyId, sub: userId } = req.claims!
    const { templateId } = req.params
    const { starsRequired, availableForAll, availableForChildIds, recurring } = req.body
    
    // Get the template
    const template = await prisma.giftTemplate.findUnique({
      where: { id: templateId }
    })
    
    if (!template || !template.active) {
      return reply.status(404).send({ error: 'Gift template not found or inactive' })
    }
    
    // Check if already added to family
    const existing = await prisma.familyGift.findFirst({
      where: {
        familyId,
        giftTemplateId: templateId
      }
    })
    
    if (existing) {
      return reply.status(400).send({ error: 'This gift is already in your family' })
    }
    
    // Prepare gift data - handle imageUrl length if it's too long
    const imageUrl = template.imageUrl && template.imageUrl.length > 2048 
      ? template.imageUrl.substring(0, 2048) // Truncate if too long
      : template.imageUrl
    
    // Create family gift from template
    const gift = await prisma.familyGift.create({
      data: {
        familyId,
        giftTemplateId: templateId,
        isCustom: false,
        type: template.type,
        provider: template.provider,
        amazonAsin: template.amazonAsin,
        affiliateUrl: template.affiliateUrl,
        affiliateTag: template.affiliateTag,
        sitestripeUrl: template.sitestripeUrl,
        pricePence: template.pricePence || null,
        title: template.title,
        description: template.description,
        imageUrl: imageUrl || null, // Ensure it's null if empty
        category: template.category,
        starsRequired: starsRequired || template.suggestedStars,
        ageTag: template.suggestedGender ? null : null, // Can be set later
        genderTag: template.suggestedGender || null,
        availableForAll: availableForAll !== undefined ? availableForAll : true,
        availableForChildIds: availableForChildIds || null,
        active: true,
        recurring: recurring !== undefined ? recurring : (template.recurring || false), // Use provided value or template default
        createdBy: userId
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            email: true
          }
        }
      }
    })
    
    // Invalidate family cache
    await cache.invalidateFamily(familyId)
    
    return { gift }
  } catch (error: any) {
    console.error('Error adding gift from template:', error)
    
    // Return more specific error messages
    if (error.code === 'P2002') {
      return reply.status(400).send({ error: 'This gift already exists in your family' })
    }
    if (error.code === 'P2003') {
      return reply.status(400).send({ error: 'Invalid family or template reference' })
    }
    
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, error.message || 'Failed to add gift', 500)
  }
}

/**
 * Update a family gift
 * @route PATCH /family/gifts/:id
 * @description Updates a family gift (star cost, assignment, active status)
 * @param {FastifyRequest<{ Params: { id: string }; Body: UpdateFamilyGiftBody }>} req - Request with gift ID and update data
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ gift }>} Updated family gift
 */
export const update = async (
  req: FastifyRequest<{ Params: { id: string }; Body: UpdateFamilyGiftBody }>,
  reply: FastifyReply
) => {
  try {
    const { familyId } = req.claims!
    const { id } = req.params
    const body = req.body
    
    // Verify gift belongs to family
    const existing = await prisma.familyGift.findFirst({
      where: { id, familyId }
    })
    
    if (!existing) {
      return reply.status(404).send({ error: 'Gift not found' })
    }
    
    const updateData: any = {}
    
    if (body.starsRequired !== undefined) updateData.starsRequired = body.starsRequired
    if (body.availableForAll !== undefined) updateData.availableForAll = body.availableForAll
    if (body.availableForChildIds !== undefined) updateData.availableForChildIds = body.availableForChildIds
    if (body.active !== undefined) updateData.active = body.active
    if (body.recurring !== undefined) updateData.recurring = body.recurring
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    
    const gift = await prisma.familyGift.update({
      where: { id },
      data: updateData
    })
    
    // Invalidate family cache
    await cache.invalidateFamily(familyId)
    
    return { gift }
  } catch (error) {
    console.error('Error updating family gift:', error)
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, 'Failed to update gift', 500)
  }
}

/**
 * Remove a family gift
 * @route DELETE /family/gifts/:id
 * @description Removes a gift from the family
 * @param {FastifyRequest<{ Params: { id: string } }>} req - Request with gift ID
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ message }>} Success message
 */
export const remove = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const { familyId } = req.claims!
    const { id } = req.params
    
    // Verify gift belongs to family
    const existing = await prisma.familyGift.findFirst({
      where: { id, familyId },
      include: {
        _count: {
          select: { redemptions: true }
        }
      }
    })
    
    if (!existing) {
      return reply.status(404).send({ error: 'Gift not found' })
    }
    
    // If there are redemptions, deactivate instead of delete
    if (existing._count.redemptions > 0) {
      await prisma.familyGift.update({
        where: { id },
        data: { active: false }
      })
      await cache.invalidateFamily(familyId)
      return { message: 'Gift deactivated (has redemptions)' }
    }
    
    // Otherwise, delete
    await prisma.familyGift.delete({
      where: { id }
    })
    
    // Invalidate family cache
    await cache.invalidateFamily(familyId)
    
    return { message: 'Gift removed successfully' }
  } catch (error) {
    console.error('Error removing family gift:', error)
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, 'Failed to remove gift', 500)
  }
}

