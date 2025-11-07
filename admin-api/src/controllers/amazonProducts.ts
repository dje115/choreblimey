import type { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../db/prisma.js'
import { resolveAmazonProduct } from '../utils/amazonProduct.js'

interface ResolveBody {
  url?: string
}

export const resolve = async (
  req: FastifyRequest<{ Body: ResolveBody }>,
  reply: FastifyReply
) => {
  try {
    const claims = req.claims
    if (!claims || claims.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' })
    }

    const url = req.body?.url?.trim()
    if (!url) {
      return reply.status(400).send({ error: 'Amazon product URL is required' })
    }

    const config = await prisma.affiliateConfig.findFirst({
      orderBy: { createdAt: 'asc' }
    })

    const defaultConfig = {
      amazonEnabled: config?.amazonEnabled ?? false,
      amazonAssociateId: config?.amazonAssociateId ?? null,
      amazonAccessKey: config?.amazonAccessKey ?? null,
      amazonSecretKey: config?.amazonSecretKey ?? null,
      amazonTag: config?.amazonTag ?? null,
      sitestripeTag: config?.sitestripeTag ?? null,
      defaultImageUrl: config?.defaultImageUrl ?? null,
      defaultStarValuePence: config?.defaultStarValuePence ?? 10
    }

    const product = await resolveAmazonProduct({ url, config: defaultConfig })

    const defaultStarValue = defaultConfig.defaultStarValuePence > 0 ? defaultConfig.defaultStarValuePence : 10
    const pricePence = product.pricePence ?? (product.price && product.currency === 'GBP' ? Math.round(product.price * 100) : undefined)
    const suggestedStars = pricePence ? Math.max(1, Math.round(pricePence / defaultStarValue)) : null

    return {
      product: {
        asin: product.asin,
        affiliateLink: product.affiliateLink,
        title: product.title || '',
        image: product.image || defaultConfig.defaultImageUrl || null,
        shortDescription: product.shortDescription || '',
        source: product.source,
        price: product.price || null,
        currency: product.currency || null,
        pricePence: pricePence ?? null,
        category: product.category || null,
        suggestedAgeRanges: product.suggestedAgeRanges || [],
        suggestedGender: product.suggestedGender || null,
        suggestedStars
      }
    }
  } catch (error: any) {
    req.log.error(error, 'Failed to resolve Amazon product')
    reply.status(400).send({ error: error?.message || 'Failed to resolve Amazon product' })
  }
}

