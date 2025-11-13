/**
 * Bonus Processor Job
 * 
 * Processes bonuses that need to be checked periodically:
 * - Perfect Week Bonuses (runs Sunday night/Monday morning)
 * - Monthly Milestone Bonuses (runs on 1st of month)
 * 
 * Note: Achievement, Birthday, and Surprise bonuses are handled
 * in the completion approval flow (api/src/controllers/completions.ts)
 */

import { Job } from 'bullmq'
import { prisma } from '../db/prisma.js'

interface BonusResult {
  bonusMoneyPence: number
  bonusStars: number
  shouldAward: boolean
  bonusType: string
  reason?: string
}

/**
 * Check and award perfect week bonus if all chores completed this week
 */
async function checkPerfectWeekBonus(
  familyId: string,
  childId: string
): Promise<BonusResult> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: {
      perfectWeekBonusEnabled: true,
      perfectWeekBonusMoneyPence: true,
      perfectWeekBonusStars: true,
      perfectWeekBonusType: true
    }
  })

  if (!family || !family.perfectWeekBonusEnabled) {
    return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'perfect_week' }
  }

  // Get start of current week (Monday)
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  const startOfWeek = new Date(today.setDate(diff))
  startOfWeek.setHours(0, 0, 0, 0)

  // Only check perfect week bonus on Sunday (end of week) or Monday (start of new week checking last week)
  const currentDay = today.getDay()
  if (currentDay !== 0 && currentDay !== 1) {
    return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'perfect_week' }
  }

  // If it's Monday, check last week instead
  let weekToCheck = startOfWeek
  if (currentDay === 1) {
    weekToCheck = new Date(startOfWeek)
    weekToCheck.setDate(weekToCheck.getDate() - 7)
  }

  const endOfWeek = new Date(weekToCheck)
  endOfWeek.setDate(endOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  // Get all daily chore assignments for this child from the week
  const assignments = await prisma.assignment.findMany({
    where: {
      familyId,
      childId,
      createdAt: { gte: weekToCheck, lte: endOfWeek },
      chore: {
        frequency: 'daily',
        active: true
      }
    },
    include: {
      completions: {
        where: {
          status: 'approved',
          timestamp: { gte: weekToCheck, lte: endOfWeek }
        }
      }
    }
  })

  if (assignments.length === 0) {
    return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'perfect_week' }
  }

  // Check if all assignments have been completed
  const allCompleted = assignments.every(assignment => assignment.completions.length > 0)

  if (!allCompleted) {
    return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'perfect_week' }
  }

  // Check if we've already awarded perfect week bonus this week
  const wallet = await prisma.wallet.findFirst({
    where: { familyId, childId },
    select: { id: true }
  })

  if (wallet) {
    const existingBonuses = await prisma.transaction.findMany({
      where: {
        walletId: wallet.id,
        familyId,
        source: 'system',
        createdAt: { gte: weekToCheck },
        metaJson: {
          path: ['type'],
          equals: 'perfect_week_bonus'
        }
      }
    })

    if (existingBonuses.length > 0) {
      return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'perfect_week' }
    }
  }

  // Calculate bonus based on type
  let bonusMoneyPence = 0
  let bonusStars = 0

  if (family.perfectWeekBonusType === 'money' || family.perfectWeekBonusType === 'both') {
    bonusMoneyPence = family.perfectWeekBonusMoneyPence
  }

  if (family.perfectWeekBonusType === 'stars' || family.perfectWeekBonusType === 'both') {
    bonusStars = family.perfectWeekBonusStars
  }

  return {
    bonusMoneyPence,
    bonusStars,
    shouldAward: true,
    bonusType: 'perfect_week',
    reason: `Perfect week! All chores completed! ⭐`
  }
}

/**
 * Check and award monthly milestone bonus
 */
async function checkMonthlyBonus(
  familyId: string,
  childId: string
): Promise<BonusResult> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: {
      monthlyBonusEnabled: true,
      monthlyBonusMoneyPence: true,
      monthlyBonusStars: true,
      monthlyBonusType: true
    }
  })

  if (!family || !family.monthlyBonusEnabled) {
    return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'monthly' }
  }

  // Get start of current month
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  startOfMonth.setHours(0, 0, 0, 0)

  // Count completions this month
  const monthlyCompletions = await prisma.completion.count({
    where: {
      familyId,
      childId,
      status: 'approved',
      timestamp: { gte: startOfMonth }
    }
  })

  // Award bonus at milestones: 10, 25, 50, 100 completions
  const milestones = [10, 25, 50, 100]
  const milestoneReached = milestones.find(m => monthlyCompletions === m)

  if (!milestoneReached) {
    return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'monthly' }
  }

  // Check if we've already awarded bonus for this milestone
  const wallet = await prisma.wallet.findFirst({
    where: { familyId, childId },
    select: { id: true }
  })

  if (wallet) {
    const existingBonuses = await prisma.transaction.findMany({
      where: {
        walletId: wallet.id,
        familyId,
        source: 'system',
        createdAt: { gte: startOfMonth },
        metaJson: {
          path: ['type'],
          equals: 'monthly_bonus'
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    for (const bonus of existingBonuses) {
      const meta = bonus.metaJson as any
      if (meta?.milestoneCompletions === milestoneReached) {
        return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'monthly' }
      }
    }
  }

  // Calculate bonus based on type
  let bonusMoneyPence = 0
  let bonusStars = 0

  if (family.monthlyBonusType === 'money' || family.monthlyBonusType === 'both') {
    bonusMoneyPence = family.monthlyBonusMoneyPence
  }

  if (family.monthlyBonusType === 'stars' || family.monthlyBonusType === 'both') {
    bonusStars = family.monthlyBonusStars
  }

  return {
    bonusMoneyPence,
    bonusStars,
    shouldAward: true,
    bonusType: 'monthly',
    reason: `${milestoneReached} chores completed this month! 📅`
  }
}

interface BonusProcessorJobData {
  type?: 'perfect_week' | 'monthly' | 'all'
  familyId?: string // Optional: process specific family
  dryRun?: boolean
}

export async function bonusProcessor(job: Job<BonusProcessorJobData>) {
  const { type = 'all', familyId, dryRun = false } = job.data
  
  console.log(`🎁 Starting bonus processor job...`, { type, familyId, dryRun })
  
  try {
    const results = {
      familiesProcessed: 0,
      perfectWeekBonusesAwarded: 0,
      monthlyBonusesAwarded: 0,
      errors: [] as string[]
    }

    // Get families with bonus settings enabled
    const families = await prisma.family.findMany({
      where: familyId ? { id: familyId } : {
        OR: [
          { perfectWeekBonusEnabled: true },
          { monthlyBonusEnabled: true }
        ]
      },
      select: {
        id: true,
        nameCipher: true,
        perfectWeekBonusEnabled: true,
        monthlyBonusEnabled: true,
        children: {
          where: { paused: false },
          select: {
            id: true,
            nickname: true,
            familyId: true
          }
        }
      }
    })

    if (families.length === 0) {
      console.log('📭 No families found with bonus settings enabled')
      return results
    }

    console.log(`👨‍👩‍👧‍👦 Processing ${families.length} families...`)

    const today = new Date()
    const currentDay = today.getDay()
    const isSunday = currentDay === 0
    const isMonday = currentDay === 1
    const isFirstOfMonth = today.getDate() === 1

    for (const family of families) {
      try {
        console.log(`\n🏠 Processing family: ${family.id}`)

        for (const child of family.children) {
          try {
            // Process Perfect Week Bonus (only on Sunday or Monday)
            if ((type === 'all' || type === 'perfect_week') && family.perfectWeekBonusEnabled && (isSunday || isMonday)) {
              const perfectWeekBonus = await checkPerfectWeekBonus(family.id, child.id)
              
              if (perfectWeekBonus.shouldAward && !dryRun) {
                // Award the bonus
                const wallet = await prisma.wallet.findFirst({
                  where: { familyId: family.id, childId: child.id }
                })

                if (wallet) {
                  const updateData: any = {}
                  if (perfectWeekBonus.bonusMoneyPence > 0) {
                    updateData.balancePence = { increment: perfectWeekBonus.bonusMoneyPence }
                  }
                  if (perfectWeekBonus.bonusStars > 0) {
                    updateData.stars = { increment: perfectWeekBonus.bonusStars }
                  }

                  if (Object.keys(updateData).length > 0) {
                    await prisma.wallet.update({
                      where: { id: wallet.id },
                      data: updateData
                    })

                    // Create transaction
                    if (perfectWeekBonus.bonusMoneyPence > 0) {
                      await prisma.transaction.create({
                        data: {
                          walletId: wallet.id,
                          familyId: family.id,
                          type: 'credit',
                          amountPence: perfectWeekBonus.bonusMoneyPence,
                          source: 'system',
                          metaJson: {
                            type: 'perfect_week_bonus',
                            bonusMoneyPence: perfectWeekBonus.bonusMoneyPence,
                            bonusStars: perfectWeekBonus.bonusStars,
                            reason: perfectWeekBonus.reason
                          }
                        }
                      })
                    }

                    // Create audit log
                    await prisma.auditLog.create({
                      data: {
                        familyId: family.id,
                        actorId: null, // System action
                        action: 'perfect_week_bonus_awarded',
                        target: child.id,
                        metaJson: {
                          childNickname: child.nickname,
                          bonusMoneyPence: perfectWeekBonus.bonusMoneyPence,
                          bonusStars: perfectWeekBonus.bonusStars,
                          reason: perfectWeekBonus.reason
                        }
                      }
                    })

                    results.perfectWeekBonusesAwarded++
                    console.log(`⭐ Awarded perfect week bonus to ${child.nickname}`)
                  }
                }
              }
            }

            // Process Monthly Bonus (only on 1st of month)
            if ((type === 'all' || type === 'monthly') && family.monthlyBonusEnabled && isFirstOfMonth) {
              const monthlyBonus = await checkMonthlyBonus(family.id, child.id)
              
              if (monthlyBonus.shouldAward && !dryRun) {
                // Award the bonus
                const wallet = await prisma.wallet.findFirst({
                  where: { familyId: family.id, childId: child.id }
                })

                if (wallet) {
                  const updateData: any = {}
                  if (monthlyBonus.bonusMoneyPence > 0) {
                    updateData.balancePence = { increment: monthlyBonus.bonusMoneyPence }
                  }
                  if (monthlyBonus.bonusStars > 0) {
                    updateData.stars = { increment: monthlyBonus.bonusStars }
                  }

                  if (Object.keys(updateData).length > 0) {
                    await prisma.wallet.update({
                      where: { id: wallet.id },
                      data: updateData
                    })

                    // Create transaction
                    if (monthlyBonus.bonusMoneyPence > 0) {
                      await prisma.transaction.create({
                        data: {
                          walletId: wallet.id,
                          familyId: family.id,
                          type: 'credit',
                          amountPence: monthlyBonus.bonusMoneyPence,
                          source: 'system',
                          metaJson: {
                            type: 'monthly_bonus',
                            bonusMoneyPence: monthlyBonus.bonusMoneyPence,
                            bonusStars: monthlyBonus.bonusStars,
                            reason: monthlyBonus.reason
                          }
                        }
                      })
                    }

                    // Create audit log
                    await prisma.auditLog.create({
                      data: {
                        familyId: family.id,
                        actorId: null, // System action
                        action: 'monthly_bonus_awarded',
                        target: child.id,
                        metaJson: {
                          childNickname: child.nickname,
                          bonusMoneyPence: monthlyBonus.bonusMoneyPence,
                          bonusStars: monthlyBonus.bonusStars,
                          reason: monthlyBonus.reason
                        }
                      }
                    })

                    results.monthlyBonusesAwarded++
                    console.log(`📅 Awarded monthly bonus to ${child.nickname}`)
                  }
                }
              }
            }

          } catch (error) {
            const errorMsg = `Failed to process bonuses for child ${child.nickname}: ${error instanceof Error ? error.message : 'Unknown error'}`
            console.error(`❌ ${errorMsg}`)
            results.errors.push(errorMsg)
          }
        }

        results.familiesProcessed++

      } catch (error) {
        const errorMsg = `Failed to process family ${family.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(`❌ ${errorMsg}`)
        results.errors.push(errorMsg)
      }
    }

    console.log(`\n🎉 Bonus processor job complete!`)
    console.log(`📊 Results:`, results)

    return {
      ...results,
      timestamp: new Date().toISOString(),
      dryRun
    }

  } catch (error) {
    console.error('💥 Bonus processor job failed:', error)
    throw error
  }
}

