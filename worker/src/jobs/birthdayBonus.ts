/**
 * Birthday Bonus Job
 * 
 * Checks for children whose birthday is today and awards bonus stars
 * Runs daily at 6:00 AM
 */

import { Job } from 'bullmq'
import { prisma } from '../db/prisma.js'

const BIRTHDAY_BONUS_STARS = 50 // 50 stars = £5 equivalent

export async function birthdayBonus(job: Job) {
  console.log(`🎂 Starting birthday bonus job...`)
  
  try {
    const today = new Date()
    const currentMonth = today.getMonth() + 1 // 1-12
    const currentDay = today.getDate() // 1-31
    
    // Find children whose birthday is today
    const birthdayChildren = await prisma.child.findMany({
      where: {
        birthMonth: currentMonth
        // Note: We don't store birthDay, only month & year for privacy
        // So we award bonus on the 1st of their birth month
      },
      include: {
        family: {
          include: {
            parentRewardPreferences: true
          }
        }
      }
    })
    
    // Filter to only award on the 1st of the month
    const eligibleChildren = currentDay === 1 ? birthdayChildren : []
    
    if (eligibleChildren.length === 0) {
      console.log('🎈 No birthday bonuses to award today')
      return {
        awarded: 0,
        message: 'No birthdays today',
        timestamp: new Date().toISOString()
      }
    }
    
    console.log(`🎉 Found ${eligibleChildren.length} birthday children!`)
    
    let awarded = 0
    
    for (const child of eligibleChildren) {
      // Check if birthday bonus is enabled for this family
      const prefs = child.family.parentRewardPreferences
      if (prefs && !prefs.birthdayBonusEnabled) {
        console.log(`⏭️  Birthday bonus disabled for ${child.nickname}'s family`)
        continue
      }
      
      // Check if they already received bonus this month
      const existingBonus = await prisma.walletTransaction.findFirst({
        where: {
          childId: child.id,
          type: 'bonus',
          metadata: {
            path: ['reason'],
            equals: 'birthday'
          },
          createdAt: {
            gte: new Date(today.getFullYear(), today.getMonth(), 1)
          }
        }
      })
      
      if (existingBonus) {
        console.log(`⏭️  ${child.nickname} already received birthday bonus this month`)
        continue
      }
      
      // Award birthday bonus
      const bonusAmountPence = BIRTHDAY_BONUS_STARS * 10 // 50 stars = 500 pence
      
      // Get or create wallet
      let wallet = await prisma.wallet.findFirst({
        where: {
          childId: child.id,
          familyId: child.familyId
        }
      })
      
      if (!wallet) {
        wallet = await prisma.wallet.create({
          data: {
            childId: child.id,
            familyId: child.familyId,
            balancePence: 0
          }
        })
      }
      
      // Credit wallet
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balancePence: { increment: bonusAmountPence }
        }
      })
      
      // Create transaction record
      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'bonus',
          amountPence: bonusAmountPence,
          description: `🎂 Birthday Bonus - Happy Birthday ${child.nickname}!`,
          metadata: {
            reason: 'birthday',
            stars: BIRTHDAY_BONUS_STARS,
            month: currentMonth
          }
        }
      })
      
      awarded++
      console.log(`🎁 Awarded ${BIRTHDAY_BONUS_STARS}⭐ birthday bonus to ${child.nickname}`)
    }
    
    console.log(`✅ Birthday bonus job complete: ${awarded} bonuses awarded`)
    
    return {
      awarded,
      totalChecked: birthdayChildren.length,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('💥 Birthday bonus job failed:', error)
    throw error
  }
}


