import Redis from 'ioredis'

// Initialize Redis client for worker
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
  console.error('Worker Redis connection error:', err)
})

redis.on('connect', () => {
  console.log('✅ Worker Redis cache connected')
})

/**
 * Simplified cache utility for worker jobs
 */
export class Cache {
  private redis: Redis

  constructor() {
    this.redis = redis
  }

  /**
   * Invalidate family cache
   */
  async invalidateFamily(familyId: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`family:${familyId}:*`)
      if (keys.length > 0) {
        await this.redis.del(...keys)
        console.log(`🗑️  Invalidated ${keys.length} family cache keys for ${familyId}`)
      }
    } catch (error) {
      console.error('Cache invalidation error:', error)
    }
  }

  /**
   * Invalidate wallet cache
   */
  async invalidateWallet(childId: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`wallet:${childId}:*`)
      if (keys.length > 0) {
        await this.redis.del(...keys)
        console.log(`🗑️  Invalidated ${keys.length} wallet cache keys for ${childId}`)
      }
    } catch (error) {
      console.error('Cache invalidation error:', error)
    }
  }

  /**
   * Invalidate leaderboard cache
   */
  async invalidateLeaderboard(familyId: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`leaderboard:${familyId}:*`)
      if (keys.length > 0) {
        await this.redis.del(...keys)
        console.log(`🗑️  Invalidated ${keys.length} leaderboard cache keys for ${familyId}`)
      }
    } catch (error) {
      console.error('Cache invalidation error:', error)
    }
  }
}

// Export singleton instance
export const cache = new Cache()
