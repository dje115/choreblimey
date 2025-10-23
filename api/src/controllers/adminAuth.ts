import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'
import { generateToken } from '../utils/crypto.js'
import { siteEmailService } from '../services/siteEmailService.js'
import bcrypt from 'bcryptjs'

interface AdminLoginBody {
  email: string
  password: string
}

interface AdminSignupBody {
  email: string
  password: string
  name?: string
}

interface AdminVerifyEmailBody {
  token: string
}

interface AdminTwoFactorBody {
  email: string
  password: string
  code: string
}

/**
 * POST /admin/auth/signup
 * Admin signup endpoint
 */
export const adminSignup = async (req: FastifyRequest<{ Body: AdminSignupBody }>, reply: FastifyReply) => {
  try {
    const { email, password, name } = req.body

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email }
    })

    if (existingAdmin) {
      return reply.status(400).send({ error: 'Admin account already exists' })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)
    
    // Generate verification token
    const verificationToken = generateToken()
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create admin account
    const admin = await prisma.admin.create({
      data: {
        email,
        passwordHash,
        name,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires
      }
    })

    // Send verification email
    await siteEmailService.sendAdminVerificationEmail(email, verificationToken)

    return {
      success: true,
      message: 'Admin account created. Please check your email to verify your account.',
      adminId: admin.id
    }
  } catch (error) {
    console.error('Admin signup error:', error)
    reply.status(500).send({ error: 'Admin signup failed' })
  }
}

/**
 * POST /admin/auth/verify-email
 * Verify admin email
 */
export const adminVerifyEmail = async (req: FastifyRequest<{ Body: AdminVerifyEmailBody }>, reply: FastifyReply) => {
  try {
    const { token } = req.body

    const admin = await prisma.admin.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gt: new Date()
        }
      }
    })

    if (!admin) {
      return reply.status(400).send({ error: 'Invalid or expired verification token' })
    }

    // Mark email as verified and activate account
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        emailVerified: true,
        isActive: true,
        emailVerificationToken: null,
        emailVerificationExpires: null
      }
    })

    return {
      success: true,
      message: 'Email verified successfully. Your admin account is now active.'
    }
  } catch (error) {
    console.error('Email verification error:', error)
    reply.status(500).send({ error: 'Email verification failed' })
  }
}

/**
 * POST /admin/auth/login
 * Admin login endpoint (with 2FA)
 */
export const adminLogin = async (req: FastifyRequest<{ Body: AdminLoginBody }>, reply: FastifyReply) => {
  try {
    const { email, password } = req.body

    // Find admin
    const admin = await prisma.admin.findUnique({
      where: { email }
    })

    if (!admin) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    // Check if account is active and verified
    if (!admin.isActive || !admin.emailVerified) {
      return reply.status(401).send({ error: 'Account not verified. Please check your email.' })
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, admin.passwordHash)
    if (!passwordValid) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    // Generate and send 2FA code
    const twoFactorCode = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Store 2FA code
    await prisma.twoFactorCode.create({
      data: {
        adminId: admin.id,
        code: twoFactorCode,
        expiresAt
      }
    })

    // Send 2FA code via email
    await siteEmailService.sendAdminTwoFactorCode(email, twoFactorCode)

    return {
      success: true,
      message: 'Two-factor authentication code sent to your email',
      requiresTwoFactor: true
    }
  } catch (error) {
    console.error('Admin login error:', error)
    reply.status(500).send({ error: 'Admin login failed' })
  }
}

/**
 * POST /admin/auth/verify-2fa
 * Verify 2FA code and complete login
 */
export const adminVerifyTwoFactor = async (req: FastifyRequest<{ Body: AdminTwoFactorBody }>, reply: FastifyReply) => {
  try {
    const { email, password, code } = req.body

    // Find admin
    const admin = await prisma.admin.findUnique({
      where: { email }
    })

    if (!admin) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    // Verify password again
    const passwordValid = await bcrypt.compare(password, admin.passwordHash)
    if (!passwordValid) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    // Find valid 2FA code
    const twoFactorCode = await prisma.twoFactorCode.findFirst({
      where: {
        adminId: admin.id,
        code,
        expiresAt: {
          gt: new Date()
        },
        used: false
      }
    })

    if (!twoFactorCode) {
      return reply.status(401).send({ error: 'Invalid or expired 2FA code' })
    }

    // Mark code as used
    await prisma.twoFactorCode.update({
      where: { id: twoFactorCode.id },
      data: { used: true }
    })

    // Update last login
    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() }
    })

    // Generate admin token
    const token = generateToken()

    return {
      success: true,
      token,
      message: 'Admin login successful'
    }
  } catch (error) {
    console.error('2FA verification error:', error)
    reply.status(500).send({ error: '2FA verification failed' })
  }
}

/**
 * POST /admin/auth/logout
 * Admin logout endpoint
 */
export const adminLogout = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    // In production, you might want to invalidate the token
    return {
      success: true,
      message: 'Admin logout successful'
    }
  } catch (error) {
    console.error('Admin logout error:', error)
    reply.status(500).send({ error: 'Admin logout failed' })
  }
}
