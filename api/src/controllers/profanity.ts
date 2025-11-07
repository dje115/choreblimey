/**
 * Profanity Cache Management Controller
 * Allows admin API to invalidate/refresh the profanity cache
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import { invalidateProfanityCache, refreshProfanityCache, getProfanityWords } from '../utils/profanityCache.js'

/**
 * POST /profanity/cache/invalidate
 * Invalidate the profanity cache (internal/admin use)
 */
export const invalidateCache = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    // Simple authentication check - could use API key or secret
    const authHeader = req.headers.authorization
    const expectedToken = process.env.PROFANITY_CACHE_SECRET || 'internal-secret-key'
    
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    
    invalidateProfanityCache()
    
    return {
      success: true,
      message: 'Profanity cache invalidated'
    }
  } catch (error) {
    console.error('Error invalidating profanity cache:', error)
    reply.status(500).send({ error: 'Failed to invalidate cache' })
  }
}

/**
 * POST /profanity/cache/refresh
 * Force refresh the profanity cache (internal/admin use)
 */
export const refreshCache = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    // Simple authentication check
    const authHeader = req.headers.authorization
    const expectedToken = process.env.PROFANITY_CACHE_SECRET || 'internal-secret-key'
    
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    
    const words = await refreshProfanityCache()
    
    return {
      success: true,
      message: 'Profanity cache refreshed',
      wordCount: words.length
    }
  } catch (error) {
    console.error('Error refreshing profanity cache:', error)
    reply.status(500).send({ error: 'Failed to refresh cache' })
  }
}

/**
 * GET /profanity/cache/stats
 * Get cache statistics (internal/admin use)
 */
export const getCacheStats = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const words = await getProfanityWords()
    
    return {
      success: true,
      wordCount: words.length,
      cached: true
    }
  } catch (error) {
    console.error('Error getting cache stats:', error)
    reply.status(500).send({ error: 'Failed to get cache stats' })
  }
}

