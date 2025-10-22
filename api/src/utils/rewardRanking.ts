/**
 * Reward Ranking Algorithm for ChoreBlimey! Affiliate System
 * 
 * Scores rewards based on:
 * - Age appropriateness
 * - Interest matching
 * - Budget fit
 * - Popularity (CTR)
 * - Freshness
 * - Block penalties
 */

interface Child {
  ageGroup?: string
  interestsJson?: any
  birthMonth?: number
  birthYear?: number
}

interface RewardItem {
  id: string
  ageTag: string
  interestTags?: any
  pricePence?: number
  popularityScore: number
  featured: boolean
  blocked: boolean
  createdAt: Date
  lastSyncedAt?: Date
}

interface ParentPreferences {
  maxRewardPence?: number
  allowedCategories?: any
  blockedCategories?: any
  blockedRewardIds?: any
  pinnedRewardIds?: any
}

interface RankingWeights {
  ageMatch: number
  interestOverlap: number
  budgetFit: number
  popularity: number
  freshness: number
  blockPenalty: number
}

// Default weights (can be tuned via A/B testing)
const DEFAULT_WEIGHTS: RankingWeights = {
  ageMatch: 0.30,      // 30% - Most important
  interestOverlap: 0.25, // 25% - High importance
  budgetFit: 0.20,      // 20% - Practical constraint
  popularity: 0.15,     // 15% - Social proof
  freshness: 0.10,      // 10% - Keep things new
  blockPenalty: -1.0    // Massive penalty if blocked
}

/**
 * Calculate age match score (0-1)
 */
export function calculateAgeMatchScore(child: Child, reward: RewardItem): number {
  const childAgeGroup = child.ageGroup || 'all_ages'
  const rewardAgeTag = reward.ageTag
  
  // Perfect match
  if (childAgeGroup === rewardAgeTag || rewardAgeTag === 'all_ages') {
    return 1.0
  }
  
  // Partial matches (adjacent age groups)
  const ageOrder = ['kid_5_8', 'tween_9_11', 'teen_12_15']
  const childIndex = ageOrder.indexOf(childAgeGroup)
  const rewardIndex = ageOrder.indexOf(rewardAgeTag)
  
  if (childIndex !== -1 && rewardIndex !== -1) {
    const distance = Math.abs(childIndex - rewardIndex)
    if (distance === 1) return 0.5 // Adjacent age group
    if (distance === 2) return 0.2 // Two groups away
  }
  
  return 0.1 // No match but not zero
}

/**
 * Calculate interest overlap score (0-1)
 */
export function calculateInterestOverlapScore(child: Child, reward: RewardItem): number {
  const childInterests = Array.isArray(child.interestsJson) 
    ? child.interestsJson 
    : (child.interestsJson ? JSON.parse(JSON.stringify(child.interestsJson)) : [])
  
  const rewardInterests = Array.isArray(reward.interestTags)
    ? reward.interestTags
    : (reward.interestTags ? JSON.parse(JSON.stringify(reward.interestTags)) : [])
  
  if (childInterests.length === 0 || rewardInterests.length === 0) {
    return 0.5 // Neutral if no data
  }
  
  // Jaccard similarity: intersection / union
  const childSet = new Set(childInterests)
  const rewardSet = new Set(rewardInterests)
  
  const intersection = [...childSet].filter(x => rewardSet.has(x)).length
  const union = new Set([...childSet, ...rewardSet]).size
  
  return union > 0 ? intersection / union : 0
}

/**
 * Calculate budget fit score (0-1)
 */
export function calculateBudgetFitScore(
  reward: RewardItem, 
  maxBudget: number,
  childStars: number
): number {
  if (!reward.pricePence || reward.pricePence === 0) {
    return 0.5 // Neutral for items without price
  }
  
  // Check parent budget cap
  if (maxBudget > 0 && reward.pricePence > maxBudget) {
    return 0.0 // Outside parent budget
  }
  
  // Check if child can afford (stars = pence / 10)
  const requiredStars = Math.floor(reward.pricePence / 10)
  
  if (requiredStars <= childStars * 0.5) {
    return 1.0 // Easily affordable (≤50% of stars)
  } else if (requiredStars <= childStars) {
    return 0.8 // Affordable with all stars
  } else if (requiredStars <= childStars * 1.5) {
    return 0.5 // Stretch goal (within 50% more)
  } else if (requiredStars <= childStars * 2) {
    return 0.3 // Challenge goal (double current stars)
  } else {
    return 0.1 // Very aspirational
  }
}

/**
 * Calculate popularity score (already 0-1 in DB, based on CTR)
 */
export function calculatePopularityScore(reward: RewardItem): number {
  return Math.min(reward.popularityScore, 1.0)
}

/**
 * Calculate freshness score (0-1)
 * Newer items get a boost to enable exploration
 */
export function calculateFreshnessScore(reward: RewardItem): number {
  const now = new Date()
  const createdAt = new Date(reward.createdAt)
  const daysSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  
  // Exponential decay: score = e^(-days/30)
  // New items (0 days) = 1.0
  // 30 days = 0.37
  // 60 days = 0.13
  const halfLife = 30
  return Math.exp(-daysSinceCreated / halfLife)
}

/**
 * Calculate block penalty
 */
export function calculateBlockPenalty(reward: RewardItem, preferences: ParentPreferences): number {
  // Blocked in DB
  if (reward.blocked) {
    return 1.0
  }
  
  // Blocked by parent
  const blockedIds = Array.isArray(preferences.blockedRewardIds)
    ? preferences.blockedRewardIds
    : (preferences.blockedRewardIds ? JSON.parse(JSON.stringify(preferences.blockedRewardIds)) : [])
  
  if (blockedIds.includes(reward.id)) {
    return 1.0
  }
  
  return 0.0
}

/**
 * Check if reward passes parent filters
 */
export function passesParentFilters(
  reward: RewardItem,
  preferences: ParentPreferences,
  rewardCategory?: string
): boolean {
  // Check allowed categories
  if (preferences.allowedCategories) {
    const allowed = Array.isArray(preferences.allowedCategories)
      ? preferences.allowedCategories
      : JSON.parse(JSON.stringify(preferences.allowedCategories))
    
    if (allowed.length > 0 && rewardCategory && !allowed.includes(rewardCategory)) {
      return false
    }
  }
  
  // Check blocked categories
  if (preferences.blockedCategories) {
    const blocked = Array.isArray(preferences.blockedCategories)
      ? preferences.blockedCategories
      : JSON.parse(JSON.stringify(preferences.blockedCategories))
    
    if (rewardCategory && blocked.includes(rewardCategory)) {
      return false
    }
  }
  
  return true
}

/**
 * Calculate overall ranking score for a reward
 */
export function calculateRewardScore(
  child: Child,
  reward: RewardItem,
  childStars: number,
  preferences: ParentPreferences,
  rewardCategory?: string,
  weights: RankingWeights = DEFAULT_WEIGHTS
): number {
  // Filter out blocked items
  if (reward.blocked || calculateBlockPenalty(reward, preferences) > 0) {
    return -Infinity
  }
  
  // Filter by parent preferences
  if (!passesParentFilters(reward, preferences, rewardCategory)) {
    return -Infinity
  }
  
  // Calculate component scores
  const ageScore = calculateAgeMatchScore(child, reward)
  const interestScore = calculateInterestOverlapScore(child, reward)
  const budgetScore = calculateBudgetFitScore(reward, preferences.maxRewardPence || Infinity, childStars)
  const popularityScore = calculatePopularityScore(reward)
  const freshnessScore = calculateFreshnessScore(reward)
  
  // Weighted sum
  const totalScore = 
    weights.ageMatch * ageScore +
    weights.interestOverlap * interestScore +
    weights.budgetFit * budgetScore +
    weights.popularity * popularityScore +
    weights.freshness * freshnessScore
  
  return totalScore
}

/**
 * Rank rewards for a child
 */
export function rankRewards(
  child: Child,
  rewards: RewardItem[],
  childStars: number,
  preferences: ParentPreferences,
  weights: RankingWeights = DEFAULT_WEIGHTS
): RewardItem[] {
  // Calculate scores for all rewards
  const scoredRewards = rewards.map(reward => ({
    reward,
    score: calculateRewardScore(child, reward, childStars, preferences, reward.category || undefined, weights)
  }))
  
  // Filter out blocked items (score = -Infinity)
  const validRewards = scoredRewards.filter(item => item.score > -Infinity)
  
  // Sort by score descending
  validRewards.sort((a, b) => b.score - a.score)
  
  // Return sorted rewards
  return validRewards.map(item => item.reward)
}

/**
 * Check if it's a child's birthday month
 */
export function isBirthdayMonth(child: Child): boolean {
  if (!child.birthMonth) return false
  
  const now = new Date()
  const currentMonth = now.getMonth() + 1 // 0-indexed to 1-indexed
  
  return currentMonth === child.birthMonth
}

/**
 * Check if we're in birthday season (1 month before + birthday month)
 * E.g., if birthday is June, show list in May and June
 */
export function isBirthdaySeason(child: Child): boolean {
  if (!child.birthMonth) return false
  
  const now = new Date()
  const currentMonth = now.getMonth() + 1 // 0-indexed to 1-indexed
  
  // Calculate previous month (with wrap-around)
  const previousMonth = child.birthMonth === 1 ? 12 : child.birthMonth - 1
  
  // Show if current month is birthday month OR month before
  return currentMonth === child.birthMonth || currentMonth === previousMonth
}

/**
 * Check if we're in Christmas season (November 1 - December 24)
 */
export function isChristmasSeason(): boolean {
  const now = new Date()
  const currentMonth = now.getMonth() + 1 // 0-indexed to 1-indexed
  const currentDay = now.getDate()
  
  // November (month 11) or December 1-24 (month 12, day <= 24)
  return (
    currentMonth === 11 || 
    (currentMonth === 12 && currentDay <= 24)
  )
}

/**
 * Calculate days until birthday
 */
export function daysUntilBirthday(child: Child): number | null {
  if (!child.birthMonth) return null
  
  const now = new Date()
  const currentYear = now.getFullYear()
  
  // Construct birthday for this year
  let birthdayThisYear = new Date(currentYear, child.birthMonth - 1, 1) // Use 1st of month if no day
  
  // If birthday has passed this year, use next year
  if (birthdayThisYear < now) {
    birthdayThisYear = new Date(currentYear + 1, child.birthMonth - 1, 1)
  }
  
  const diffMs = birthdayThisYear.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  return diffDays
}

/**
 * Calculate days until Christmas
 */
export function daysUntilChristmas(): number {
  const now = new Date()
  const currentYear = now.getFullYear()
  
  // Christmas this year (December 25)
  let christmasThisYear = new Date(currentYear, 11, 25) // Month 11 = December
  
  // If Christmas has passed this year, use next year
  if (christmasThisYear < now) {
    christmasThisYear = new Date(currentYear + 1, 11, 25)
  }
  
  const diffMs = christmasThisYear.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  return diffDays
}

/**
 * Get exploration rewards (for A/B testing and freshness)
 * Returns a random sample of rewards that haven't been clicked much
 */
export function getExplorationRewards(
  rewards: RewardItem[],
  count: number = 5
): RewardItem[] {
  // Filter to low-popularity items (< 0.3 score)
  const unexplored = rewards.filter(r => r.popularityScore < 0.3 && !r.blocked)
  
  // Shuffle and take N
  const shuffled = unexplored.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

