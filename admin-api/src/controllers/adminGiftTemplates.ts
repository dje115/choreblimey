import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'
import { fetchAndUploadImage } from '../services/s3Service.js'

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
  recurring?: boolean
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
  recurring?: boolean
}

/**
 * List all gift templates (admin only)
 * @route GET /admin/gift-templates
 */
export const listGiftTemplates = async (
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
    req.log.error(error, 'Failed to list gift templates')
    reply.status(500).send({ error: 'Failed to fetch gift templates' })
  }
}

/**
 * Get a single gift template (admin only)
 * @route GET /admin/gift-templates/:id
 */
export const getGiftTemplate = async (
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
    req.log.error(error, 'Failed to get gift template')
    reply.status(500).send({ error: 'Failed to fetch gift template' })
  }
}

/**
 * Create a new gift template (admin only)
 * @route POST /admin/gift-templates
 */
export const createGiftTemplate = async (
  req: FastifyRequest<{ Body: CreateGiftTemplateBody }>,
  reply: FastifyReply
) => {
  try {
    const body = req.body
    const adminClaims = req.adminClaims
    
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

    // Fetch and store image if imageUrl is provided
    let storedImageUrl = body.imageUrl || null
    if (body.imageUrl && !body.imageUrl.startsWith('http://minio:') && !body.imageUrl.includes('/gift-images/')) {
      try {
        // Only fetch if it's not already stored in S3
        storedImageUrl = await fetchAndUploadImage(body.imageUrl, `${body.title.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`)
        console.log(`✅ Stored image for gift template: ${storedImageUrl}`)
      } catch (error) {
        console.error('⚠️ Failed to fetch and store image, using original URL:', error)
        // Continue with original URL if fetch fails
      }
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
        imageUrl: storedImageUrl,
        category: body.category || null,
        suggestedAgeRanges: body.suggestedAgeRanges && body.suggestedAgeRanges.length > 0 ? body.suggestedAgeRanges : undefined,
        suggestedGender: body.suggestedGender || null,
        pricePence: body.pricePence || null,
        suggestedStars: body.suggestedStars,
        active: body.active !== undefined ? body.active : true,
        featured: body.featured !== undefined ? body.featured : false,
        recurring: body.recurring !== undefined ? body.recurring : false,
        createdBy: adminClaims?.adminId || null
      }
    })
    
    return { template }
  } catch (error) {
    req.log.error(error, 'Failed to create gift template')
    reply.status(500).send({ error: 'Failed to create gift template' })
  }
}

/**
 * Update a gift template (admin only)
 * @route PATCH /admin/gift-templates/:id
 */
export const updateGiftTemplate = async (
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
    
    // Fetch and store image if imageUrl is provided and not already in S3
    if (body.imageUrl !== undefined) {
      if (body.imageUrl && !body.imageUrl.startsWith('http://minio:') && !body.imageUrl.includes('/gift-images/')) {
        try {
          // Fetch and store the image
          const storedImageUrl = await fetchAndUploadImage(body.imageUrl, `${updateData.title || existing.title || 'image'}.jpg`)
          updateData.imageUrl = storedImageUrl
          console.log(`✅ Stored updated image for gift template: ${storedImageUrl}`)
        } catch (error) {
          console.error('⚠️ Failed to fetch and store image, using original URL:', error)
          updateData.imageUrl = body.imageUrl
        }
      } else {
        updateData.imageUrl = body.imageUrl
      }
    }
    if (body.category !== undefined) updateData.category = body.category
    if (body.suggestedAgeRanges !== undefined) updateData.suggestedAgeRanges = body.suggestedAgeRanges
    if (body.suggestedGender !== undefined) updateData.suggestedGender = body.suggestedGender
    if (body.pricePence !== undefined) updateData.pricePence = body.pricePence
    if (body.suggestedStars !== undefined) updateData.suggestedStars = body.suggestedStars
    if (body.active !== undefined) updateData.active = body.active
    if (body.featured !== undefined) updateData.featured = body.featured
    if (body.recurring !== undefined) updateData.recurring = body.recurring
    
    const template = await prisma.giftTemplate.update({
      where: { id },
      data: updateData
    })
    
    return { template }
  } catch (error) {
    req.log.error(error, 'Failed to update gift template')
    reply.status(500).send({ error: 'Failed to update gift template' })
  }
}

/**
 * Delete a gift template (admin only)
 * @route DELETE /admin/gift-templates/:id
 */
export const deleteGiftTemplate = async (
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
    req.log.error(error, 'Failed to delete gift template')
    reply.status(500).send({ error: 'Failed to delete gift template' })
  }
}

/**
 * Generate affiliate URL from ASIN and tag (admin only)
 * @route POST /admin/gift-templates/generate-affiliate-url
 */
export const generateAffiliateUrl = async (
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
    req.log.error(error, 'Failed to generate affiliate URL')
    reply.status(500).send({ error: 'Failed to generate affiliate URL' })
  }
}
