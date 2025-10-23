/**
 * Nightly Reward Sync Job
 * 
 * Syncs reward items from affiliate providers (Amazon PA-API, etc.)
 * Runs at 3:00 AM daily
 */

import { Job } from 'bullmq'
import { prisma } from '../db/prisma.js'

interface SyncRewardsJobData {
  provider?: string // Optional: sync specific provider
  forceRefresh?: boolean
}

export async function syncRewards(job: Job<SyncRewardsJobData>) {
  const { provider, forceRefresh } = job.data
  
  console.log(`🔄 Starting reward sync job...`, { provider, forceRefresh })
  
  try {
    // Get enabled reward sources
    const sources = await prisma.rewardSource.findMany({
      where: {
        enabled: true,
        ...(provider && { provider })
      }
    })
    
    if (sources.length === 0) {
      console.log('⚠️  No enabled reward sources found')
      return { synced: 0, message: 'No sources to sync' }
    }
    
    let totalSynced = 0
    const results = []
    
    for (const source of sources) {
      console.log(`📦 Syncing ${source.provider} rewards...`)
      
      try {
        const syncResult = await syncProviderRewards(source, forceRefresh)
        totalSynced += syncResult.count
        results.push({
          provider: source.provider,
          success: true,
          count: syncResult.count
        })
        
        console.log(`✅ Synced ${syncResult.count} rewards from ${source.provider}`)
      } catch (error) {
        console.error(`❌ Failed to sync ${source.provider}:`, error)
        results.push({
          provider: source.provider,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    console.log(`🎉 Reward sync complete: ${totalSynced} total items`)
    
    return {
      synced: totalSynced,
      results,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('💥 Reward sync job failed:', error)
    throw error
  }
}

/**
 * Sync rewards from a specific provider
 * 
 * Implements Amazon PA-API integration for product sync
 */
async function syncProviderRewards(
  source: any,
  forceRefresh: boolean = false
): Promise<{ count: number }> {
  
  if (source.provider !== 'amazon') {
    console.log(`⚠️  Provider ${source.provider} not supported yet`)
    return { count: 0 }
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
    
    console.log(`🛒 Syncing Amazon products for region: ${source.region || 'UK'}`)
    
    // Search for kids' products in different categories
    const categories = [
      { searchIndex: 'ToysAndGames', keywords: 'kids toys educational' },
      { searchIndex: 'Books', keywords: 'children books kids' },
      { searchIndex: 'SportsAndOutdoors', keywords: 'kids sports outdoor' },
      { searchIndex: 'ArtsAndCrafts', keywords: 'kids craft art supplies' }
    ]
    
    let totalSynced = 0
    
    for (const category of categories) {
      try {
        console.log(`🔍 Searching ${category.searchIndex}: ${category.keywords}`)
        
        const items = await paapi.searchItems({
          keywords: category.keywords,
          searchIndex: category.searchIndex,
          itemCount: 25, // Start with smaller batches
          resources: [
            'Images.Primary.Large',
            'ItemInfo.Title',
            'ItemInfo.Features',
            'Offers.Listings.Price',
            'BrowseNodeInfo.BrowseNodes',
            'ItemInfo.Classifications'
          ]
        })
        
        if (items.SearchResult?.Items) {
          console.log(`📦 Found ${items.SearchResult.Items.length} items in ${category.searchIndex}`)
          
          for (const item of items.SearchResult.Items) {
            try {
              const product = await processAmazonProduct(item, source, category.searchIndex)
              if (product) {
                await prisma.rewardItem.upsert({
                  where: { externalId: product.externalId },
                  create: product,
                  update: {
                    pricePence: product.pricePence,
                    priceUpdatedAt: product.priceUpdatedAt,
                    lastSyncedAt: product.lastSyncedAt,
                    title: product.title,
                    imageUrl: product.imageUrl,
                    affiliateUrl: product.affiliateUrl
                  }
                })
                totalSynced++
              }
            } catch (itemError) {
              console.error(`❌ Error processing item ${item.ASIN}:`, itemError)
            }
          }
        }
        
        // Rate limiting: wait between requests
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (categoryError) {
        console.error(`❌ Error searching ${category.searchIndex}:`, categoryError)
      }
    }
    
    console.log(`✅ Synced ${totalSynced} Amazon products`)
    return { count: totalSynced }
    
  } catch (error) {
    console.error('💥 Amazon PA-API sync failed:', error)
    throw error
  }
}

/**
 * Process a single Amazon product into our RewardItem format
 */
async function processAmazonProduct(item: any, source: any, category: string): Promise<any | null> {
  try {
    // Extract basic info
    const asin = item.ASIN
    const title = item.ItemInfo?.Title?.DisplayValue || 'Unknown Product'
    const imageUrl = item.Images?.Primary?.Large?.URL
    const price = item.Offers?.Listings?.[0]?.Price?.Amount
    
    if (!asin || !title) {
      return null
    }
    
    // Build affiliate URL
    const affiliateUrl = `https://amazon.${source.region === 'US' ? 'com' : 'co.uk'}/dp/${asin}?tag=${source.affiliateTag}`
    
    // Infer age tag and category
    const ageTag = inferAgeTag(item, category)
    const productCategory = mapCategory(category)
    
    // Calculate stars required (rough estimate: £1 = 10 stars)
    const starsRequired = price ? Math.max(10, Math.round(price * 10)) : null
    
    return {
      provider: 'amazon',
      externalId: asin,
      title: title,
      description: item.ItemInfo?.Features?.DisplayValues?.[0] || null,
      imageUrl: imageUrl,
      affiliateUrl: affiliateUrl,
      pricePence: price ? Math.round(price * 100) : null,
      priceUpdatedAt: new Date(),
      ageTag: ageTag,
      category: productCategory,
      starsRequired: starsRequired,
      lastSyncedAt: new Date()
    }
    
  } catch (error) {
    console.error('Error processing Amazon product:', error)
    return null
  }
}

/**
 * Map Amazon search index to our category
 */
function mapCategory(searchIndex: string): string {
  const categoryMap: Record<string, string> = {
    'ToysAndGames': 'toys',
    'Books': 'books',
    'SportsAndOutdoors': 'sports',
    'ArtsAndCrafts': 'craft'
  }
  return categoryMap[searchIndex] || 'toys'
}

/**
 * Helper to infer age tag from product data
 */
function inferAgeTag(product: any, category: string): string {
  // Basic age inference based on category and product info
  const title = product.ItemInfo?.Title?.DisplayValue?.toLowerCase() || ''
  const features = product.ItemInfo?.Features?.DisplayValues?.join(' ').toLowerCase() || ''
  const price = product.Offers?.Listings?.[0]?.Price?.Amount || 0
  
  // Age-specific keywords
  const toddlerKeywords = ['baby', 'toddler', '2-3', '3-4', 'preschool']
  const kidKeywords = ['kids', 'children', 'child', '5-8', '6-8', 'elementary']
  const tweenKeywords = ['tween', '9-11', '10-12', 'middle school', 'pre-teen']
  const teenKeywords = ['teen', 'teenager', '12-15', '13-15', 'high school', 'young adult']
  
  const allText = `${title} ${features}`.toLowerCase()
  
  // Check for age indicators
  if (toddlerKeywords.some(keyword => allText.includes(keyword))) {
    return '5-8' // Toddler products for younger kids
  }
  
  if (teenKeywords.some(keyword => allText.includes(keyword))) {
    return '12-15' // Teen products
  }
  
  if (tweenKeywords.some(keyword => allText.includes(keyword))) {
    return '9-11' // Tween products
  }
  
  if (kidKeywords.some(keyword => allText.includes(keyword))) {
    return '5-8' // Kids products
  }
  
  // Price-based inference (rough estimates)
  if (price > 50) {
    return '12-15' // Expensive items likely for teens
  } else if (price > 20) {
    return '9-11' // Mid-range items for tweens
  } else {
    return '5-8' // Cheaper items for kids
  }
}


