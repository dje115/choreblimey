import { emailService } from './emailService.js'

interface SiteEmailConfig {
  useMailHog: boolean
  useRealSMTP: boolean
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  smtpFrom: string
}

class SiteEmailService {
  private config: SiteEmailConfig | null = null

  // Load configuration from database or environment
  async loadConfig(): Promise<SiteEmailConfig> {
    if (this.config) return this.config

    // For now, use environment variables
    // In production, this would load from a database table
    this.config = {
      useMailHog: process.env.USE_MAILHOG !== 'false',
      useRealSMTP: process.env.USE_REAL_SMTP === 'true',
      smtpHost: process.env.SMTP_HOST || 'mailhog',
      smtpPort: parseInt(process.env.SMTP_PORT || '1025'),
      smtpUser: process.env.SMTP_USER || '',
      smtpPass: process.env.SMTP_PASS || '',
      smtpFrom: process.env.SMTP_FROM || 'noreply@choreblimey.com'
    }

    return this.config
  }

  // Update configuration (called from admin portal)
  async updateConfig(config: SiteEmailConfig): Promise<void> {
    this.config = config
    // In production, save to database
    console.log('📧 Site email configuration updated:', {
      useMailHog: config.useMailHog,
      useRealSMTP: config.useRealSMTP,
      smtpHost: config.smtpHost
    })
  }

  // Send admin emails
  async sendAdminVerificationEmail(email: string, token: string): Promise<boolean> {
    const config = await this.loadConfig()
    return emailService.sendVerificationEmail(email, token, config)
  }

  async sendAdminTwoFactorCode(email: string, code: string): Promise<boolean> {
    const config = await this.loadConfig()
    return emailService.sendTwoFactorCode(email, code, config)
  }

  // Send family emails
  async sendFamilyWelcomeEmail(email: string, familyName: string): Promise<boolean> {
    const config = await this.loadConfig()
    const emailContent = {
      from: config.smtpFrom,
      to: email,
      subject: `Welcome to ChoreBlimey - ${familyName} Family`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to ChoreBlimey!</h2>
          <p>Your family <strong>${familyName}</strong> has been set up successfully.</p>
          <p>You can now start creating chores and managing your children's rewards!</p>
          <a href="${process.env.WEB_URL || 'http://localhost:1500'}/login" 
             style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
            Get Started
          </a>
        </div>
      `
    }

    return this.sendEmail(emailContent, config)
  }

  async sendFamilyPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const config = await this.loadConfig()
    const emailContent = {
      from: config.smtpFrom,
      to: email,
      subject: 'ChoreBlimey - Password Reset',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>You requested to reset your ChoreBlimey password.</p>
          <a href="${process.env.WEB_URL || 'http://localhost:1500'}/reset-password?token=${resetToken}" 
             style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
            Reset Password
          </a>
          <p style="margin-top: 20px; color: #666;">
            This link will expire in 1 hour. If you didn't request this, please ignore this email.
          </p>
        </div>
      `
    }

    return this.sendEmail(emailContent, config)
  }

  // Send child emails
  async sendChoreReminderEmail(childEmail: string, childName: string, choreName: string): Promise<boolean> {
    const config = await this.loadConfig()
    const emailContent = {
      from: config.smtpFrom,
      to: childEmail,
      subject: `ChoreBlimey - Don't forget: ${choreName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hi ${childName}! 👋</h2>
          <p>Don't forget to complete your chore: <strong>${choreName}</strong></p>
          <p>Complete it to earn your rewards! 🌟</p>
          <a href="${process.env.WEB_URL || 'http://localhost:1500'}/child-dashboard" 
             style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
            View My Chores
          </a>
        </div>
      `
    }

    return this.sendEmail(emailContent, config)
  }

  async sendRewardNotificationEmail(childEmail: string, childName: string, rewardName: string): Promise<boolean> {
    const config = await this.loadConfig()
    const emailContent = {
      from: config.smtpFrom,
      to: childEmail,
      subject: `ChoreBlimey - New Reward Available: ${rewardName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Great job ${childName}! 🎉</h2>
          <p>You've earned a new reward: <strong>${rewardName}</strong></p>
          <p>Check it out in your reward store!</p>
          <a href="${process.env.WEB_URL || 'http://localhost:1500'}/child-dashboard" 
             style="background-color: #F59E0B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
            View Rewards
          </a>
        </div>
      `
    }

    return this.sendEmail(emailContent, config)
  }

  // Send system emails
  async sendSystemErrorEmail(error: string, details: string): Promise<boolean> {
    const config = await this.loadConfig()
    const emailContent = {
      from: config.smtpFrom,
      to: process.env.ADMIN_EMAIL || 'admin@choreblimey.com',
      subject: 'ChoreBlimey System Error',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>System Error Alert</h2>
          <p><strong>Error:</strong> ${error}</p>
          <p><strong>Details:</strong> ${details}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        </div>
      `
    }

    return this.sendEmail(emailContent, config)
  }

  // Generic email sending method
  private async sendEmail(emailContent: any, config: SiteEmailConfig): Promise<boolean> {
    try {
      const promises = []

      // Send to MailHog if enabled
      if (config.useMailHog) {
        promises.push(emailService.transporter!.sendMail(emailContent))
      }

      // Send to real SMTP if configured
      if (config.useRealSMTP && config.smtpUser && config.smtpPass) {
        const realSMTPTransporter = await emailService.createRealSMTPTransporter(config)
        if (realSMTPTransporter) {
          promises.push(realSMTPTransporter.sendMail(emailContent))
        }
      }

      await Promise.all(promises)
      console.log(`📧 Site email sent via ${promises.length} delivery method(s)`)
      return true
    } catch (error) {
      console.error('Failed to send site email:', error)
      return false
    }
  }
}

export const siteEmailService = new SiteEmailService()

