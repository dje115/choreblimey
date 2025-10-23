import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

interface CreateProductBody {
  title: string
  description?: string
  imageUrl?: string
  affiliateUrl: string
  pricePence?: number
  ageTag: 'toddler_2_4' | 'kid_5_8' | 'tween_9_11' | 'teen_12_15' | 'young_adult_16_18' | 'all_ages'
  genderTag: 'male' | 'female' | 'both' | 'unisex'
  category?: string
  interestTags?: string[]
  starsRequired?: number
  featured?: boolean
}

interface UpdateProductBody {
  title?: string
  description?: string
  imageUrl?: string
  affiliateUrl?: string
  pricePence?: number
  ageTag?: 'toddler_2_4' | 'kid_5_8' | 'tween_9_11' | 'teen_12_15' | 'young_adult_16_18' | 'all_ages'
  genderTag?: 'male' | 'female' | 'both' | 'unisex'
  category?: string
  interestTags?: string[]
  starsRequired?: number
  featured?: boolean
  blocked?: boolean
}

/**
 * GET /admin/products
 * Get all products with filtering
 */
export const getProducts = async (req: FastifyRequest<{ 
  Querystring: { 
    page?: string
    limit?: string
    ageTag?: string
    genderTag?: string
    category?: string
    featured?: string
    blocked?: string
    search?: string
  }
}>, reply: FastifyReply) => {
  try {
    const { 
      page = '1', 
      limit = '20', 
      ageTag, 
      genderTag, 
      category, 
      featured, 
      blocked,
      search 
    } = req.query

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const where: any = {}
    
    if (ageTag) where.ageTag = ageTag
    if (genderTag) where.genderTag = genderTag
    if (category) where.category = category
    if (featured !== undefined) where.featured = featured === 'true'
    if (blocked !== undefined) where.blocked = blocked === 'true'
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [products, total] = await Promise.all([
      prisma.rewardItem.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [
          { featured: 'desc' },
          { popularityScore: 'desc' },
          { createdAt: 'desc' }
        ]
      }),
      prisma.rewardItem.count({ where })
    ])

    return {
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }
  } catch (error) {
    console.error('Error getting products:', error)
    reply.status(500).send({ error: 'Failed to get products' })
  }
}

/**
 * POST /admin/products
 * Create a new product
 */
export const createProduct = async (req: FastifyRequest<{ Body: CreateProductBody }>, reply: FastifyReply) => {
  try {
    const productData = req.body

    // Calculate stars required if not provided
    let starsRequired = productData.starsRequired
    if (!starsRequired && productData.pricePence) {
      // Simple calculation: 1 star per £1 (100 pence)
      starsRequired = Math.ceil(productData.pricePence / 100)
    }

    const product = await prisma.rewardItem.create({
      data: {
        provider: 'custom',
        title: productData.title,
        description: productData.description,
        imageUrl: productData.imageUrl,
        affiliateUrl: productData.affiliateUrl,
        pricePence: productData.pricePence,
        ageTag: productData.ageTag,
        genderTag: productData.genderTag,
        category: productData.category,
        interestTags: productData.interestTags ? JSON.stringify(productData.interestTags) : null,
        starsRequired: starsRequired || 10, // Default to 10 stars
        featured: productData.featured || false,
        blocked: false,
        popularityScore: 0.0
      }
    })

    return { success: true, product }
  } catch (error) {
    console.error('Error creating product:', error)
    reply.status(500).send({ error: 'Failed to create product' })
  }
}

/**
 * GET /admin/products/:id
 * Get a specific product
 */
export const getProduct = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { id } = req.params
    const product = await prisma.rewardItem.findUnique({
      where: { id }
    })

    if (!product) {
      return reply.status(404).send({ error: 'Product not found' })
    }

    return { product }
  } catch (error) {
    console.error('Error getting product:', error)
    reply.status(500).send({ error: 'Failed to get product' })
  }
}

/**
 * PATCH /admin/products/:id
 * Update a product
 */
export const updateProduct = async (req: FastifyRequest<{ 
  Params: { id: string }
  Body: UpdateProductBody 
}>, reply: FastifyReply) => {
  try {
    const { id } = req.params
    const updateData = req.body

    // Calculate stars required if price changed
    if (updateData.pricePence && !updateData.starsRequired) {
      updateData.starsRequired = Math.ceil(updateData.pricePence / 100)
    }

    const product = await prisma.rewardItem.update({
      where: { id },
      data: {
        ...updateData,
        interestTags: updateData.interestTags ? JSON.stringify(updateData.interestTags) : undefined
      }
    })

    return { success: true, product }
  } catch (error) {
    console.error('Error updating product:', error)
    reply.status(500).send({ error: 'Failed to update product' })
  }
}

/**
 * DELETE /admin/products/:id
 * Delete a product
 */
export const deleteProduct = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { id } = req.params
    await prisma.rewardItem.delete({
      where: { id }
    })

    return { success: true }
  } catch (error) {
    console.error('Error deleting product:', error)
    reply.status(500).send({ error: 'Failed to delete product' })
  }
}

/**
 * POST /admin/products/:id/toggle-featured
 * Toggle featured status
 */
export const toggleFeatured = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { id } = req.params
    const product = await prisma.rewardItem.findUnique({
      where: { id },
      select: { featured: true }
    })

    if (!product) {
      return reply.status(404).send({ error: 'Product not found' })
    }

    const updatedProduct = await prisma.rewardItem.update({
      where: { id },
      data: { featured: !product.featured }
    })

    return { success: true, featured: updatedProduct.featured }
  } catch (error) {
    console.error('Error toggling featured status:', error)
    reply.status(500).send({ error: 'Failed to toggle featured status' })
  }
}

/**
 * POST /admin/products/:id/toggle-blocked
 * Toggle blocked status
 */
export const toggleBlocked = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { id } = req.params
    const product = await prisma.rewardItem.findUnique({
      where: { id },
      select: { blocked: true }
    })

    if (!product) {
      return reply.status(404).send({ error: 'Product not found' })
    }

    const updatedProduct = await prisma.rewardItem.update({
      where: { id },
      data: { blocked: !product.blocked }
    })

    return { success: true, blocked: updatedProduct.blocked }
  } catch (error) {
    console.error('Error toggling blocked status:', error)
    reply.status(500).send({ error: 'Failed to toggle blocked status' })
  }
}

