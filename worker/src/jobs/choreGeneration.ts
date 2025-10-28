/**
 * Automated Chore Generation Job
 * 
 * Runs daily at 5:00 AM to:
 * 1. Generate new daily/weekly chores for active children
 * 2. Check for incomplete chores from previous days
 * 3. Apply streak penalties for missed days
 * 4. Award streak bonuses for milestones
 * 5. Handle holiday mode and paused children
 */

import { Job } from 'bullmq'
import { prisma } from '../db/prisma.js'
import { cache } from '../utils/cache.js'

interface ChoreGenerationJobData {
  familyId?: string // Optional: process specific family
  dryRun?: boolean  // Optional: preview changes without applying
}

export async function choreGeneration(job: Job<ChoreGenerationJobData>) {
  const { familyId, dryRun = false } = job.data
  
  console.log(`🏠 Starting automated chore generation...`, { familyId, dryRun })
  
  try {
    const results = {
      familiesProcessed: 0,
      choresGenerated: 0,
      streaksUpdated: 0,
      penaltiesApplied: 0,
      bonusesAwarded: 0,
      pausedChildrenSkipped: 0,
      holidayModeSkipped: 0,
      errors: [] as string[]
    }

    // Get all active families (or specific family)
    const families = await prisma.family.findMany({
      where: familyId ? { id: familyId } : {},
      select: {
        id: true,
        nameCipher: true,
        holidayMode: true,
        holidayStartDate: true,
        holidayEndDate: true,
        children: {
          where: { paused: false }, // Only active children
          select: {
            id: true,
            nickname: true,
            familyId: true,
            paused: true,
            holidayMode: true,
            holidayStartDate: true,
            holidayEndDate: true,
            wallets: true,
            streaks: true
          }
        },
        chores: {
          where: { active: true }
        }
      }
    })

    if (families.length === 0) {
      console.log('📭 No families found to process')
      return results
    }

    console.log(`👨‍👩‍👧‍👦 Processing ${families.length} families...`)

    for (const family of families) {
      try {
        console.log(`\n🏠 Processing family: ${family.id}`)
        
        // Check if family is in holiday mode
        if (isFamilyInHolidayMode(family)) {
          console.log(`🏖️  Family ${family.id} is in holiday mode - skipping`)
          results.holidayModeSkipped++
          continue
        }

        const familyResult = await processFamilyChores(family, dryRun)
        
        // Merge results
        results.familiesProcessed++
        results.choresGenerated += familyResult.choresGenerated
        results.streaksUpdated += familyResult.streaksUpdated
        results.penaltiesApplied += familyResult.penaltiesApplied
        results.bonusesAwarded += familyResult.bonusesAwarded
        results.pausedChildrenSkipped += familyResult.pausedChildrenSkipped
        
        // Invalidate family cache
        if (!dryRun) {
          await cache.invalidateFamily(family.id)
        }

      } catch (error) {
        const errorMsg = `Failed to process family ${family.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(`❌ ${errorMsg}`)
        results.errors.push(errorMsg)
      }
    }

    console.log(`\n🎉 Chore generation complete!`)
    console.log(`📊 Results:`, results)

    return {
      ...results,
      timestamp: new Date().toISOString(),
      dryRun
    }

  } catch (error) {
    console.error('💥 Chore generation job failed:', error)
    throw error
  }
}

/**
 * Process chores for a single family
 */
async function processFamilyChores(family: any, dryRun: boolean) {
  const result = {
    choresGenerated: 0,
    streaksUpdated: 0,
    penaltiesApplied: 0,
    bonusesAwarded: 0,
    pausedChildrenSkipped: 0
  }

  console.log(`👶 Processing ${family.children.length} children...`)

  for (const child of family.children) {
    try {
      // Skip paused children
      if (child.paused) {
        console.log(`⏸️  Child ${child.nickname} is paused - skipping`)
        result.pausedChildrenSkipped++
        continue
      }

      // Check if child is in holiday mode
      if (isChildInHolidayMode(child)) {
        console.log(`🏖️  Child ${child.nickname} is in holiday mode - skipping`)
        continue
      }

      console.log(`\n👶 Processing child: ${child.nickname}`)

      // Process daily chores
      const dailyResult = await processDailyChores(family, child, dryRun)
      result.choresGenerated += dailyResult.choresGenerated
      result.streaksUpdated += dailyResult.streaksUpdated
      result.penaltiesApplied += dailyResult.penaltiesApplied
      result.bonusesAwarded += dailyResult.bonusesAwarded

      // Process weekly chores (only on Mondays)
      if (isMonday()) {
        const weeklyResult = await processWeeklyChores(family, child, dryRun)
        result.choresGenerated += weeklyResult.choresGenerated
        result.streaksUpdated += weeklyResult.streaksUpdated
        result.penaltiesApplied += weeklyResult.penaltiesApplied
        result.bonusesAwarded += weeklyResult.bonusesAwarded
      }

    } catch (error) {
      console.error(`❌ Failed to process child ${child.nickname}:`, error)
    }
  }

  return result
}

/**
 * Process daily chores for a child
 */
async function processDailyChores(family: any, child: any, dryRun: boolean) {
  const result = {
    choresGenerated: 0,
    streaksUpdated: 0,
    penaltiesApplied: 0,
    bonusesAwarded: 0
  }

  // Get daily chores for this family
  const dailyChores = family.chores.filter((chore: any) => chore.frequency === 'daily')
  
  if (dailyChores.length === 0) {
    console.log(`📭 No daily chores found for ${child.nickname}`)
    return result
  }

  console.log(`📅 Processing ${dailyChores.length} daily chores...`)

  for (const chore of dailyChores) {
    try {
      // Check if there's an UNCOMPLETED chore for today
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const existingAssignment = await prisma.assignment.findFirst({
        where: {
          choreId: chore.id,
          familyId: family.id,
          childId: child.id,
          createdAt: {
            gte: today
          }
        },
        include: {
          completions: true
        }
      })

      // If assignment exists and is NOT completed, skip it
      const hasApprovedCompletion = existingAssignment?.completions?.some(
        (c: any) => c.status === 'approved'
      )
      
      if (existingAssignment && !hasApprovedCompletion) {
        console.log(`✅ Daily chore "${chore.title}" already exists for ${child.nickname} (not completed yet)`)
        continue
      }
      
      // If assignment exists and IS completed, we'll create a new one below
      if (existingAssignment && hasApprovedCompletion) {
        console.log(`✅ Daily chore "${chore.title}" was completed by ${child.nickname} - regenerating for next day`)
      }

      // Check if child completed this chore yesterday
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      
      const yesterdayCompletion = await prisma.completion.findFirst({
        where: {
          assignmentId: {
            in: await prisma.assignment.findMany({
              where: {
                choreId: chore.id,
                familyId: family.id,
                childId: child.id,
                createdAt: {
                  gte: yesterday,
                  lt: today
                }
              },
              select: { id: true }
            }).then(assignments => assignments.map(a => a.id))
          },
          childId: child.id,
          status: 'approved'
        }
      })

      if (!yesterdayCompletion) {
        // Child didn't complete yesterday's chore - apply streak penalty
        console.log(`⚠️  ${child.nickname} missed "${chore.title}" yesterday - applying streak penalty`)
        
        if (!dryRun) {
          await applyStreakPenalty(child, chore, 'missed_daily_chore')
        }
        result.penaltiesApplied++
      }

      // Generate new daily chore assignment
      console.log(`🆕 Generating daily chore "${chore.title}" for ${child.nickname}`)
      
      if (!dryRun) {
        await prisma.assignment.create({
          data: {
            choreId: chore.id,
            familyId: family.id,
            childId: child.id,
            biddingEnabled: false
          }
        })
      }
      
      result.choresGenerated++

    } catch (error) {
      console.error(`❌ Failed to process daily chore "${chore.title}":`, error)
    }
  }

  return result
}

/**
 * Process weekly chores for a child (runs on Mondays)
 */
async function processWeeklyChores(family: any, child: any, dryRun: boolean) {
  const result = {
    choresGenerated: 0,
    streaksUpdated: 0,
    penaltiesApplied: 0,
    bonusesAwarded: 0
  }

  // Get weekly chores for this family
  const weeklyChores = family.chores.filter((chore: any) => chore.frequency === 'weekly')
  
  if (weeklyChores.length === 0) {
    console.log(`📭 No weekly chores found for ${child.nickname}`)
    return result
  }

  console.log(`📅 Processing ${weeklyChores.length} weekly chores...`)

  for (const chore of weeklyChores) {
    try {
      // Check if there's an UNCOMPLETED chore for this week
      const startOfWeek = getStartOfWeek()
      
      const existingAssignment = await prisma.assignment.findFirst({
        where: {
          choreId: chore.id,
          familyId: family.id,
          childId: child.id,
          createdAt: {
            gte: startOfWeek
          }
        },
        include: {
          completions: true
        }
      })

      // If assignment exists and is NOT completed, skip it
      const hasApprovedCompletion = existingAssignment?.completions?.some(
        (c: any) => c.status === 'approved'
      )
      
      if (existingAssignment && !hasApprovedCompletion) {
        console.log(`✅ Weekly chore "${chore.title}" already exists for ${child.nickname} (not completed yet)`)
        continue
      }
      
      // If assignment exists and IS completed, we'll create a new one below
      if (existingAssignment && hasApprovedCompletion) {
        console.log(`✅ Weekly chore "${chore.title}" was completed by ${child.nickname} - regenerating for next week`)
      }

      // Check if child completed this chore last week
      const lastWeekStart = new Date(startOfWeek)
      lastWeekStart.setDate(lastWeekStart.getDate() - 7)
      const lastWeekEnd = new Date(startOfWeek)

      const lastWeekCompletion = await prisma.completion.findFirst({
        where: {
          assignmentId: {
            in: await prisma.assignment.findMany({
              where: {
                choreId: chore.id,
                familyId: family.id,
                childId: child.id,
                createdAt: {
                  gte: lastWeekStart,
                  lt: lastWeekEnd
                }
              },
              select: { id: true }
            }).then(assignments => assignments.map(a => a.id))
          },
          childId: child.id,
          status: 'approved'
        }
      })

      if (!lastWeekCompletion) {
        // Child didn't complete last week's chore - apply streak penalty
        console.log(`⚠️  ${child.nickname} missed "${chore.title}" last week - applying streak penalty`)
        
        if (!dryRun) {
          await applyStreakPenalty(child, chore, 'missed_weekly_chore')
        }
        result.penaltiesApplied++
      }

      // Generate new weekly chore assignment
      console.log(`🆕 Generating weekly chore "${chore.title}" for ${child.nickname}`)
      
      if (!dryRun) {
        await prisma.assignment.create({
          data: {
            choreId: chore.id,
            familyId: family.id,
            childId: child.id,
            biddingEnabled: false
          }
        })
      }
      
      result.choresGenerated++

    } catch (error) {
      console.error(`❌ Failed to process weekly chore "${chore.title}":`, error)
    }
  }

  return result
}

/**
 * Apply streak penalty for missed chores
 */
async function applyStreakPenalty(child: any, chore: any, reason: string) {
  try {
    // Find child's wallet
    const wallet = child.wallets?.[0]
    if (!wallet) {
      console.log(`⚠️  No wallet found for ${child.nickname}`)
      return
    }

    // Calculate penalty (e.g., 10% of chore reward)
    const penaltyAmount = Math.floor(chore.baseRewardPence * 0.1) // 10% penalty
    
    if (penaltyAmount <= 0) {
      console.log(`⚠️  Penalty amount too small for ${child.nickname}`)
      return
    }

    // Apply penalty if wallet has sufficient balance
    if (wallet.balancePence >= penaltyAmount) {
      console.log(`💸 Applying ${penaltyAmount} pence penalty to ${child.nickname}`)
      
      // Create penalty transaction
      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          familyId: child.familyId,
          type: 'debit',
          amountPence: penaltyAmount,
          source: 'system',
          metaJson: {
            reason: 'streak_penalty',
            choreId: chore.id,
            choreTitle: chore.title,
            penaltyReason: reason
          }
        }
      })

      // Update wallet balance
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balancePence: wallet.balancePence - penaltyAmount
        }
      })

      // Invalidate wallet cache
      await cache.invalidateWallet(child.id)

    } else {
      console.log(`⚠️  Insufficient balance for penalty: ${wallet.balancePence} < ${penaltyAmount}`)
    }

  } catch (error) {
    console.error(`❌ Failed to apply streak penalty:`, error)
  }
}

/**
 * Check if family is in holiday mode
 */
function isFamilyInHolidayMode(family: any): boolean {
  if (!family.holidayMode) return false
  
  const now = new Date()
  
  // Check if holiday has started
  if (family.holidayStartDate && now < new Date(family.holidayStartDate)) {
    return false
  }
  
  // Check if holiday has ended
  if (family.holidayEndDate && now > new Date(family.holidayEndDate)) {
    return false
  }
  
  return true
}

/**
 * Check if child is in holiday mode
 */
function isChildInHolidayMode(child: any): boolean {
  if (!child.holidayMode) return false
  
  const now = new Date()
  
  // Check if holiday has started
  if (child.holidayStartDate && now < new Date(child.holidayStartDate)) {
    return false
  }
  
  // Check if holiday has ended
  if (child.holidayEndDate && now > new Date(child.holidayEndDate)) {
    return false
  }
  
  return true
}

/**
 * Check if today is Monday
 */
function isMonday(): boolean {
  const today = new Date()
  return today.getDay() === 1 // Monday
}

/**
 * Get start of current week (Monday)
 */
function getStartOfWeek(): Date {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  const startOfWeek = new Date(today.setDate(diff))
  startOfWeek.setHours(0, 0, 0, 0)
  return startOfWeek
}
