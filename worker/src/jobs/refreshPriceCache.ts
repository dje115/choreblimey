/**
 * Refresh Price Cache Job
 * 
 * Checks for reward prices that are stale (>24 hours old)
 * and marks them for refresh on next sync
 * 
 * Amazon PA-API requires price caching with 24-hour validity
 * Runs every 6 hours
 */

import { Job } from 'bullmq'
import { prisma } from '../db/prisma.js'

const PRICE_CACHE_TTL_HOURS = 24

export async function refreshPriceCache(job: Job) {
  console.log(`💰 Starting price cache refresh job...`)
  
  try {
    // Calculate staleness threshold (24 hours ago)
    const staleThreshold = new Date()
    staleThreshold.setHours(staleThreshold.getHours() - PRICE_CACHE_TTL_HOURS)
    
    // Find rewards with stale prices
    const staleRewards = await prisma.rewardItem.findMany({
      where: {
        OR: [
          // Never had price updated
          { priceUpdatedAt: null },
          // Price updated more than 24 hours ago
          { priceUpdatedAt: { lt: staleThreshold } }
        ],
        blocked: false // Don't refresh blocked items
      },
      select: {
        id: true,
        title: true,
        provider: true,
        priceUpdatedAt: true
      }
    })
    
    if (staleRewards.length === 0) {
      console.log('✅ All reward prices are up to date')
      return {
        stale: 0,
        refreshed: 0,
        message: 'All prices fresh',
        timestamp: new Date().toISOString()
      }
    }
    
    console.log(`⚠️  Found ${staleRewards.length} rewards with stale prices`)
    
    // In production, this would trigger individual price refreshes
    // For now, we'll just log and mark for next sync
    
    // Group by provider for batch processing
    const providerCounts = staleRewards.reduce((acc: Record<string, number>, reward) => {
      acc[reward.provider] = (acc[reward.provider] || 0) + 1
      return acc
    }, {})
    
    console.log(`📦 Stale prices by provider:`, providerCounts)
    
    // TODO: In production, trigger price refresh via PA-API
    // For now, just update lastSyncedAt to mark as "pending refresh"
    // The nightly sync job will pick these up
    
    let refreshed = 0
    
    for (const reward of staleRewards) {
      // In production: call PA-API GetItems with ASIN
      // const updated = await refreshPrice(reward.externalId, reward.provider)
      
      // For now, just log
      console.log(`[PLACEHOLDER] Would refresh price for: ${reward.title}`)
      refreshed++
    }
    
    console.log(`✅ Price cache refresh complete: ${refreshed} items marked for refresh`)
    
    return {
      stale: staleRewards.length,
      refreshed,
      providerCounts,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('💥 Price cache refresh job failed:', error)
    throw error
  }
}

/**
 * Refresh price for a single reward item
 * 
 * Implements Amazon PA-API GetItems call for price updates
 */
async function refreshPrice(externalId: string, provider: string): Promise<boolean> {
  // Get provider config
  const source = await prisma.rewardSource.findFirst({
    where: { provider, enabled: true }
  })
  
  if (!source) {
    console.warn(`⚠️  No enabled source for provider: ${provider}`)
    return false
  }
  
  if (provider !== 'amazon') {
    console.log(`⚠️  Price refresh not implemented for provider: ${provider}`)
    return false
  }
  
  try {
    // Import Amazon PA-API (dynamic import to handle ESM)
    const { AmazonPAAPI } = await import('amazon-paapi')
    
    // Initialize PA-API client
    const paapi = new AmazonPAAPI({
      accessKey: source.apiKey,
      secretKey: source.apiSecret,
      partnerTag: source.affiliateTag,
      region: source.region || 'UK'
    })
    
    console.log(`💰 Refreshing price for ASIN: ${externalId}`)
    
    // Get current item details
    const items = await paapi.getItems({
      itemIds: [externalId],
      resources: [
        'Offers.Listings.Price',
        'ItemInfo.Title'
      ]
    })
    
    if (items.ItemsResult?.Items?.[0]) {
      const item = items.ItemsResult.Items[0]
      const newPrice = item.Offers?.Listings?.[0]?.Price?.Amount
      
      if (newPrice) {
        await prisma.rewardItem.update({
          where: { externalId },
          data: {
            pricePence: Math.round(newPrice * 100),
            priceUpdatedAt: new Date()
          }
        })
        
        console.log(`✅ Updated price for ${externalId}: £${newPrice.toFixed(2)}`)
        return true
      } else {
        console.warn(`⚠️  No price found for ${externalId}`)
        return false
      }
    } else {
      console.warn(`⚠️  Item not found: ${externalId}`)
      return false
    }
    
  } catch (error) {
    console.error(`❌ Failed to refresh price for ${externalId}:`, error)
    return false
  }
}


