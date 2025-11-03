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
        // Streak settings
        streakProtectionDays: true,
        penaltyEnabled: true,
        firstMissPence: true,
        firstMissStars: true,
        secondMissPence: true,
        secondMissStars: true,
        thirdMissPence: true,
        thirdMissStars: true,
        penaltyType: true,
        minBalancePence: true,
        minBalanceStars: true,
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
        
        // Note: We still process families in holiday mode - chores are generated normally,
        // but penalties and streak breaks are skipped
        
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

      // Note: We still process children in holiday mode - chores are generated normally,
      // but penalties and streak breaks are skipped (checked inside processDailyChores/processWeeklyChores)

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
      // Check if there's an UNCOMPLETED chore assignment for today
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // First check for today's assignment
      const todayAssignment = await prisma.assignment.findFirst({
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

      // If assignment exists for today and is NOT completed, skip creating a new one
      if (todayAssignment) {
        const hasApprovedCompletion = todayAssignment.completions?.some(
          (c: any) => c.status === 'approved'
        )
        
        if (!hasApprovedCompletion) {
          console.log(`✅ Daily chore "${chore.title}" already exists for ${child.nickname} today (not completed yet) - skipping`)
          continue
        }
        
        // If assignment exists and IS completed, we'll create a new one below
        console.log(`✅ Daily chore "${chore.title}" was completed by ${child.nickname} today - regenerating for next day`)
      }

      // Check if child completed this chore yesterday (submitted - pending or approved)
      // Streaks are based on submission, not approval, so we check both statuses
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
          // Check for both pending and approved - children shouldn't lose streaks due to delayed approvals
          status: {
            in: ['pending', 'approved']
          },
          timestamp: {
            gte: yesterday,
            lt: today
          }
        }
      })

      if (!yesterdayCompletion) {
        // Check if holiday mode is/was active (family or child) - if so, skip penalties and protect streaks
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const wasInHolidayMode = isFamilyInHolidayModeOnDate(family, yesterday) || isChildInHolidayModeOnDate(child, yesterday)
        
        if (wasInHolidayMode) {
          console.log(`🏖️  ${child.nickname} missed "${chore.title}" yesterday but was in holiday mode - no penalty, streak protected`)
          // Protect the streak automatically during holiday mode
          if (!dryRun) {
            await protectStreak(family.id, child.id, chore.id, yesterday)
          }
        } else {
          // Child didn't complete yesterday's chore - check if penalty should be applied
          // Calculate consecutive missed days for this chore
          const consecutiveMissedDays = await calculateConsecutiveMissedDays(
            family.id,
            child.id,
            chore.id,
            today
          )
          
          // Check protection days - if within grace period, skip penalty AND protect streak
          const protectionDays = family.streakProtectionDays || 0
          const daysAfterProtection = consecutiveMissedDays - protectionDays
          
          if (daysAfterProtection > 0 && family.penaltyEnabled) {
            console.log(`⚠️  ${child.nickname} missed "${chore.title}" ${consecutiveMissedDays} day(s) in a row (${daysAfterProtection} after protection) - applying streak penalty`)
            
            if (!dryRun) {
              await applyStreakPenalty(family, child, chore, consecutiveMissedDays, 'missed_daily_chore')
            }
            result.penaltiesApplied++
          } else if (daysAfterProtection <= 0) {
            console.log(`🛡️  ${child.nickname} missed "${chore.title}" but is within ${protectionDays} day protection period - no penalty, streak protected`)
            
            // Protect the streak - update lastIncrementDate to yesterday (the missed day)
            // This ensures the streak continues when they complete the next chore
            if (!dryRun) {
              await protectStreak(family.id, child.id, chore.id, yesterday)
            }
          } else {
            console.log(`⚙️  Penalties disabled for family - skipping penalty`)
          }
        }
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

      // Check if child completed this chore last week (submitted - pending or approved)
      // Streaks are based on submission, not approval, so we check both statuses
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
          // Check for both pending and approved - children shouldn't lose streaks due to delayed approvals
          status: {
            in: ['pending', 'approved']
          },
          timestamp: {
            gte: lastWeekStart,
            lt: lastWeekEnd
          }
        }
      })

      if (!lastWeekCompletion) {
        // Check if holiday mode was active during the previous week - if so, skip penalties and protect streaks
        // We check at the start of last week to see if holiday mode was active
        const wasInHolidayMode = isFamilyInHolidayModeOnDate(family, lastWeekStart) || isChildInHolidayModeOnDate(child, lastWeekStart)
        
        if (wasInHolidayMode) {
          console.log(`🏖️  ${child.nickname} missed "${chore.title}" last week but was in holiday mode - no penalty, streak protected`)
          // Protect the streak automatically during holiday mode
          if (!dryRun) {
            await protectStreak(family.id, child.id, chore.id, lastWeekStart)
          }
        } else {
          // Child didn't complete last week's chore - check if penalty should be applied
          // For weekly chores, we treat each missed week as a separate miss
          // (protection days still apply - if protectionDays = 1, first miss is free)
          const consecutiveMissedWeeks = 1 // For weekly, we're checking one week at a time
          
          const daysAfterProtection = consecutiveMissedWeeks - (family.streakProtectionDays || 0)
          
          if (daysAfterProtection > 0 && family.penaltyEnabled) {
            console.log(`⚠️  ${child.nickname} missed "${chore.title}" last week (${daysAfterProtection} after protection) - applying streak penalty`)
            
            if (!dryRun) {
              // For weekly chores, we'll use the first miss penalty (since it's treated as a single event)
              await applyStreakPenalty(family, child, chore, consecutiveMissedWeeks, 'missed_weekly_chore')
            }
            result.penaltiesApplied++
          } else if (daysAfterProtection <= 0) {
            console.log(`🛡️  ${child.nickname} missed "${chore.title}" but is within ${family.streakProtectionDays || 0} week protection period - no penalty, streak protected`)
            
            // Protect the streak for weekly chores too
            if (!dryRun) {
              await protectStreak(family.id, child.id, chore.id, lastWeekStart)
            }
          } else {
            console.log(`⚙️  Penalties disabled for family - skipping penalty`)
          }
        }
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
 * Protect streak during protection period
 * Updates lastIncrementDate to prevent streak from breaking when child completes next chore
 */
async function protectStreak(
  familyId: string,
  childId: string,
  choreId: string,
  protectionDate: Date
) {
  try {
    const streak = await prisma.streak.findFirst({
      where: { familyId, childId, choreId }
    })

    if (!streak) {
      // No streak exists yet - nothing to protect
      return
    }

    // Update lastIncrementDate to the protection date
    // This makes it appear as if they completed on this day, so their next completion
    // will be treated as consecutive
    await prisma.streak.update({
      where: { id: streak.id },
      data: {
        lastIncrementDate: protectionDate,
        isDisrupted: false // Keep streak active
      }
    })

    console.log(`🛡️  Streak protected for ${choreId} - streak continues at ${streak.current} days`)
  } catch (error) {
    console.error(`❌ Failed to protect streak:`, error)
  }
}

/**
 * Calculate consecutive missed days for a specific chore
 */
async function calculateConsecutiveMissedDays(
  familyId: string,
  childId: string,
  choreId: string,
  today: Date
): Promise<number> {
  let consecutiveMissed = 0
  const checkDate = new Date(today)
  checkDate.setDate(checkDate.getDate() - 1) // Start with yesterday
  
  // Check backwards day by day until we find a day with a completion
  for (let i = 0; i < 30; i++) { // Check up to 30 days back
    const dayStart = new Date(checkDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(checkDate)
    dayEnd.setHours(23, 59, 59, 999)
    
    // Check if there was a completion on this day
    const completion = await prisma.completion.findFirst({
      where: {
        familyId,
        childId,
        assignmentId: {
          in: await prisma.assignment.findMany({
            where: {
              choreId,
              familyId,
              childId,
              createdAt: {
                gte: dayStart,
                lte: dayEnd
              }
            },
            select: { id: true }
          }).then(assignments => assignments.map(a => a.id))
        },
        status: {
          in: ['pending', 'approved']
        },
        timestamp: {
          gte: dayStart,
          lte: dayEnd
        }
      }
    })
    
    if (completion) {
      // Found a completion - stop counting
      break
    }
    
    // No completion found - increment missed days
    consecutiveMissed++
    
    // Move to previous day
    checkDate.setDate(checkDate.getDate() - 1)
  }
  
  return consecutiveMissed
}

/**
 * Apply streak penalty for missed chores using family settings
 */
async function applyStreakPenalty(
  family: any,
  child: any,
  chore: any,
  consecutiveMissedDays: number,
  reason: string
) {
  try {
    // Find child's wallet
    const wallet = child.wallets?.[0]
    if (!wallet) {
      console.log(`⚠️  No wallet found for ${child.nickname}`)
      return
    }

    // Calculate which penalty tier to apply (based on days after protection period)
    const protectionDays = family.streakProtectionDays || 0
    const daysAfterProtection = consecutiveMissedDays - protectionDays
    
    if (daysAfterProtection <= 0) {
      console.log(`🛡️  ${child.nickname} is still within protection period - no penalty`)
      return
    }
    
    // Determine penalty tier (1st, 2nd, or 3rd+ miss)
    let penaltyPence = 0
    let penaltyStars = 0
    
    if (daysAfterProtection === 1) {
      // First miss after protection
      penaltyPence = family.firstMissPence || 0
      penaltyStars = family.firstMissStars || 0
    } else if (daysAfterProtection === 2) {
      // Second miss
      penaltyPence = family.secondMissPence || 0
      penaltyStars = family.secondMissStars || 0
    } else {
      // Third or more miss
      penaltyPence = family.thirdMissPence || 0
      penaltyStars = family.thirdMissStars || 0
    }
    
    // Apply penalty based on type
    const penaltyType = family.penaltyType || 'both'
    let actualPenaltyPence = 0
    let actualPenaltyStars = 0
    
    if (penaltyType === 'money' || penaltyType === 'both') {
      actualPenaltyPence = penaltyPence
    }
    
    if (penaltyType === 'stars' || penaltyType === 'both') {
      actualPenaltyStars = penaltyStars
    }
    
    // Convert stars to pence for balance check (1 star = 10 pence)
    const starsAsPence = actualPenaltyStars * 10
    const totalPenaltyPence = actualPenaltyPence + starsAsPence
    
    if (totalPenaltyPence <= 0 && actualPenaltyStars <= 0) {
      console.log(`⚠️  No penalty configured for ${child.nickname}`)
      return
    }
    
    // Check minimum balance protection
    const minBalancePence = family.minBalancePence || 0
    const minBalanceStars = family.minBalanceStars || 0
    
    // Calculate what balance would be after penalty
    const newBalancePence = wallet.balancePence - actualPenaltyPence
    const newBalanceStars = (wallet.stars || 0) - actualPenaltyStars
    
    // Check if penalty would violate minimum balance protection
    if (newBalancePence < minBalancePence) {
      const allowedPenaltyPence = Math.max(0, wallet.balancePence - minBalancePence)
      if (allowedPenaltyPence === 0) {
        console.log(`🛡️  ${child.nickname} has minimum balance protection (£${(minBalancePence/100).toFixed(2)}) - cannot apply money penalty`)
        actualPenaltyPence = 0
      } else {
        actualPenaltyPence = allowedPenaltyPence
        console.log(`🛡️  ${child.nickname} penalty reduced to respect minimum balance protection`)
      }
    }
    
    if (newBalanceStars < minBalanceStars) {
      const allowedPenaltyStars = Math.max(0, (wallet.stars || 0) - minBalanceStars)
      if (allowedPenaltyStars === 0) {
        console.log(`🛡️  ${child.nickname} has minimum balance protection (${minBalanceStars} stars) - cannot apply star penalty`)
        actualPenaltyStars = 0
      } else {
        actualPenaltyStars = allowedPenaltyStars
        console.log(`🛡️  ${child.nickname} star penalty reduced to respect minimum balance protection`)
      }
    }
    
    // If no penalty can be applied, skip
    if (actualPenaltyPence === 0 && actualPenaltyStars === 0) {
      console.log(`🛡️  ${child.nickname} protected by minimum balance - no penalty applied`)
      return
    }
    
    // Apply penalty
    const updateData: any = {}
    if (actualPenaltyPence > 0) {
      updateData.balancePence = { decrement: actualPenaltyPence }
    }
    if (actualPenaltyStars > 0) {
      updateData.stars = { decrement: actualPenaltyStars }
    }
    
    if (Object.keys(updateData).length > 0) {
      console.log(`💸 Applying penalty to ${child.nickname}: ${actualPenaltyPence > 0 ? `£${(actualPenaltyPence/100).toFixed(2)}` : ''} ${actualPenaltyStars > 0 ? `${actualPenaltyStars} stars` : ''} (${daysAfterProtection === 1 ? '1st' : daysAfterProtection === 2 ? '2nd' : '3rd+' } miss)`)
      
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: updateData
      })

      // Create penalty transaction(s)
      if (actualPenaltyPence > 0) {
        await prisma.transaction.create({
          data: {
            walletId: wallet.id,
            familyId: family.id,
            type: 'debit',
            amountPence: actualPenaltyPence,
            source: 'system',
            metaJson: {
              type: 'streak_penalty',
              choreId: chore.id,
              choreTitle: chore.title,
              penaltyReason: reason,
              consecutiveMissedDays,
              daysAfterProtection,
              penaltyTier: daysAfterProtection === 1 ? 'first' : daysAfterProtection === 2 ? 'second' : 'third_plus',
              penaltyPence: actualPenaltyPence,
              penaltyStars: actualPenaltyStars
            }
          }
        })
      }

      // Invalidate wallet cache
      await cache.invalidateWallet(child.id)
    }

  } catch (error) {
    console.error(`❌ Failed to apply streak penalty:`, error)
  }
}

/**
 * Check if family is in holiday mode (at current time)
 */
function isFamilyInHolidayMode(family: any): boolean {
  return isFamilyInHolidayModeOnDate(family, new Date())
}

/**
 * Check if family is in holiday mode on a specific date
 */
function isFamilyInHolidayModeOnDate(family: any, checkDate: Date): boolean {
  if (!family.holidayMode) return false
  
  // Check if holiday has started
  if (family.holidayStartDate && checkDate < new Date(family.holidayStartDate)) {
    return false
  }
  
  // Check if holiday has ended
  if (family.holidayEndDate && checkDate > new Date(family.holidayEndDate)) {
    return false
  }
  
  return true
}

/**
 * Check if child is in holiday mode (at current time)
 */
function isChildInHolidayMode(child: any): boolean {
  return isChildInHolidayModeOnDate(child, new Date())
}

/**
 * Check if child is in holiday mode on a specific date
 */
function isChildInHolidayModeOnDate(child: any, checkDate: Date): boolean {
  if (!child.holidayMode) return false
  
  // Check if holiday has started
  if (child.holidayStartDate && checkDate < new Date(child.holidayStartDate)) {
    return false
  }
  
  // Check if holiday has ended
  if (child.holidayEndDate && checkDate > new Date(child.holidayEndDate)) {
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
