/**
 * ChoreBlimey! Worker Service
 * 
 * Handles scheduled background jobs:
 * - Nightly reward sync from affiliate providers
 * - Hourly popularity score updates
 * - Daily birthday bonus awards
 * - Price cache refresh (every 6 hours)
 */

import { Worker, Queue } from 'bullmq'
import Redis from 'ioredis'
import { syncRewards } from './jobs/syncRewards.js'
import { updatePopularity } from './jobs/updatePopularity.js'
import { birthdayBonus } from './jobs/birthdayBonus.js'
import { refreshPriceCache } from './jobs/refreshPriceCache.js'
import { accountCleanup } from './jobs/accountCleanup.js'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:1507'

// Create Redis connections for BullMQ
const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null
})

// Job queue names
const QUEUE_NAMES = {
  REWARDS_SYNC: 'rewards-sync',
  POPULARITY_UPDATE: 'popularity-update',
  BIRTHDAY_BONUS: 'birthday-bonus',
  PRICE_CACHE: 'price-cache',
  ACCOUNT_CLEANUP: 'account-cleanup'
}

// Create queues (BullMQ v5+ handles scheduling automatically, no need for QueueScheduler)
const rewardsSyncQueue = new Queue(QUEUE_NAMES.REWARDS_SYNC, { connection })
const popularityUpdateQueue = new Queue(QUEUE_NAMES.POPULARITY_UPDATE, { connection })
const birthdayBonusQueue = new Queue(QUEUE_NAMES.BIRTHDAY_BONUS, { connection })
const priceCacheQueue = new Queue(QUEUE_NAMES.PRICE_CACHE, { connection })
const accountCleanupQueue = new Queue(QUEUE_NAMES.ACCOUNT_CLEANUP, { connection })

// Create workers
const rewardsSyncWorker = new Worker(
  QUEUE_NAMES.REWARDS_SYNC,
  async (job) => await syncRewards(job),
  { connection }
)

const popularityUpdateWorker = new Worker(
  QUEUE_NAMES.POPULARITY_UPDATE,
  async (job) => await updatePopularity(job),
  { connection }
)

const birthdayBonusWorker = new Worker(
  QUEUE_NAMES.BIRTHDAY_BONUS,
  async (job) => await birthdayBonus(job),
  { connection }
)

const priceCacheWorker = new Worker(
  QUEUE_NAMES.PRICE_CACHE,
  async (job) => await refreshPriceCache(job),
  { connection }
)

const accountCleanupWorker = new Worker(
  QUEUE_NAMES.ACCOUNT_CLEANUP,
  async (job) => await accountCleanup(job),
  { connection }
)

// Worker event handlers
const workers = [
  { name: 'Rewards Sync', worker: rewardsSyncWorker },
  { name: 'Popularity Update', worker: popularityUpdateWorker },
  { name: 'Birthday Bonus', worker: birthdayBonusWorker },
  { name: 'Price Cache', worker: priceCacheWorker },
  { name: 'Account Cleanup', worker: accountCleanupWorker }
]

workers.forEach(({ name, worker }) => {
  worker.on('completed', (job) => {
    console.log(`✅ [${name}] Job ${job.id} completed`)
  })
  
  worker.on('failed', (job, err) => {
    console.error(`❌ [${name}] Job ${job?.id} failed:`, err)
  })
  
  worker.on('error', (err) => {
    console.error(`💥 [${name}] Worker error:`, err)
  })
})

// Schedule repeatable jobs
async function scheduleJobs() {
  console.log('📅 Scheduling jobs...')
  
  // 1. Nightly reward sync at 3:00 AM
  await rewardsSyncQueue.add(
    'nightly-sync',
    {},
    {
      repeat: {
        pattern: '0 3 * * *' // 3:00 AM daily
      }
    }
  )
  console.log('⏰ Scheduled: Nightly reward sync (3:00 AM)')
  
  // 2. Hourly popularity update
  await popularityUpdateQueue.add(
    'hourly-popularity',
    {},
    {
      repeat: {
        pattern: '0 * * * *' // Every hour on the hour
      }
    }
  )
  console.log('⏰ Scheduled: Hourly popularity update')
  
  // 3. Daily birthday bonus at 6:00 AM
  await birthdayBonusQueue.add(
    'daily-birthday-check',
    {},
    {
      repeat: {
        pattern: '0 6 * * *' // 6:00 AM daily
      }
    }
  )
  console.log('⏰ Scheduled: Daily birthday bonus (6:00 AM)')
  
  // 4. Price cache refresh every 6 hours
  await priceCacheQueue.add(
    'price-cache-refresh',
    {},
    {
      repeat: {
        pattern: '0 */6 * * *' // Every 6 hours
      }
    }
  )
  console.log('⏰ Scheduled: Price cache refresh (every 6 hours)')
  
  // 5. Monthly account cleanup on the 1st of each month at 2:00 AM
  await accountCleanupQueue.add(
    'monthly-cleanup',
    {},
    {
      repeat: {
        pattern: '0 2 1 * *' // 2:00 AM on the 1st of each month
      }
    }
  )
  console.log('⏰ Scheduled: Monthly account cleanup (1st of month at 2:00 AM)')
  
  // Optional: Run jobs immediately on startup for testing
  if (process.env.RUN_JOBS_ON_STARTUP === 'true') {
    console.log('🚀 Running jobs immediately on startup...')
    
    await popularityUpdateQueue.add('startup-popularity', {})
    await birthdayBonusQueue.add('startup-birthday', {})
    await priceCacheQueue.add('startup-price-cache', {})
    // Skip reward sync on startup (takes longer, only needed once daily)
  }
}

// Graceful shutdown
async function shutdown() {
  console.log('🛑 Shutting down workers...')
  
  await Promise.all([
    rewardsSyncWorker.close(),
    popularityUpdateWorker.close(),
    birthdayBonusWorker.close(),
    priceCacheWorker.close(),
    accountCleanupWorker.close()
  ])
  
  await Promise.all([
    rewardsSyncQueue.close(),
    popularityUpdateQueue.close(),
    birthdayBonusQueue.close(),
    priceCacheQueue.close(),
    accountCleanupQueue.close()
  ])
  
  await connection.quit()
  
  console.log('✅ Workers shut down gracefully')
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// Start the worker service
async function start() {
  console.log('🚀 ChoreBlimey Worker Service starting...')
  console.log(`📡 Redis: ${REDIS_URL}`)
  
  try {
    await scheduleJobs()
    console.log('✅ Worker service ready!')
    console.log('📊 Monitoring queues:')
    console.log('  - Rewards Sync (nightly at 3:00 AM)')
    console.log('  - Popularity Update (hourly)')
    console.log('  - Birthday Bonus (daily at 6:00 AM)')
    console.log('  - Price Cache Refresh (every 6 hours)')
  } catch (error) {
    console.error('💥 Failed to start worker service:', error)
    process.exit(1)
  }
}

start()

// Export queues for manual job triggering (e.g., via admin API)
export {
  rewardsSyncQueue,
  popularityUpdateQueue,
  birthdayBonusQueue,
  priceCacheQueue
}
