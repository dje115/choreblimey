import Redis from 'ioredis'

// Initialize Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000)
    return delay
  }
})

redis.on('error', (err) => {
  console.error('Redis connection error:', err)
})

redis.on('connect', () => {
  console.log('✅ Redis cache connected')
})

/**
 * Cache utility for ChoreBlimey
 * Implements smart caching with automatic invalidation
 */
export class Cache {
  private redis: Redis

  constructor() {
    this.redis = redis
  }

  /**
   * Get a cached value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key)
      if (!value) return null
      return JSON.parse(value) as T
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  /**
   * Set a cached value with TTL (in seconds)
   */
  async set(key: string, value: any, ttl: number): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value))
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  /**
   * Delete a cached value
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key)
    } catch (error) {
      console.error('Cache delete error:', error)
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern)
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error)
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key)
      return result === 1
    } catch (error) {
      console.error('Cache exists error:', error)
      return false
    }
  }

  /**
   * Get or set pattern: Get from cache, or compute and cache
   */
  async getOrSet<T>(
    key: string,
    ttl: number,
    fn: () => Promise<T>
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Compute the value
    const value = await fn()

    // Cache it
    await this.set(key, value, ttl)

    return value
  }

  /**
   * Invalidate all caches for a family
   */
  async invalidateFamily(familyId: string): Promise<void> {
    await Promise.all([
      this.delPattern(`family:${familyId}:*`),
      this.delPattern(`leaderboard:${familyId}`),
      this.delPattern(`children:${familyId}`)
    ])
  }

  /**
   * Invalidate wallet cache for a child
   */
  async invalidateWallet(childId: string): Promise<void> {
    await this.delPattern(`wallet:${childId}*`)
  }

  /**
   * Invalidate leaderboard cache
   */
  async invalidateLeaderboard(familyId: string): Promise<void> {
    await this.del(`leaderboard:${familyId}`)
  }
}

// Export singleton instance
export const cache = new Cache()

// Cache key builders
export const cacheKeys = {
  family: (familyId: string) => `family:${familyId}`,
  familyMembers: (familyId: string) => `family:${familyId}:members`,
  children: (familyId: string) => `children:${familyId}`,
  wallet: (childId: string) => `wallet:${childId}`,
  walletStats: (childId: string) => `wallet:${childId}:stats`,
  leaderboard: (familyId: string) => `leaderboard:${familyId}`,
  streaks: (childId: string) => `streaks:${childId}`,
  chores: (familyId: string) => `chores:${familyId}`,
  assignments: (childId: string) => `assignments:${childId}`
}

// Cache TTLs (in seconds)
export const cacheTTL = {
  family: 60,           // 1 minute
  children: 120,        // 2 minutes
  wallet: 30,           // 30 seconds
  walletStats: 300,     // 5 minutes (rarely changes)
  leaderboard: 300,     // 5 minutes
  streaks: 60,          // 1 minute
  chores: 120,          // 2 minutes
  assignments: 60       // 1 minute
}

