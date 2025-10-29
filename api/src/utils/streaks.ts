import { prisma } from '../db/prisma.js'

/**
 * Calculate if two dates are consecutive days
 */
export function isConsecutiveDay(lastDate: Date, currentDate: Date): boolean {
  const last = new Date(lastDate)
  last.setHours(0, 0, 0, 0)
  
  const current = new Date(currentDate)
  current.setHours(0, 0, 0, 0)
  
  const diffTime = current.getTime() - last.getTime()
  const diffDays = diffTime / (1000 * 60 * 60 * 24)
  
  return diffDays === 1
}

/**
 * Check if date is same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  const d1 = new Date(date1)
  d1.setHours(0, 0, 0, 0)
  
  const d2 = new Date(date2)
  d2.setHours(0, 0, 0, 0)
  
  return d1.getTime() === d2.getTime()
}

/**
 * Update streak for a specific chore completion
 */
export async function updateStreak(
  familyId: string,
  childId: string,
  choreId: string,
  completionDate: Date = new Date()
): Promise<void> {
  // Find existing streak record
  let streak = await prisma.streak.findFirst({
    where: { familyId, childId, choreId }
  })

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  if (!streak) {
    // Create new streak
    await prisma.streak.create({
      data: {
        familyId,
        childId,
        choreId,
        current: 1,
        best: 1,
        lastIncrementDate: completionDate,
        isDisrupted: false
      }
    })
    return
  }

  // If already incremented today, skip
  if (streak.lastIncrementDate && isSameDay(streak.lastIncrementDate, completionDate)) {
    return
  }

  // Check if consecutive day
  if (streak.lastIncrementDate && isConsecutiveDay(streak.lastIncrementDate, completionDate)) {
    // Increment streak
    const newCurrent = streak.current + 1
    const newBest = Math.max(newCurrent, streak.best)

    await prisma.streak.update({
      where: { id: streak.id },
      data: {
        current: newCurrent,
        best: newBest,
        lastIncrementDate: completionDate,
        isDisrupted: false
      }
    })
  } else {
    // Streak broken, reset
    await prisma.streak.update({
      where: { id: streak.id },
      data: {
        current: 1,
        best: Math.max(1, streak.best), // Keep best if it's higher
        lastIncrementDate: completionDate,
        isDisrupted: true
      }
    })
  }
}

/**
 * Get overall streak stats for a child across all chores, plus individual streaks per chore
 */
export async function getChildStreakStats(familyId: string, childId: string): Promise<{
  currentStreak: number
  bestStreak: number
  totalCompletedDays: number
  streakBonus: number
  individualStreaks?: Array<{
    choreId: string
    chore?: {
      id: string
      title: string
    }
    current: number
    best: number
  }>
}> {
  // Get ALL completions (pending + approved) - streaks are based on submission, not approval
  // This ensures children don't lose streaks due to delayed parent approvals
  const completions = await prisma.completion.findMany({
    where: {
      familyId,
      childId,
      // Include both pending and approved - streaks count when child submits, not when parent approves
      status: {
        in: ['pending', 'approved']
      }
    },
    orderBy: {
      timestamp: 'desc'
    },
    select: {
      timestamp: true
    }
  })

  // Get individual streaks per chore from the database
  const individualStreaks = await prisma.streak.findMany({
    where: {
      familyId,
      childId
    },
    include: {
      chore: {
        select: {
          id: true,
          title: true
        }
      }
    },
    orderBy: {
      current: 'desc'
    }
  })

  const individualStreaksFormatted = individualStreaks.map(streak => ({
    choreId: streak.choreId,
    chore: streak.chore ? {
      id: streak.chore.id,
      title: streak.chore.title
    } : undefined,
    current: streak.current,
    best: streak.best
  }))

  if (completions.length === 0) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      totalCompletedDays: 0,
      streakBonus: 0,
      individualStreaks: individualStreaksFormatted
    }
  }

  // Get unique days with completions (using UTC to match database timestamps)
  const uniqueDays = new Set<string>()
  for (const completion of completions) {
    // Convert timestamp to UTC date string (YYYY-MM-DD)
    const date = new Date(completion.timestamp)
    const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
    uniqueDays.add(dateKey)
  }

  const sortedDays = Array.from(uniqueDays).sort().reverse()
  
  // Use UTC for "today" to match the dateKey format above (define before using in debug logs)
  const now = new Date()
  const todayUTC = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
  
  // Get family settings for streak protection
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: {
      streakProtectionDays: true
    }
  })
  const protectionDays = family?.streakProtectionDays || 0
  
  // Calculate current streak based on ACTUAL consecutive completion days
  // Protection days only determine if streak is "alive" (not broken) - they don't add to the count
  let currentStreak = 0
  
  // Debug logging
  process.stderr.write(`\n[STREAK CALC] Child: ${childId}\n`)
  process.stderr.write(`[STREAK CALC] Total completions: ${completions.length}\n`)
  process.stderr.write(`[STREAK CALC] Unique days: ${sortedDays.join(', ')}\n`)
  process.stderr.write(`[STREAK CALC] Today UTC: ${todayUTC}\n`)
  process.stderr.write(`[STREAK CALC] Protection days: ${protectionDays}\n`)
  
  if (sortedDays.length === 0) {
    currentStreak = 0
  } else {
    // Start from the most recent completion day
    let lastStreakDay = -1
    
    for (let i = 0; i < sortedDays.length; i++) {
      if (i === 0) {
        // First date - this is the most recent completion day
        // Check if streak is still "alive" (today or within protection days)
        // Protection determines if streak is alive, but doesn't add to the count
        // Calculate days between completion date and today (both in UTC)
        const completionDateStr = sortedDays[i] // Already in YYYY-MM-DD format
        const completionDateObj = new Date(completionDateStr + 'T00:00:00Z')
        const todayDateObj = new Date(todayUTC + 'T00:00:00Z')
        const daysSinceCompletion = Math.floor((todayDateObj.getTime() - completionDateObj.getTime()) / (1000 * 60 * 60 * 24))
        
        // Always count the most recent completion day (whether it's today or within protection)
        // This ensures if someone completes tasks today, today counts immediately
        if (daysSinceCompletion <= protectionDays) {
          // Streak is still alive - start counting consecutive days
          // If today has completions (daysSinceCompletion === 0), today counts
          // If yesterday has completions (daysSinceCompletion === 1) and within protection, streak is alive but yesterday counts
          currentStreak = 1
          lastStreakDay = i
          process.stderr.write(`[STREAK CALC] Started streak - day ${completionDateStr}, daysSince: ${daysSinceCompletion}\n`)
        } else {
          // Too old, streak is broken
          process.stderr.write(`[STREAK CALC] Streak broken - day ${completionDateStr} too old (${daysSinceCompletion} days ago)\n`)
          break
        }
      } else {
        // Check if this date continues the streak (must be consecutive)
        // Use string-based comparison since sortedDays contains YYYY-MM-DD strings
        const lastDateStr = sortedDays[lastStreakDay]
        const lastDate = new Date(lastDateStr + 'T00:00:00Z')
        lastDate.setUTCDate(lastDate.getUTCDate() - 1)
        const expectedPrevDateStr = `${lastDate.getUTCFullYear()}-${String(lastDate.getUTCMonth() + 1).padStart(2, '0')}-${String(lastDate.getUTCDate()).padStart(2, '0')}`
        const completionDateStr = sortedDays[i]
        
        if (completionDateStr === expectedPrevDateStr) {
          // Consecutive day - perfect, count it
          currentStreak++
          lastStreakDay = i
          process.stderr.write(`[STREAK CALC] Continued streak - day ${completionDateStr}, streak now: ${currentStreak}\n`)
        } else {
          // Gap exists - not consecutive, so streak ends here
          // Protection days don't fill gaps in the count - they only prevent the streak from breaking
          process.stderr.write(`[STREAK CALC] Streak broken - day ${completionDateStr} not consecutive to ${lastDateStr} (expected ${expectedPrevDateStr})\n`)
          break
        }
      }
    }
  }
  
  process.stderr.write(`[STREAK CALC] Final current streak: ${currentStreak}\n\n`)

  // Calculate best streak
  let bestStreak = 0
  let tempStreak = 1
  
  for (let i = 0; i < sortedDays.length - 1; i++) {
    const currentDate = new Date(sortedDays[i])
    const nextDate = new Date(sortedDays[i + 1])
    
    if (isConsecutiveDay(nextDate, currentDate)) {
      tempStreak++
      bestStreak = Math.max(bestStreak, tempStreak)
    } else {
      tempStreak = 1
    }
  }
  bestStreak = Math.max(bestStreak, tempStreak, currentStreak)

  // Calculate streak bonus (percentage boost)
  let streakBonus = 0
  if (currentStreak >= 7) {
    streakBonus = 20 // 20% bonus for 7+ day streak
  } else if (currentStreak >= 5) {
    streakBonus = 15 // 15% bonus for 5-6 day streak
  } else if (currentStreak >= 3) {
    streakBonus = 10 // 10% bonus for 3-4 day streak
  }

  return {
    currentStreak,
    bestStreak,
    totalCompletedDays: uniqueDays.size,
    streakBonus,
    individualStreaks: individualStreaksFormatted
  }
}

/**
 * Calculate bonus to award based on streak milestone and family settings
 * Awards bonus every N days (e.g., every 3 days: day 3, 6, 9, 12, etc.)
 */
export async function calculateStreakBonus(
  familyId: string, 
  childId: string, 
  currentStreakLength: number
): Promise<{
  bonusMoneyPence: number
  bonusStars: number
  shouldAward: boolean
}> {
  // Get family streak settings
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: {
      bonusEnabled: true,
      bonusDays: true,
      bonusMoneyPence: true,
      bonusStars: true,
      bonusType: true
    }
  })

  if (!family || !family.bonusEnabled || currentStreakLength < family.bonusDays) {
    return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false }
  }

  // Check if current streak is a multiple of bonusDays (e.g., 3, 6, 9, 12...)
  const isBonusDay = currentStreakLength % family.bonusDays === 0

  if (!isBonusDay) {
    return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false }
  }

  // Calculate bonus based on type
  let bonusMoneyPence = 0
  let bonusStars = 0

  if (family.bonusType === 'money' || family.bonusType === 'both') {
    bonusMoneyPence = family.bonusMoneyPence
  }

  if (family.bonusType === 'stars' || family.bonusType === 'both') {
    bonusStars = family.bonusStars
  }

  // Check if we've already awarded bonus for this exact streak milestone for this child
  // (to avoid double-awarding if approval runs twice)
  // Get the child's wallet first to check their transactions
  const childWallet = await prisma.wallet.findFirst({
    where: {
      familyId,
      childId
    },
    select: { id: true }
  })

  if (childWallet) {
    // Check transactions from the last 7 days to see if we already awarded for this milestone
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    
    const existingBonuses = await prisma.transaction.findMany({
      where: {
        walletId: childWallet.id,
        familyId,
        source: 'system',
        createdAt: {
          gte: oneWeekAgo
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    // Check if we already gave a bonus for this exact streak milestone
    for (const bonus of existingBonuses) {
      const meta = bonus.metaJson as any
      if (meta?.type === 'streak_bonus' && meta?.streakLength === currentStreakLength) {
        // Already awarded bonus for this streak milestone
        return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false }
      }
    }
  }

  return { bonusMoneyPence, bonusStars, shouldAward: true }
}

/**
 * @deprecated Use calculateStreakBonus instead - this function uses hardcoded values
 */
export function calculateStreakBonusStars(newStreakLength: number): number {
  // Award bonus stars at milestones (old hardcoded logic - deprecated)
  if (newStreakLength === 3) return 5
  if (newStreakLength === 5) return 10
  if (newStreakLength === 7) return 20
  if (newStreakLength === 14) return 50
  if (newStreakLength === 30) return 100
  
  return 0
}

