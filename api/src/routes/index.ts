import { FastifyInstance } from 'fastify'
import * as ctrl from '../controllers/index.js'
import * as adminAuth from '../controllers/adminAuth.js'
import * as siteEmailConfig from '../controllers/siteEmailConfig.js'
import * as affiliateConfig from '../controllers/affiliateConfig.js'

export async function routes(app: FastifyInstance) {
  // Health check
  app.get('/health', async () => ({ ok: true }))

  // Auth routes (no auth required)
  app.post('/auth/signup-parent', ctrl.auth.signupParent)
  app.get('/auth/callback', ctrl.auth.callback)
  app.post('/auth/child-join', ctrl.auth.childJoin)
  app.post('/auth/generate-join-code', ctrl.auth.generateChildJoinCode)

  // Family management
  app.get('/family', ctrl.family.get)
  app.post('/family', ctrl.family.create)
  app.patch('/family', ctrl.family.update)
  app.get('/family/members', ctrl.family.getMembers)
  app.get('/family/budget', ctrl.family.getBudget)
  app.get('/family/join-codes', ctrl.family.getJoinCodes)
  app.post('/family/invite', ctrl.family.invite)

  // Children management
  app.post('/children', ctrl.children.create)
  app.patch('/children/:id', ctrl.children.update)

  // Chores management
  app.get('/chores', ctrl.chores.list)
  app.post('/chores', ctrl.chores.create)
  app.patch('/chores/:id', ctrl.chores.update)

  // Assignments
  app.get('/assignments', ctrl.assignments.list)
  app.post('/assignments', ctrl.assignments.create)
  app.post('/assignments/link', ctrl.assignments.link)
  app.delete('/assignments/:id', ctrl.assignments.remove)

  // Bidding
  app.get('/bids', ctrl.bids.list)
  app.post('/bids/compete', ctrl.bids.compete)

  // Completions
  app.get('/completions', ctrl.completions.list)
  app.post('/completions', ctrl.completions.create)
  app.post('/completions/:id/approve', ctrl.completions.approve)
  app.post('/completions/:id/reject', ctrl.completions.reject)

  // Wallet
  app.get('/wallet/:childId', ctrl.wallet.get)
  app.post('/wallet/:childId/credit', ctrl.wallet.credit)
  app.post('/wallet/:childId/debit', ctrl.wallet.debit)
  app.get('/wallet/:childId/transactions', ctrl.wallet.getTransactions)
  app.get('/wallet/:childId/stats', ctrl.wallet.getStats)

  // Payouts
  app.post('/payouts', ctrl.payouts.create)
  app.get('/payouts', ctrl.payouts.list)
  app.get('/payouts/unpaid/:childId', ctrl.payouts.getUnpaidBalance)

  // Leaderboard and rivalry
  app.get('/leaderboard', ctrl.leaderboard.weekly)
  app.get('/rivalry-feed', ctrl.rivalry.feed)

  // Rewards and Redemptions
  app.get('/rewards', ctrl.rewards.list)
  app.post('/redemptions', ctrl.rewards.redeem)
  app.get('/redemptions', ctrl.rewards.listRedemptions)
  app.post('/redemptions/:id/fulfill', ctrl.rewards.fulfillRedemption)

  // Streaks
  app.get('/streaks/:childId', ctrl.streaks.getStats)

  // Affiliate Rewards System
  app.get('/affiliate-rewards/featured', ctrl.affiliateRewards.getFeatured)
  app.get('/affiliate-rewards/recommended', ctrl.affiliateRewards.getRecommended)
  app.get('/affiliate-rewards/explore', ctrl.affiliateRewards.getExplore)
  app.get('/affiliate-rewards/birthday-list', ctrl.affiliateRewards.getBirthdayList)
  app.get('/affiliate-rewards/christmas-list', ctrl.affiliateRewards.getChristmasList)
  app.get('/affiliate-rewards/:id', ctrl.affiliateRewards.getById)
  app.post('/affiliate-rewards/click/:id', ctrl.affiliateRewards.trackClick)
  
  // Parent Reward Preferences
  app.get('/affiliate-rewards/preferences', ctrl.affiliateRewards.getPreferences)
  app.patch('/affiliate-rewards/preferences', ctrl.affiliateRewards.updatePreferences)
  app.post('/affiliate-rewards/preferences/pin/:id', ctrl.affiliateRewards.pinReward)
  app.delete('/affiliate-rewards/preferences/pin/:id', ctrl.affiliateRewards.unpinReward)
  app.post('/affiliate-rewards/preferences/block/:id', ctrl.affiliateRewards.blockReward)
  app.delete('/affiliate-rewards/preferences/block/:id', ctrl.affiliateRewards.unblockReward)
  
  // Admin Endpoints (protected by role check in controller)
  app.get('/admin/affiliate-rewards', ctrl.affiliateRewards.adminListRewards)
  app.patch('/admin/affiliate-rewards/:id', ctrl.affiliateRewards.adminUpdateReward)
  app.get('/admin/affiliate-rewards/metrics', ctrl.affiliateRewards.adminGetMetrics)
  
  // Admin Authentication
  app.post('/admin/auth/signup', adminAuth.adminSignup)
  app.post('/admin/auth/verify-email', adminAuth.adminVerifyEmail)
  app.post('/admin/auth/login', adminAuth.adminLogin)
  app.post('/admin/auth/verify-2fa', adminAuth.adminVerifyTwoFactor)
  app.post('/admin/auth/logout', adminAuth.adminLogout)
  
  // Site Email Configuration
  app.get('/admin/email-config', siteEmailConfig.getSiteEmailConfig)
  app.post('/admin/email-config', siteEmailConfig.updateSiteEmailConfig)
  app.post('/admin/test-email', siteEmailConfig.testSiteEmail)
  
  // Affiliate Configuration
  app.get('/admin/affiliate-config', affiliateConfig.getAffiliateConfig)
  app.post('/admin/affiliate-config', affiliateConfig.updateAffiliateConfig)
  app.post('/admin/test-affiliate', affiliateConfig.testAffiliateProvider)
  app.get('/admin/affiliate-providers', affiliateConfig.getAffiliateProviders)
  app.post('/admin/search-products', affiliateConfig.searchProducts)
  app.post('/admin/get-product-details', affiliateConfig.getProductDetails)
  
  // Admin Affiliate Sources
app.get('/admin/affiliate-sources', ctrl.affiliateRewards.adminListSources)
app.post('/admin/affiliate-sources', ctrl.affiliateRewards.adminCreateSource)
app.patch('/admin/affiliate-sources/:id', ctrl.affiliateRewards.adminUpdateSource)
app.delete('/admin/affiliate-sources/:id', ctrl.affiliateRewards.adminDeleteSource)
app.get('/admin/sync-stats', ctrl.affiliateRewards.adminGetSyncStats)
app.post('/admin/trigger-sync', ctrl.affiliateRewards.adminTriggerSync)
}
