import { FastifyInstance } from 'fastify'
import * as adminAuth from '../controllers/adminAuth.js'
import * as adminCleanup from '../controllers/adminCleanup.js'
import * as adminMonitoring from '../controllers/adminMonitoring.js'
import * as adminSecurity from '../controllers/adminSecurity.js'
import * as adminGiftTemplates from '../controllers/adminGiftTemplates.js'
import * as adminImageUpload from '../controllers/adminImageUpload.js'
import * as adminProfanity from '../controllers/adminProfanity.js'
import * as adminAffiliate from '../controllers/adminAffiliate.js'
import * as adminAmazonProducts from '../controllers/amazonProducts.js'

export async function routes(app: FastifyInstance) {
  // Health check (no auth required)
  app.get('/health', async () => ({ 
    status: 'healthy',
    service: 'admin-api',
    timestamp: new Date().toISOString()
  }))

  // Admin Authentication (no auth required)
  app.post('/admin/auth/signup', adminAuth.adminSignup)
  app.post('/admin/auth/verify-email', adminAuth.adminVerifyEmail)
  app.post('/admin/auth/login', adminAuth.adminLogin)
  app.post('/admin/auth/verify-2fa', adminAuth.adminVerifyTwoFactor)
  app.post('/admin/auth/logout', adminAuth.adminLogout)
  // app.post('/admin/auth/refresh', adminAuth.adminRefreshToken) // TODO: Implement

  // Account Cleanup Management (admin auth required)
  app.get('/admin/cleanup/logs', adminCleanup.getCleanupLogs)
  app.get('/admin/cleanup/stats', adminCleanup.getCleanupStats)
  app.get('/admin/cleanup/status', adminCleanup.getCleanupStatus)
  app.post('/admin/cleanup/trigger', adminCleanup.triggerCleanup)
  // app.get('/admin/cleanup/export', adminCleanup.exportCleanupLogs) // TODO: Implement

  // System Monitoring (admin auth required)
  app.get('/admin/monitoring/overview', adminMonitoring.getSystemOverview)
  app.get('/admin/monitoring/performance', adminMonitoring.getPerformanceMetrics)
  app.get('/admin/monitoring/errors', adminMonitoring.getErrorLogs)
  app.get('/admin/monitoring/security', adminMonitoring.getSecurityEvents)

  // Security Management (admin auth required)
  app.get('/admin/security/logs', adminSecurity.getSecurityLogs)
  app.get('/admin/security/sessions', adminSecurity.getActiveSessions)
  app.post('/admin/security/revoke-session', adminSecurity.revokeSession)
  app.get('/admin/security/audit', adminSecurity.getAuditLogs)
  app.post('/admin/security/block-ip', adminSecurity.blockIPAddress)

  // Image Upload (admin auth required)
  app.post('/admin/images/upload', adminImageUpload.uploadImageHandler)

  // Affiliate configuration (admin auth required)
  app.get('/admin/affiliate', adminAffiliate.getConfig)
  app.put('/admin/affiliate', adminAffiliate.updateConfig)
  app.post('/admin/amazon/product-info', adminAmazonProducts.resolve)

  // Gift Template Management (admin auth required)
  app.get('/admin/gift-templates', adminGiftTemplates.listGiftTemplates)
  app.post('/admin/gift-templates', adminGiftTemplates.createGiftTemplate)
  app.get('/admin/gift-templates/:id', adminGiftTemplates.getGiftTemplate)
  app.patch('/admin/gift-templates/:id', adminGiftTemplates.updateGiftTemplate)
  app.delete('/admin/gift-templates/:id', adminGiftTemplates.deleteGiftTemplate)
  app.post('/admin/gift-templates/generate-affiliate-url', adminGiftTemplates.generateAffiliateUrl)

  // Profanity Word Management (admin auth required)
  app.get('/admin/profanity/words', adminProfanity.listProfanityWords)
  app.post('/admin/profanity/words', adminProfanity.createProfanityWord)
  app.post('/admin/profanity/words/bulk', adminProfanity.bulkUploadProfanityWords)
  app.delete('/admin/profanity/words/:id', adminProfanity.deleteProfanityWord)
  app.post('/admin/profanity/words/delete', adminProfanity.deleteProfanityWords)
  app.get('/admin/profanity/flagged', adminProfanity.getFlaggedMessages)

  // Admin Management (super admin only) - TODO: Implement admin management
  // app.get('/admin/admins', adminAuth.listAdmins)
  // app.post('/admin/admins', adminAuth.createAdmin)
  // app.patch('/admin/admins/:id', adminAuth.updateAdmin)
  // app.delete('/admin/admins/:id', adminAuth.deleteAdmin)
  // app.post('/admin/admins/:id/toggle', adminAuth.toggleAdminStatus)
}
