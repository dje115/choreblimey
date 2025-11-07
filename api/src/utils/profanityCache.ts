/**
 * Profanity Words Cache
 * Caches profanity words list in memory for fast access
 */

let profanityWordsCache: string[] | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 10 * 1000 // 10 seconds (reduced from 5 minutes for faster updates)

/**
 * Get profanity words from cache or fetch from database
 */
export async function getProfanityWords(): Promise<string[]> {
  const now = Date.now()
  
  // Return cached words if still valid
  if (profanityWordsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return profanityWordsCache
  }
  
  // Cache expired or not set - fetch from database
  try {
    const { prisma } = await import('../db/prisma.js')
    const words = await prisma.profanityWord.findMany({
      select: { word: true },
      orderBy: { word: 'asc' }
    })
    
    profanityWordsCache = words.map(w => w.word)
    cacheTimestamp = now
    
    console.log(`📝 Profanity cache refreshed: ${profanityWordsCache.length} words`)
    return profanityWordsCache
  } catch (error) {
    console.error('Failed to fetch profanity words:', error)
    // Return cached words even if expired, or empty array
    return profanityWordsCache || []
  }
}

/**
 * Invalidate the profanity words cache
 */
export function invalidateProfanityCache(): void {
  profanityWordsCache = null
  cacheTimestamp = 0
  console.log('🔄 Profanity cache invalidated')
}

/**
 * Force refresh the profanity cache (bypass TTL)
 */
export async function refreshProfanityCache(): Promise<string[]> {
  invalidateProfanityCache()
  return await getProfanityWords()
}

/**
 * Preload profanity words cache (call on server startup)
 */
export async function preloadProfanityCache(): Promise<void> {
  try {
    await getProfanityWords()
    console.log(`✅ Profanity words cache loaded: ${profanityWordsCache?.length || 0} words`)
  } catch (error) {
    console.error('Failed to preload profanity cache:', error)
  }
}
