import nodemailer from 'nodemailer'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null

  constructor() {
    this.initializeTransporter()
  }

  private initializeTransporter() {
    // Use the same SMTP configuration as the rest of the system
    const config: EmailConfig = {
      host: process.env.SMTP_HOST || 'mailhog',
      port: parseInt(process.env.SMTP_PORT || '1025'),
      secure: false, // MailHog doesn't use SSL
      auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      } : undefined
    }

    // Always create transporter (MailHog doesn't require auth)
    this.transporter = nodemailer.createTransport(config)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📧 Email service configured: ${config.host}:${config.port}`)
      console.log(`📧 View emails at: http://localhost:1506`)
    }
  }

  private async createRealSMTPTransporter(config: any): Promise<nodemailer.Transporter | null> {
    if (!config.useRealSMTP || !config.smtpUser || !config.smtpPass) {
      return null
    }

    const smtpConfig: EmailConfig = {
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass
      }
    }

    return nodemailer.createTransport(smtpConfig)
  }

  async sendVerificationEmail(email: string, token: string, config?: any): Promise<boolean> {
    const emailContent = {
      from: process.env.SMTP_FROM || 'noreply@choreblimey.com',
      to: email,
      subject: 'ChoreBlimey Admin - Email Verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to ChoreBlimey Admin!</h2>
          <p>Please verify your email address by clicking the link below:</p>
          <a href="${process.env.ADMIN_BASE_URL || 'http://localhost:1500'}/admin/verify-email?token=${token}" 
             style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Verify Email Address
          </a>
          <p style="margin-top: 20px; color: #666;">
            This link will expire in 24 hours. If you didn't request this, please ignore this email.
          </p>
        </div>
      `
    }

    try {
      const promises = []

      // Send to MailHog if enabled
      if (!config || config.useMailHog !== false) {
        promises.push(this.transporter!.sendMail(emailContent))
      }

      // Send to real SMTP if configured
      if (config && config.useRealSMTP) {
        const realSMTPTransporter = await this.createRealSMTPTransporter(config)
        if (realSMTPTransporter) {
          promises.push(realSMTPTransporter.sendMail(emailContent))
        }
      }

      await Promise.all(promises)
      console.log(`📧 Verification email sent to ${email} via ${promises.length} delivery method(s)`)
      return true
    } catch (error) {
      console.error('Failed to send verification email:', error)
      return false
    }
  }

  async sendTwoFactorCode(email: string, code: string, config?: any): Promise<boolean> {
    const emailContent = {
      from: process.env.SMTP_FROM || 'noreply@choreblimey.com',
      to: email,
      subject: 'ChoreBlimey Admin - Two-Factor Authentication Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Your Two-Factor Authentication Code</h2>
          <p>Use this code to complete your admin login:</p>
          <div style="background-color: #F3F4F6; padding: 20px; text-align: center; border-radius: 6px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #1F2937; letter-spacing: 4px;">${code}</span>
          </div>
          <p style="color: #666;">
            This code will expire in 10 minutes. If you didn't request this, please ignore this email.
          </p>
        </div>
      `
    }

    try {
      const promises = []

      // Send to MailHog if enabled
      if (!config || config.useMailHog !== false) {
        promises.push(this.transporter!.sendMail(emailContent))
      }

      // Send to real SMTP if configured
      if (config && config.useRealSMTP) {
        const realSMTPTransporter = await this.createRealSMTPTransporter(config)
        if (realSMTPTransporter) {
          promises.push(realSMTPTransporter.sendMail(emailContent))
        }
      }

      await Promise.all(promises)
      console.log(`📧 2FA code sent to ${email} via ${promises.length} delivery method(s): ${code}`)
      return true
    } catch (error) {
      console.error('Failed to send 2FA code:', error)
      return false
    }
  }
}

export const emailService = new EmailService()
