import nodemailer from 'nodemailer'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth?: {
    user: string
    pass: string
  }
  from: string
}

class AdminEmailService {
  private transporter: nodemailer.Transporter | null = null
  private config: EmailConfig | null = null

  async initialize() {
    try {
      this.config = {
        host: process.env.ADMIN_SMTP_HOST || process.env.SMTP_HOST || 'mailhog',
        port: parseInt(process.env.ADMIN_SMTP_PORT || process.env.SMTP_PORT || '1025'),
        secure: process.env.ADMIN_SMTP_SECURE === 'true',
        auth: process.env.ADMIN_SMTP_USER && process.env.ADMIN_SMTP_PASS ? {
          user: process.env.ADMIN_SMTP_USER,
          pass: process.env.ADMIN_SMTP_PASS
        } : undefined,
        from: process.env.ADMIN_SMTP_FROM || process.env.SMTP_FROM || 'admin@choreblimey.com'
      }

      this.transporter = nodemailer.createTransport(this.config)
      console.log('📧 Admin email service initialized')
    } catch (error) {
      console.error('❌ Failed to initialize admin email service:', error)
    }
  }

  async sendAdminVerificationEmail(email: string, token: string) {
    if (!this.transporter) {
      console.error('❌ Admin email service not initialized')
      return false
    }

    const verificationUrl = `${process.env.ADMIN_WEB_URL || 'http://localhost:1503'}/admin/verify-email?token=${token}`
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Admin Account Verification - ChoreBlimey</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1f2937; color: white; padding: 20px; text-align: center; }
          .content { background: #f9fafb; padding: 30px; }
          .button { 
            display: inline-block; 
            background: #3b82f6; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            margin: 20px 0;
          }
          .footer { background: #e5e7eb; padding: 20px; text-align: center; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛡️ ChoreBlimey Admin</h1>
            <p>Account Verification Required</p>
          </div>
          <div class="content">
            <h2>Welcome to ChoreBlimey Admin!</h2>
            <p>Your admin account has been created and needs to be verified before you can access the admin dashboard.</p>
            <p>Click the button below to verify your email address:</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px;">${verificationUrl}</p>
            <p><strong>This link will expire in 24 hours.</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated message from ChoreBlimey Admin System</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `

    try {
      await this.transporter.sendMail({
        from: this.config!.from,
        to: email,
        subject: '🛡️ ChoreBlimey Admin - Verify Your Email',
        html
      })
      console.log(`📧 Admin verification email sent to ${email}`)
      return true
    } catch (error) {
      console.error(`❌ Failed to send admin verification email to ${email}:`, error)
      return false
    }
  }

  async sendAdminTwoFactorCode(email: string, code: string) {
    if (!this.transporter) {
      console.error('❌ Admin email service not initialized')
      return false
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Admin Two-Factor Authentication - ChoreBlimey</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { background: #fef2f2; padding: 30px; }
          .code { 
            font-size: 32px; 
            font-weight: bold; 
            color: #dc2626; 
            text-align: center; 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
            letter-spacing: 4px;
          }
          .footer { background: #e5e7eb; padding: 20px; text-align: center; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Admin Security Code</h1>
            <p>Two-Factor Authentication Required</p>
          </div>
          <div class="content">
            <h2>Security Code for Admin Login</h2>
            <p>Someone is attempting to log into your ChoreBlimey admin account. Use the code below to complete the login:</p>
            <div class="code">${code}</div>
            <p><strong>This code will expire in 10 minutes.</strong></p>
            <p>If you didn't request this login, please change your password immediately and contact support.</p>
          </div>
          <div class="footer">
            <p>This is an automated security message from ChoreBlimey Admin System</p>
            <p>Never share this code with anyone.</p>
          </div>
        </div>
      </body>
      </html>
    `

    try {
      await this.transporter.sendMail({
        from: this.config!.from,
        to: email,
        subject: '🔐 ChoreBlimey Admin - Security Code',
        html
      })
      console.log(`📧 Admin 2FA code sent to ${email}`)
      return true
    } catch (error) {
      console.error(`❌ Failed to send admin 2FA code to ${email}:`, error)
      return false
    }
  }
}

export const siteEmailService = new AdminEmailService()
