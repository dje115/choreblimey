/**
 * Update Popularity Scores Job
 * 
 * Recalculates popularity scores based on click-through rates
 * Runs every hour
 */

import { Job } from 'bullmq'
import { prisma } from '../db/prisma.js'

export async function updatePopularity(job: Job) {
  console.log(`📊 Starting popularity update job...`)
  
  try {
    // Get all rewards
    const rewards = await prisma.rewardItem.findMany({
      select: {
        id: true,
        popularityScore: true,
        createdAt: true
      }
    })
    
    console.log(`📈 Updating popularity for ${rewards.length} rewards...`)
    
    let updated = 0
    
    for (const reward of rewards) {
      // Calculate CTR (Click-Through Rate) as popularity metric
      const clickCount = await prisma.rewardClick.count({
        where: { rewardId: reward.id }
      })
      
      // Days since creation (for normalization)
      const daysSinceCreated = Math.max(
        1,
        Math.floor(
          (Date.now() - new Date(reward.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        )
      )
      
      // Calculate popularity score
      // Formula: clicks per day, normalized to 0-1 scale
      // We assume 10+ clicks/day = 1.0 score
      const clicksPerDay = clickCount / daysSinceCreated
      const newScore = Math.min(1.0, clicksPerDay / 10)
      
      // Only update if score changed significantly (>0.01 difference)
      if (Math.abs(newScore - reward.popularityScore) > 0.01) {
        await prisma.rewardItem.update({
          where: { id: reward.id },
          data: { popularityScore: newScore }
        })
        updated++
      }
    }
    
    console.log(`✅ Updated ${updated} popularity scores`)
    
    return {
      totalRewards: rewards.length,
      updated,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('💥 Popularity update job failed:', error)
    throw error
  }
}


