import React from 'react'
import { useChildDashboardData } from '../hooks/useChildDashboardData'

interface StreakStat {
  choreId?: string
  chore?: {
    id: string
    title: string
  }
  current: number
  best?: number
  longest?: number
  [key: string]: any
}

const StreaksTab: React.FC = () => {
  const { streakStats, familySettings } = useChildDashboardData('streaks')

  const currentStreak = streakStats?.currentStreak || 0
  const individualStreaks = streakStats?.individualStreaks || []

  const activeStreaks = individualStreaks.filter((s: StreakStat) => s.current > 0)
  const inactiveStreaks = individualStreaks.filter((s: StreakStat) => s.current === 0)

  // Calculate next bonus milestone
  const bonusDays = familySettings?.bonusDays || 7
  const bonusEnabled = familySettings?.bonusEnabled !== false
  const bonusType = familySettings?.bonusType || 'both'
  const bonusMoneyPence = familySettings?.bonusMoneyPence || 0
  const bonusStars = familySettings?.bonusStars || 0
  const nextMilestone = Math.ceil((currentStreak + 1) / bonusDays) * bonusDays
  const daysUntilNext = nextMilestone - currentStreak

  return (
    <div className="space-y-6">
      <h2 className="cb-heading-lg text-[var(--primary)]">🔥 Your Streaks</h2>

      {/* Individual Chore Streaks */}
      {activeStreaks.length > 0 && (
        <div className="cb-card p-6">
          <h3 className="cb-heading-md text-[var(--primary)] mb-4">🔥 Your Chore Streaks</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {activeStreaks
              .sort((a: StreakStat, b: StreakStat) => b.current - a.current)
              .map((streak: StreakStat) => (
                <div
                  key={streak.choreId || streak.chore?.id}
                  className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <span className="text-orange-500">🔥</span>
                      {streak.chore?.title || 'Unknown Chore'}
                    </h4>
                    <span className="text-2xl font-bold text-orange-600">{streak.current}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
                    <span>🔥 {streak.current} days</span>
                    <span>🏆 Best: {streak.best || streak.longest || 0}</span>
                  </div>
                  {streak.current >= (streak.best || streak.longest || 0) && streak.current > 0 && (
                    <div className="mt-2 text-xs font-bold text-orange-600 bg-orange-100 rounded px-2 py-1 inline-block">
                      🎯 Matching your best!
                    </div>
                  )}
                </div>
              ))}
          </div>
          {inactiveStreaks.length > 0 && (
            <div className="mt-4 text-sm text-[var(--text-secondary)] text-center">
              Start streaks on {inactiveStreaks.length} other chore{inactiveStreaks.length !== 1 ? 's' : ''} to earn more bonuses! 💪
            </div>
          )}
        </div>
      )}

      {/* Next Bonus Milestone */}
      {familySettings && (
        <div className="cb-card p-6 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300">
          <h3 className="cb-heading-md text-[var(--primary)] mb-4">🎁 Your Next Bonus</h3>
          {!bonusEnabled ? (
            <div className="text-center py-4">
              <p className="text-[var(--text-secondary)]">Bonuses are currently disabled</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-orange-600 mb-2">
                  {daysUntilNext} {daysUntilNext === 1 ? 'day' : 'days'} to go!
                </div>
                <div className="text-sm text-[var(--text-secondary)] mb-4">
                  Complete chores for {daysUntilNext} more {daysUntilNext === 1 ? 'day' : 'days'} to reach {nextMilestone} days
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-6 mb-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-orange-400 to-red-500 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all duration-500"
                    style={{ width: `${Math.min(100, (currentStreak / nextMilestone) * 100)}%` }}
                  >
                    {currentStreak > 0 && `${currentStreak}/${nextMilestone}`}
                  </div>
                </div>

                {/* Bonus reward preview */}
                <div className="bg-white rounded-xl p-4 border-2 border-yellow-300">
                  <div className="font-bold text-lg text-[var(--text-primary)] mb-2">You'll earn:</div>
                  <div className="flex items-center justify-center gap-6">
                    {(bonusType === 'money' || bonusType === 'both') && bonusMoneyPence > 0 && (
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">💰</div>
                        <div className="text-xl font-bold text-green-600">£{(bonusMoneyPence / 100).toFixed(2)}</div>
                      </div>
                    )}
                    {(bonusType === 'stars' || bonusType === 'both') && bonusStars > 0 && (
                      <div className="text-center">
                        <div className="text-3xl font-bold text-yellow-600">⭐</div>
                        <div className="text-xl font-bold text-yellow-600">{bonusStars} Stars</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bonus schedule */}
                <div className="mt-4 text-xs text-[var(--text-secondary)] text-center">
                  💡 Bonuses are awarded every {bonusDays} days ({bonusDays}, {bonusDays * 2}, {bonusDays * 3}...)
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Streak Protection Info */}
      {familySettings && familySettings.streakProtectionDays > 0 && (
        <div className="cb-card p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300">
          <h3 className="cb-heading-md text-blue-600 mb-3 flex items-center gap-2">🛡️ Streak Protection</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            You have <span className="font-bold text-blue-600">{familySettings.streakProtectionDays}</span> protection{' '}
            {familySettings.streakProtectionDays === 1 ? 'day' : 'days'}!
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            If you miss a day, your streak won't break for {familySettings.streakProtectionDays}{' '}
            {familySettings.streakProtectionDays === 1 ? 'day' : 'days'}. This gives you a safety net! 🎯
          </p>
        </div>
      )}

      {/* Penalty Information (if enabled) */}
      {familySettings && familySettings.penaltyEnabled && (
        <div className="cb-card p-4 bg-white border-2 border-red-300">
          <h3 className="text-sm font-bold text-red-600 mb-2 flex items-center gap-2">⚠️ Penalty Info</h3>
          <p className="text-xs text-gray-700 mb-2">Missing chores after protection period:</p>
          <div className="space-y-1 text-xs">
            {familySettings.firstMissPence > 0 && (
              <div className="flex items-center justify-between text-gray-800">
                <span>1st miss:</span>
                <span className="font-bold text-red-600">
                  -£{(familySettings.firstMissPence / 100).toFixed(2)}
                  {familySettings.firstMissStars > 0 && ` / -${familySettings.firstMissStars}⭐`}
                </span>
              </div>
            )}
            {familySettings.secondMissPence > 0 && (
              <div className="flex items-center justify-between text-gray-800">
                <span>2nd miss:</span>
                <span className="font-bold text-red-600">
                  -£{(familySettings.secondMissPence / 100).toFixed(2)}
                  {familySettings.secondMissStars > 0 && ` / -${familySettings.secondMissStars}⭐`}
                </span>
              </div>
            )}
            {familySettings.thirdMissPence > 0 && (
              <div className="flex items-center justify-between text-gray-800">
                <span>3rd+ miss:</span>
                <span className="font-bold text-red-600">
                  -£{(familySettings.thirdMissPence / 100).toFixed(2)}
                  {familySettings.thirdMissStars > 0 && ` / -${familySettings.thirdMissStars}⭐`}
                </span>
              </div>
            )}
          </div>
          {(familySettings.minBalancePence > 0 || familySettings.minBalanceStars > 0) && (
            <div className="mt-2 pt-2 border-t border-red-200 text-xs text-gray-700">
              🛡️ Protection: You'll always keep at least £{(familySettings.minBalancePence / 100).toFixed(2)}
              {familySettings.minBalanceStars > 0 && ` and ${familySettings.minBalanceStars} stars`}
            </div>
          )}
        </div>
      )}

      {/* Streak Tips */}
      <div className="cb-card bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 p-6">
        <h3 className="cb-heading-md text-blue-600 mb-3">💡 Streak Tips</h3>
        <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Complete at least one chore every day to maintain your streak 🔥</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Your streak counts when you submit a chore (even before parent approval!) ✅</span>
          </li>
          {familySettings?.streakProtectionDays > 0 && (
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>
                You have {familySettings.streakProtectionDays} protection{' '}
                {familySettings.streakProtectionDays === 1 ? 'day' : 'days'} - use them wisely! 🛡️
              </span>
            </li>
          )}
          {familySettings?.bonusEnabled && (
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Earn bonuses every {familySettings.bonusDays || 7} days - keep going! 🎁</span>
            </li>
          )}
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>Your best streak is saved forever - try to beat it! 🏆</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default StreaksTab

