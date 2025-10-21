import nodemailer from 'nodemailer'

// Configure SMTP transporter for development (MailHog)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mailhog',
  port: parseInt(process.env.SMTP_PORT || '1025'),
  secure: false, // true for 465, false for other ports
})

export async function sendMagicLink(email: string, token: string): Promise<void> {
  const magicLinkUrl = `${process.env.WEB_URL || 'http://localhost:1500'}/?token=${token}`
  
  const mailOptions = {
    from: process.env.SMTP_FROM || 'no-reply@choreblimey.local',
    to: email,
    subject: 'Welcome to ChoreBlimey! - Sign in',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6DA3FF;">Welcome to ChoreBlimey! 🎉</h1>
        <p>Click the button below to sign in to your account:</p>
        <a href="${magicLinkUrl}" 
           style="background: #6DA3FF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
          Sign in to ChoreBlimey
        </a>
        <p style="margin-top: 20px; font-size: 14px; color: #666;">
          This link will expire in 15 minutes. If you didn't request this, please ignore this email.
        </p>
      </div>
    `,
    text: `Welcome to ChoreBlimey! Click this link to sign in: ${magicLinkUrl}`
  }

  await transporter.sendMail(mailOptions)
}

export async function sendChildInvite(email: string, joinCode: string, familyName: string): Promise<void> {
  const qrData = JSON.stringify({ 
    type: 'child_join', 
    code: joinCode,
    family: familyName 
  })
  
  const mailOptions = {
    from: process.env.SMTP_FROM || 'no-reply@choreblimey.local',
    to: email,
    subject: `Invitation to join ${familyName} on ChoreBlimey!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6DA3FF;">You're invited to join ${familyName}! 🏠</h1>
        <p>Use this code to join the family on ChoreBlimey:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <h2 style="color: #333; font-size: 32px; letter-spacing: 4px; margin: 0;">${joinCode}</h2>
        </div>
        <p>Or scan the QR code below with the ChoreBlimey app:</p>
        <div style="background: white; padding: 20px; border-radius: 8px; text-align: center;">
          <img src="${await generateQRCode(qrData)}" style="max-width: 200px;" alt="Join code QR code" />
        </div>
        <p style="font-size: 14px; color: #666;">
          This invitation will expire in 7 days.
        </p>
      </div>
    `,
    text: `Join ${familyName} on ChoreBlimey! Use code: ${joinCode}`
  }

  await transporter.sendMail(mailOptions)
}

async function generateQRCode(data: string): Promise<string> {
  const QRCode = await import('qrcode')
  return QRCode.toDataURL(data, { 
    width: 200, 
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  })
}
