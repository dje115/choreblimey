/**
 * Email utility for worker jobs
 * Uses the system-wide email configuration from admin settings
 */

import nodemailer from 'nodemailer'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

// Load system email configuration
async function getEmailConfig() {
  // Use the same configuration as the API
  return {
    useMailHog: process.env.USE_MAILHOG !== 'false',
    useRealSMTP: process.env.USE_REAL_SMTP === 'true',
    smtpHost: process.env.SMTP_HOST || 'mailhog',
    smtpPort: parseInt(process.env.SMTP_PORT || '1025'),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpFrom: process.env.SMTP_FROM || 'noreply@choreblimey.com'
  }
}

// Create transporter based on system configuration
async function createTransporter() {
  const config = await getEmailConfig()
  
  const transporterConfig = {
    host: config.smtpHost,
    port: config.smtpPort,
    secure: false, // MailHog doesn't use SSL
    auth: config.smtpUser && config.smtpPass ? {
      user: config.smtpUser,
      pass: config.smtpPass
    } : undefined
  }

  return nodemailer.createTransporter(transporterConfig)
}

export async function sendEmail(options: EmailOptions) {
  try {
    const config = await getEmailConfig()
    const transporter = await createTransporter()
    
    const mailOptions = {
      from: config.smtpFrom,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, '') // Strip HTML for text version
    }

    await transporter.sendMail(mailOptions)
    console.log(`📧 Email sent to ${options.to}: ${options.subject} via ${config.smtpHost}:${config.smtpPort}`)
    return true
  } catch (error) {
    console.error(`Failed to send email to ${options.to}:`, error)
    return false
  }
}
