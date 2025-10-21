import { FastifyInstance } from 'fastify'
import * as ctrl from '../controllers/index.js'

export async function routes(app: FastifyInstance) {
  // Health check
  app.get('/health', async () => ({ ok: true }))

  // Auth routes (no auth required)
  app.post('/auth/signup-parent', ctrl.auth.signupParent)
  app.get('/auth/callback', ctrl.auth.callback)
  app.post('/auth/child-join', ctrl.auth.childJoin)

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

  // Chores management
  app.get('/chores', ctrl.chores.list)
  app.post('/chores', ctrl.chores.create)
  app.patch('/chores/:id', ctrl.chores.update)

  // Assignments
  app.get('/assignments', ctrl.assignments.list)
  app.post('/assignments', ctrl.assignments.create)
  app.post('/assignments/link', ctrl.assignments.link)

  // Bidding
  app.post('/bids/compete', ctrl.bids.compete)

  // Completions
  app.post('/completions', ctrl.completions.create)
  app.post('/completions/:id/approve', ctrl.completions.approve)

  // Wallet
  app.get('/wallet/:childId', ctrl.wallet.get)
  app.post('/wallet/:childId/credit', ctrl.wallet.credit)
  app.post('/wallet/:childId/debit', ctrl.wallet.debit)

  // Leaderboard and rivalry
  app.get('/leaderboard', ctrl.leaderboard.weekly)
  app.get('/rivalry-feed', ctrl.rivalry.feed)

  // Rewards
  app.get('/rewards', ctrl.rewards.list)
  app.post('/redemptions', ctrl.rewards.redeem)
}
