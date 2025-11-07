import type { FastifyReply, FastifyRequest } from 'fastify'
import { resolveAmazonProduct } from '../utils/amazonProduct.js'
import { getAffiliateConfig } from '../utils/affiliateConfig.js'

interface ResolveBody {
  url?: string
}

export const resolve = async (
  req: FastifyRequest<{ Body: ResolveBody }>,
  reply: FastifyReply
) => {
  try {
    const claims = req.claims
    if (!claims || claims.role === 'child_player') {
      return reply.status(403).send({ error: 'Only adults can create Amazon gifts' })
    }

    const url = req.body?.url?.trim()
    if (!url) {
      return reply.status(400).send({ error: 'Amazon product URL is required' })
    }

    const product = await resolveAmazonProduct({ url })
    const config = await getAffiliateConfig()

    return {
      product: {
        asin: product.asin,
        affiliateLink: product.affiliateLink,
        title: product.title || '',
        image: product.image || config.defaultImageUrl || null,
        shortDescription: product.shortDescription || '',
        source: product.source,
        price: product.price || null,
        currency: product.currency || null
      }
    }
  } catch (error: any) {
    req.log.error(error, 'Failed to resolve Amazon product')
    reply.status(400).send({ error: error?.message || 'Failed to resolve Amazon product' })
  }
}

