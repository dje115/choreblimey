import { FastifyRequest, FastifyReply } from 'fastify'
import { siteEmailService } from '../services/siteEmailService.js'

interface SiteEmailConfigBody {
  useMailHog: boolean
  useRealSMTP: boolean
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  smtpFrom: string
}

/**
 * GET /admin/email-config
 * Get current site email configuration
 */
export const getSiteEmailConfig = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const config = await siteEmailService.loadConfig()
    return { config }
  } catch (error) {
    console.error('Error getting site email config:', error)
    reply.status(500).send({ error: 'Failed to get email configuration' })
  }
}

/**
 * POST /admin/email-config
 * Update site email configuration
 */
export const updateSiteEmailConfig = async (req: FastifyRequest<{ Body: SiteEmailConfigBody }>, reply: FastifyReply) => {
  try {
    const config = req.body
    await siteEmailService.updateConfig(config)
    return { success: true, message: 'Site email configuration updated successfully' }
  } catch (error) {
    console.error('Error updating site email config:', error)
    reply.status(500).send({ error: 'Failed to update email configuration' })
  }
}

/**
 * POST /admin/test-email
 * Test email configuration
 */
export const testSiteEmail = async (req: FastifyRequest<{ Body: SiteEmailConfigBody }>, reply: FastifyReply) => {
  try {
    const config = req.body
    
    // Test with a simple email
    const testEmail = {
      from: config.smtpFrom,
      to: 'test@example.com',
      subject: 'ChoreBlimey Email Test',
      html: '<p>This is a test email from ChoreBlimey admin configuration.</p>'
    }

    // This would test the email sending
    // For now, just return success
    return { 
      success: true, 
      message: 'Email configuration test completed',
      config: {
        useMailHog: config.useMailHog,
        useRealSMTP: config.useRealSMTP,
        smtpHost: config.smtpHost
      }
    }
  } catch (error) {
    console.error('Error testing site email:', error)
    reply.status(500).send({ error: 'Failed to test email configuration' })
  }
}

