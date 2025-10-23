import { FastifyRequest, FastifyReply } from 'fastify'
import { affiliateService } from '../services/affiliateService.js'

interface AffiliateConfigBody {
  primaryProvider: 'amazon_pa_api' | 'sitestripe'
  providers: {
    amazon_pa_api: {
      enabled: boolean
      config: {
        accessKey: string
        secretKey: string
        partnerTag: string
        region: string
      }
    }
    sitestripe: {
      enabled: boolean
      config: {
        apiKey: string
        secretKey: string
        affiliateId: string
        region: string
      }
    }
  }
}

/**
 * GET /admin/affiliate-config
 * Get current affiliate provider configuration
 */
export const getAffiliateConfig = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const config = await affiliateService.loadConfig()
    return { config }
  } catch (error) {
    console.error('Error getting affiliate config:', error)
    reply.status(500).send({ error: 'Failed to get affiliate configuration' })
  }
}

/**
 * POST /admin/affiliate-config
 * Update affiliate provider configuration
 */
export const updateAffiliateConfig = async (req: FastifyRequest<{ Body: AffiliateConfigBody }>, reply: FastifyReply) => {
  try {
    const config = req.body
    await affiliateService.updateConfig(config)
    return { success: true, message: 'Affiliate configuration updated successfully' }
  } catch (error) {
    console.error('Error updating affiliate config:', error)
    reply.status(500).send({ error: 'Failed to update affiliate configuration' })
  }
}

/**
 * POST /admin/test-affiliate
 * Test affiliate provider
 */
export const testAffiliateProvider = async (req: FastifyRequest<{ Body: { provider: 'amazon_pa_api' | 'sitestripe' } }>, reply: FastifyReply) => {
  try {
    const { provider } = req.body
    const result = await affiliateService.testProvider(provider)
    return { 
      success: result.success, 
      message: result.success ? 'Affiliate provider test successful' : 'Affiliate provider test failed',
      result
    }
  } catch (error) {
    console.error('Error testing affiliate provider:', error)
    reply.status(500).send({ error: 'Failed to test affiliate provider' })
  }
}

/**
 * GET /admin/affiliate-providers
 * Get available affiliate providers
 */
export const getAffiliateProviders = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const providers = await affiliateService.getAvailableProviders()
    const primary = await affiliateService.getPrimaryProvider()
    return { providers, primary }
  } catch (error) {
    console.error('Error getting affiliate providers:', error)
    reply.status(500).send({ error: 'Failed to get affiliate providers' })
  }
}

/**
 * POST /admin/search-products
 * Search products using configured provider
 */
export const searchProducts = async (req: FastifyRequest<{ Body: { 
  query: string, 
  category?: string, 
  maxResults?: number,
  ageTag?: 'toddler_2_4' | 'kid_5_8' | 'tween_9_11' | 'teen_12_15' | 'young_adult_16_18' | 'all_ages',
  genderTag?: 'male' | 'female' | 'both' | 'unisex'
} }>, reply: FastifyReply) => {
  try {
    const { query, category, maxResults, ageTag, genderTag } = req.body
    const result = await affiliateService.searchProducts({ query, category, maxResults, ageTag, genderTag })
    return result
  } catch (error) {
    console.error('Error searching products:', error)
    reply.status(500).send({ error: 'Failed to search products' })
  }
}

/**
 * POST /admin/get-product-details
 * Get product details using specified provider
 */
export const getProductDetails = async (req: FastifyRequest<{ Body: { asin: string, provider: 'amazon_pa_api' | 'sitestripe' } }>, reply: FastifyReply) => {
  try {
    const { asin, provider } = req.body
    const result = await affiliateService.getProductDetails({ asin, provider })
    return result
  } catch (error) {
    console.error('Error getting product details:', error)
    reply.status(500).send({ error: 'Failed to get product details' })
  }
}
