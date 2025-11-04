import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'
import { ErrorCode, sendError } from '../utils/errors.js'

/**
 * Request body for creating a gift template
 */
interface CreateGiftTemplateBody {
  type: 'amazon_product' | 'activity' | 'custom'
  provider?: 'amazon_associates' | 'amazon_sitestripe'
  amazonAsin?: string
  affiliateUrl?: string
  affiliateTag?: string
  sitestripeUrl?: string
  title: string
  description?: string
  imageUrl?: string
  category?: string
  suggestedAgeRanges?: string[]
  suggestedGender?: 'male' | 'female' | 'both' | 'unisex'
  pricePence?: number
  suggestedStars: number
  active?: boolean
  featured?: boolean
}

/**
 * Request body for updating a gift template
 */
interface UpdateGiftTemplateBody {
  type?: 'amazon_product' | 'activity' | 'custom'
  provider?: 'amazon_associates' | 'amazon_sitestripe'
  amazonAsin?: string
  affiliateUrl?: string
  affiliateTag?: string
  sitestripeUrl?: string
  title?: string
  description?: string
  imageUrl?: string
  category?: string
  suggestedAgeRanges?: string[]
  suggestedGender?: 'male' | 'female' | 'both' | 'unisex'
  pricePence?: number
  suggestedStars?: number
  active?: boolean
  featured?: boolean
}

/**
 * List all gift templates (admin only)
 * @route GET /admin/gift-templates
 * @description Retrieves all gift templates with optional filtering
 * @param {FastifyRequest<{ Querystring: { type?: string; category?: string; active?: string; featured?: string } }>} req - Request with optional query filters
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ templates, count }>} List of gift templates
 * @throws {500} Internal Server Error - Failed to fetch templates
 */
export const adminList = async (
  req: FastifyRequest<{ 
    Querystring: { 
      type?: string
      category?: string
      active?: string
      featured?: string
      limit?: string
      offset?: string
    } 
  }>, 
  reply: FastifyReply
) => {
  try {
    const { type, category, active, featured, limit, offset } = req.query
    
    const whereClause: any = {}
    
    if (type) {
      whereClause.type = type
    }
    
    if (category) {
      whereClause.category = category
    }
    
    if (active !== undefined) {
      whereClause.active = active === 'true'
    }
    
    if (featured !== undefined) {
      whereClause.featured = featured === 'true'
    }
    
    const limitNum = limit ? parseInt(limit) : 100
    const offsetNum = offset ? parseInt(offset) : 0
    
    const [templates, count] = await Promise.all([
      prisma.giftTemplate.findMany({
        where: whereClause,
        orderBy: [
          { featured: 'desc' },
          { createdAt: 'desc' }
        ],
        take: limitNum,
        skip: offsetNum
      }),
      prisma.giftTemplate.count({ where: whereClause })
    ])
    
    return { templates, count }
  } catch (error) {
    console.error('Error listing gift templates:', error)
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, 'Failed to fetch gift templates', 500)
  }
}

/**
 * Get a single gift template (admin only)
 * @route GET /admin/gift-templates/:id
 * @description Retrieves a specific gift template by ID
 * @param {FastifyRequest<{ Params: { id: string } }>} req - Request with template ID
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ template }>} Gift template object
 * @throws {404} Not Found - Template not found
 * @throws {500} Internal Server Error - Failed to fetch template
 */
export const adminGet = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const { id } = req.params
    
    const template = await prisma.giftTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: { familyGifts: true }
        }
      }
    })
    
    if (!template) {
      return reply.status(404).send({ error: 'Gift template not found' })
    }
    
    return { template }
  } catch (error) {
    console.error('Error fetching gift template:', error)
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, 'Failed to fetch gift template', 500)
  }
}

/**
 * Create a new gift template (admin only)
 * @route POST /admin/gift-templates
 * @description Creates a new gift template (Amazon product or activity)
 * @param {FastifyRequest<{ Body: CreateGiftTemplateBody }>} req - Request with template data
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ template }>} Created gift template
 * @throws {400} Bad Request - Invalid input data
 * @throws {500} Internal Server Error - Failed to create template
 */
export const adminCreate = async (
  req: FastifyRequest<{ Body: CreateGiftTemplateBody }>,
  reply: FastifyReply
) => {
  try {
    const body = req.body
    
    // Validation
    if (!body.title || !body.suggestedStars) {
      return reply.status(400).send({ error: 'Title and suggested stars are required' })
    }
    
    if (body.type === 'amazon_product' && !body.provider) {
      return reply.status(400).send({ error: 'Provider is required for Amazon products' })
    }
    
    // Generate affiliate URL if ASIN and tag provided
    let affiliateUrl = body.affiliateUrl
    if (body.type === 'amazon_product' && body.provider === 'amazon_associates' && body.amazonAsin && body.affiliateTag) {
      affiliateUrl = `https://amazon.co.uk/dp/${body.amazonAsin}?tag=${body.affiliateTag}`
    }
    
    const template = await prisma.giftTemplate.create({
      data: {
        type: body.type,
        provider: body.provider || null,
        amazonAsin: body.amazonAsin || null,
        affiliateUrl: affiliateUrl || body.affiliateUrl || null,
        affiliateTag: body.affiliateTag || null,
        sitestripeUrl: body.sitestripeUrl || null,
        title: body.title,
        description: body.description || null,
        imageUrl: body.imageUrl || null,
        category: body.category || null,
        suggestedAgeRanges: body.suggestedAgeRanges || null,
        suggestedGender: body.suggestedGender || null,
        pricePence: body.pricePence || null,
        suggestedStars: body.suggestedStars,
        active: body.active !== undefined ? body.active : true,
        featured: body.featured !== undefined ? body.featured : false
      }
    })
    
    return { template }
  } catch (error) {
    console.error('Error creating gift template:', error)
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, 'Failed to create gift template', 500)
  }
}

/**
 * Update a gift template (admin only)
 * @route PATCH /admin/gift-templates/:id
 * @description Updates an existing gift template
 * @param {FastifyRequest<{ Params: { id: string }; Body: UpdateGiftTemplateBody }>} req - Request with template ID and update data
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ template }>} Updated gift template
 * @throws {404} Not Found - Template not found
 * @throws {500} Internal Server Error - Failed to update template
 */
export const adminUpdate = async (
  req: FastifyRequest<{ Params: { id: string }; Body: UpdateGiftTemplateBody }>,
  reply: FastifyReply
) => {
  try {
    const { id } = req.params
    const body = req.body
    
    // Check if template exists
    const existing = await prisma.giftTemplate.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ error: 'Gift template not found' })
    }
    
    // Generate affiliate URL if ASIN and tag provided
    let affiliateUrl = body.affiliateUrl
    if (body.type === 'amazon_product' && body.provider === 'amazon_associates' && body.amazonAsin && body.affiliateTag) {
      affiliateUrl = `https://amazon.co.uk/dp/${body.amazonAsin}?tag=${body.affiliateTag}`
    }
    
    const updateData: any = {}
    
    if (body.type !== undefined) updateData.type = body.type
    if (body.provider !== undefined) updateData.provider = body.provider
    if (body.amazonAsin !== undefined) updateData.amazonAsin = body.amazonAsin
    if (affiliateUrl !== undefined) updateData.affiliateUrl = affiliateUrl
    if (body.affiliateTag !== undefined) updateData.affiliateTag = body.affiliateTag
    if (body.sitestripeUrl !== undefined) updateData.sitestripeUrl = body.sitestripeUrl
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl
    if (body.category !== undefined) updateData.category = body.category
    if (body.suggestedAgeRanges !== undefined) updateData.suggestedAgeRanges = body.suggestedAgeRanges
    if (body.suggestedGender !== undefined) updateData.suggestedGender = body.suggestedGender
    if (body.pricePence !== undefined) updateData.pricePence = body.pricePence
    if (body.suggestedStars !== undefined) updateData.suggestedStars = body.suggestedStars
    if (body.active !== undefined) updateData.active = body.active
    if (body.featured !== undefined) updateData.featured = body.featured
    
    const template = await prisma.giftTemplate.update({
      where: { id },
      data: updateData
    })
    
    return { template }
  } catch (error) {
    console.error('Error updating gift template:', error)
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, 'Failed to update gift template', 500)
  }
}

/**
 * Delete a gift template (admin only)
 * @route DELETE /admin/gift-templates/:id
 * @description Deletes a gift template (soft delete by setting active=false, or hard delete if no family gifts reference it)
 * @param {FastifyRequest<{ Params: { id: string } }>} req - Request with template ID
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ message }>} Success message
 * @throws {404} Not Found - Template not found
 * @throws {400} Bad Request - Template is in use by family gifts
 * @throws {500} Internal Server Error - Failed to delete template
 */
export const adminDelete = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const { id } = req.params
    
    // Check if template exists
    const existing = await prisma.giftTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: { familyGifts: true }
        }
      }
    })
    
    if (!existing) {
      return reply.status(404).send({ error: 'Gift template not found' })
    }
    
    // If template is used by family gifts, deactivate instead of delete
    if (existing._count.familyGifts > 0) {
      await prisma.giftTemplate.update({
        where: { id },
        data: { active: false }
      })
      return { message: 'Template deactivated (in use by family gifts)' }
    }
    
    // Otherwise, hard delete
    await prisma.giftTemplate.delete({
      where: { id }
    })
    
    return { message: 'Gift template deleted successfully' }
  } catch (error) {
    console.error('Error deleting gift template:', error)
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, 'Failed to delete gift template', 500)
  }
}

/**
 * Generate affiliate URL from ASIN and tag (admin only)
 * @route POST /admin/gift-templates/generate-affiliate-url
 * @description Generates an Amazon Associates affiliate URL from ASIN and tracking tag
 * @param {FastifyRequest<{ Body: { amazonAsin: string; affiliateTag: string } }>} req - Request with ASIN and tag
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ affiliateUrl }>} Generated affiliate URL
 */
export const adminGenerateAffiliateUrl = async (
  req: FastifyRequest<{ Body: { amazonAsin: string; affiliateTag: string } }>,
  reply: FastifyReply
) => {
  try {
    const { amazonAsin, affiliateTag } = req.body
    
    if (!amazonAsin || !affiliateTag) {
      return reply.status(400).send({ error: 'ASIN and affiliate tag are required' })
    }
    
    const affiliateUrl = `https://amazon.co.uk/dp/${amazonAsin}?tag=${affiliateTag}`
    
    return { affiliateUrl }
  } catch (error) {
    console.error('Error generating affiliate URL:', error)
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, 'Failed to generate affiliate URL', 500)
  }
}

/**
 * List gift templates (read-only for users)
 * @route GET /gift-templates
 * @description Browse available gift templates that parents can select from
 * @param {FastifyRequest<{ Querystring: { type?: string; category?: string; age?: string; gender?: string; featured?: string } }>} req - Request with optional filters
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<{ templates }>} List of active gift templates
 */
export const userList = async (
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
    // Note: JSON array filtering in Prisma - we'll filter in application layer if needed
    // For now, we'll do a simple match on the JSON field
    if (age) {
      // Prisma doesn't have direct array_contains for JSON
      // We'll filter in application layer or use raw query if needed
      // For MVP, we'll skip complex age filtering
    }
    
    // Gender filtering
    if (gender) {
      const genderConditions: any[] = [
        { suggestedGender: gender },
        { suggestedGender: 'both' },
        { suggestedGender: 'unisex' },
        { suggestedGender: null }
      ]
      whereClause.OR = whereClause.OR ? [...whereClause.OR, ...genderConditions] : genderConditions
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

