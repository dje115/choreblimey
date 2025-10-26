import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'
import bcrypt from 'bcrypt'
import { generateAdminToken } from '../utils/auth.js'
import { siteEmailService as emailService } from '../services/emailService.js'

interface AdminSignupBody {
  email: string
  password: string
}

interface AdminVerifyEmailBody {
  token: string
}

interface AdminLoginBody {
  email: string
  password: string
}

interface AdminTwoFactorBody {
  email: string
  password: string
  code: string
  ipAddress?: string
}

/**
 * POST /admin/auth/signup
 * Admin signup endpoint
 */
export const adminSignup = async (req: FastifyRequest<{ Body: AdminSignupBody }>, reply: FastifyReply) => {
  try {
    const { email, password } = req.body

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create admin (mock)
    const admin = { id: 'mock-admin-id', email, passwordHash }

    // Generate verification token
    const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

    // Send verification email
    await emailService.sendAdminVerificationEmail(email, verificationToken)

    reply.status(201).send({ success: true, message: 'Admin account created. Please check your email for verification.' })
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

    // Mock verification
    reply.send({ success: true, message: 'Email verified successfully. You can now log in.' })
  } catch (error) {
    console.error('Admin email verification error:', error)
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

    // Mock admin verification
    const admin = {
      id: 'mock-admin-id',
      email,
      passwordHash: 'mock-hash',
      isActive: true,
      emailVerified: true,
      role: 'admin'
    }

    // Generate and send 2FA code
    const twoFactorCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Send 2FA code via email
    await emailService.sendAdminTwoFactorCode(email, twoFactorCode)

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
    const { email, password, code, ipAddress } = req.body

    // Mock 2FA verification
    const admin = {
      id: 'mock-admin-id',
      email,
      role: 'admin'
    }

    // Create admin session
    const session = { id: 'mock-session-id', adminId: admin.id }

    // Generate admin token
    const token = generateAdminToken(admin.id, admin.email, admin.role as 'super_admin' | 'admin')

    return {
      success: true,
      token,
      sessionId: session.id,
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
    const { adminClaims } = req
    if (!adminClaims) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    // Mock logout
    reply.send({ success: true, message: 'Admin logged out successfully' })
  } catch (error) {
    console.error('Admin logout error:', error)
    reply.status(500).send({ error: 'Admin logout failed' })
  }
}