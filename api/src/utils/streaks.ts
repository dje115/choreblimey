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
 * Get overall streak stats for a child across all chores
 */
export async function getChildStreakStats(familyId: string, childId: string): Promise<{
  currentStreak: number
  bestStreak: number
  totalCompletedDays: number
  streakBonus: number
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

  if (completions.length === 0) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      totalCompletedDays: 0,
      streakBonus: 0
    }
  }

  // Get unique days with completions
  const uniqueDays = new Set<string>()
  for (const completion of completions) {
    const dateKey = new Date(completion.timestamp).toISOString().split('T')[0]
    uniqueDays.add(dateKey)
  }

  const sortedDays = Array.from(uniqueDays).sort().reverse()
  
  // Calculate current streak
  let currentStreak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  for (let i = 0; i < sortedDays.length; i++) {
    const checkDate = new Date(sortedDays[i])
    checkDate.setHours(0, 0, 0, 0)
    
    const expectedDate = new Date(today)
    expectedDate.setDate(expectedDate.getDate() - i)
    expectedDate.setHours(0, 0, 0, 0)
    
    if (checkDate.getTime() === expectedDate.getTime()) {
      currentStreak++
    } else {
      break
    }
  }

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
    streakBonus
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

