/**
 * Email utility for worker jobs
 */

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(options: EmailOptions) {
  // For now, we'll use a simple console log
  // In production, you'd integrate with your email service (SendGrid, AWS SES, etc.)
  console.log(`📧 Email to ${options.to}: ${options.subject}`)
  console.log(`Content: ${options.html.substring(0, 100)}...`)
  
  // TODO: Implement actual email sending
  // This could integrate with the same email service used by the API
  return Promise.resolve()
}
