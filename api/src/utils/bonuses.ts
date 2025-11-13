/**
 * Bonus Processing Utilities
 * 
 * Handles all bonus types:
 * - Achievement bonuses (complete X chores)
 * - Birthday bonuses (automatic on birthday)
 * - Perfect week bonuses (all chores completed)
 * - Monthly milestone bonuses
 * - Surprise random bonuses (lottery system)
 */

import { prisma } from '../db/prisma.js'

interface BonusResult {
  bonusMoneyPence: number
  bonusStars: number
  shouldAward: boolean
  bonusType: string
  reason?: string
}

/**
 * Check and award achievement bonus if milestone reached
 */
export async function checkAchievementBonus(
  familyId: string,
  childId: string
): Promise<BonusResult> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: {
      achievementBonusEnabled: true,
      achievementChoresRequired: true,
      achievementBonusMoneyPence: true,
      achievementBonusStars: true,
      achievementBonusType: true
    }
  })

  if (!family || !family.achievementBonusEnabled) {
    return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'achievement' }
  }

  // Count total approved completions for this child
  const totalCompletions = await prisma.completion.count({
    where: {
      familyId,
      childId,
      status: 'approved'
    }
  })

  // Check if we've reached a milestone (multiple of required chores)
  const milestoneReached = totalCompletions > 0 && totalCompletions % family.achievementChoresRequired === 0

  if (!milestoneReached) {
    return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'achievement' }
  }

  // Check if we've already awarded bonus for this milestone
  const wallet = await prisma.wallet.findFirst({
    where: { familyId, childId },
    select: { id: true }
  })

  if (wallet) {
    // Check transactions from last 7 days to see if we already awarded for this milestone
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const existingBonuses = await prisma.transaction.findMany({
      where: {
        walletId: wallet.id,
        familyId,
        source: 'system',
        createdAt: { gte: oneWeekAgo },
        metaJson: {
          path: ['type'],
          equals: 'achievement_bonus'
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    // Check if we already gave a bonus for this exact milestone
    for (const bonus of existingBonuses) {
      const meta = bonus.metaJson as any
      if (meta?.milestoneCompletions === totalCompletions) {
        return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'achievement' }
      }
    }
  }

  // Calculate bonus based on type
  let bonusMoneyPence = 0
  let bonusStars = 0

  if (family.achievementBonusType === 'money' || family.achievementBonusType === 'both') {
    bonusMoneyPence = family.achievementBonusMoneyPence
  }

  if (family.achievementBonusType === 'stars' || family.achievementBonusType === 'both') {
    bonusStars = family.achievementBonusStars
  }

  return {
    bonusMoneyPence,
    bonusStars,
    shouldAward: true,
    bonusType: 'achievement',
    reason: `Completed ${totalCompletions} chores!`
  }
}

/**
 * Check and award birthday bonus if today is child's birthday
 */
export async function checkBirthdayBonus(
  familyId: string,
  childId: string
): Promise<BonusResult> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: {
      birthdayBonusEnabled: true,
      birthdayBonusMoneyPence: true,
      birthdayBonusStars: true,
      birthdayBonusType: true
    }
  })

  if (!family || !family.birthdayBonusEnabled) {
    return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'birthday' }
  }

  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: {
      birthMonth: true,
      birthYear: true
    }
  })

  if (!child || !child.birthMonth) {
    return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'birthday' }
  }

  const today = new Date()
  const currentMonth = today.getMonth() + 1 // JavaScript months are 0-indexed

  if (currentMonth !== child.birthMonth) {
    return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'birthday' }
  }

  // Check if we've already awarded birthday bonus this month
  const wallet = await prisma.wallet.findFirst({
    where: { familyId, childId },
    select: { id: true }
  })

  if (wallet) {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59)

    const existingBonuses = await prisma.transaction.findMany({
      where: {
        walletId: wallet.id,
        familyId,
        source: 'system',
        createdAt: { gte: startOfMonth, lte: endOfMonth },
        metaJson: {
          path: ['type'],
          equals: 'birthday_bonus'
        }
      }
    })

    if (existingBonuses.length > 0) {
      return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'birthday' }
    }
  }

  // Calculate bonus based on type
  let bonusMoneyPence = 0
  let bonusStars = 0

  if (family.birthdayBonusType === 'money' || family.birthdayBonusType === 'both') {
    bonusMoneyPence = family.birthdayBonusMoneyPence
  }

  if (family.birthdayBonusType === 'stars' || family.birthdayBonusType === 'both') {
    bonusStars = family.birthdayBonusStars
  }

  return {
    bonusMoneyPence,
    bonusStars,
    shouldAward: true,
    bonusType: 'birthday',
    reason: `Happy Birthday! 🎂`
  }
}

/**
 * Check and award perfect week bonus if all chores completed this week
 */
export async function checkPerfectWeekBonus(
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
  // This prevents checking mid-week when it's impossible to have a perfect week yet
  const currentDay = today.getDay()
  if (currentDay !== 0 && currentDay !== 1) {
    // Not Sunday or Monday, skip check
    return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'perfect_week' }
  }

  // If it's Monday, check last week instead
  let weekToCheck = startOfWeek
  if (currentDay === 1) {
    // Monday - check last week
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
        createdAt: { gte: startOfWeek },
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
export async function checkMonthlyBonus(
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

/**
 * Check and award surprise random bonus based on chance percentage
 */
export async function checkSurpriseBonus(
  familyId: string,
  childId: string
): Promise<BonusResult> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: {
      surpriseBonusEnabled: true,
      surpriseBonusChance: true,
      surpriseBonusMoneyPence: true,
      surpriseBonusStars: true,
      surpriseBonusType: true
    }
  })

  if (!family || !family.surpriseBonusEnabled) {
    return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'surprise' }
  }

  // Random chance (1-100)
  const randomRoll = Math.floor(Math.random() * 100) + 1

  if (randomRoll > family.surpriseBonusChance) {
    return { bonusMoneyPence: 0, bonusStars: 0, shouldAward: false, bonusType: 'surprise' }
  }

  // Calculate bonus based on type
  let bonusMoneyPence = 0
  let bonusStars = 0

  if (family.surpriseBonusType === 'money' || family.surpriseBonusType === 'both') {
    bonusMoneyPence = family.surpriseBonusMoneyPence
  }

  if (family.surpriseBonusType === 'stars' || family.surpriseBonusType === 'both') {
    bonusStars = family.surpriseBonusStars
  }

  return {
    bonusMoneyPence,
    bonusStars,
    shouldAward: true,
    bonusType: 'surprise',
    reason: `Surprise bonus! 🎲`
  }
}

/**
 * Process all applicable bonuses for a completion
 * Returns array of bonuses that should be awarded
 */
export async function processAllBonuses(
  familyId: string,
  childId: string
): Promise<BonusResult[]> {
  const bonuses: BonusResult[] = []

  // Check each bonus type
  const [achievement, birthday, perfectWeek, monthly, surprise] = await Promise.all([
    checkAchievementBonus(familyId, childId),
    checkBirthdayBonus(familyId, childId),
    checkPerfectWeekBonus(familyId, childId),
    checkMonthlyBonus(familyId, childId),
    checkSurpriseBonus(familyId, childId)
  ])

  if (achievement.shouldAward) bonuses.push(achievement)
  if (birthday.shouldAward) bonuses.push(birthday)
  if (perfectWeek.shouldAward) bonuses.push(perfectWeek)
  if (monthly.shouldAward) bonuses.push(monthly)
  if (surprise.shouldAward) bonuses.push(surprise)

  return bonuses
}

