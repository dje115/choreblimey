import { FastifyInstance } from 'fastify'
import * as ctrl from '../controllers/index.js'

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
  app.get('/family/members/:id/stats', ctrl.family.getMemberStats)
  app.patch('/family/members/:id', ctrl.family.updateMember)
  app.patch('/family/members/:id/pause', ctrl.family.toggleMemberPause)
  app.delete('/family/members/:id', ctrl.family.removeMember)
  app.post('/family/members/:id/device-token', ctrl.family.generateDeviceToken)
  app.get('/family/budget', ctrl.family.getBudget)
  app.get('/family/join-codes', ctrl.family.getJoinCodes)
  app.post('/family/invite', ctrl.family.invite)

  // Children management
  app.post('/children', ctrl.children.create)
  app.patch('/children/:id', ctrl.children.update)
  app.patch('/children/:id/pause', ctrl.children.togglePause)
  app.delete('/children/:id', ctrl.children.remove)

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
  
  // Gift Templates (Admin - protected by role check in controller)
  app.get('/admin/gift-templates', ctrl.giftTemplates.adminList)
  app.post('/admin/gift-templates', ctrl.giftTemplates.adminCreate)
  app.get('/admin/gift-templates/:id', ctrl.giftTemplates.adminGet)
  app.patch('/admin/gift-templates/:id', ctrl.giftTemplates.adminUpdate)
  app.delete('/admin/gift-templates/:id', ctrl.giftTemplates.adminDelete)
  app.post('/admin/gift-templates/generate-affiliate-url', ctrl.giftTemplates.adminGenerateAffiliateUrl)
  
  // Gift Templates (User - browse available templates, read-only)
  app.get('/gift-templates', ctrl.giftTemplates.userList)
  
  // Family Gifts (User - parent selects/customizes gifts for their family)
  app.get('/family/gifts', ctrl.familyGifts.listFamilyGifts)
  app.post('/family/gifts', ctrl.familyGifts.create)
  app.post('/family/gifts/:templateId/add', ctrl.familyGifts.addFromTemplate)
  app.get('/family/gifts/:id', ctrl.familyGifts.get)
  app.patch('/family/gifts/:id', ctrl.familyGifts.update)
  app.delete('/family/gifts/:id', ctrl.familyGifts.remove)
}
