import { z } from 'zod'

/**
 * Common validation schemas for the ChoreBlimey API
 */

/**
 * Chore creation validation schema
 */
export const ChoreCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  frequency: z.enum(['daily', 'weekly', 'once'], {
    errorMap: () => ({ message: 'Frequency must be daily, weekly, or once' })
  }),
  proof: z.enum(['none', 'photo', 'note'], {
    errorMap: () => ({ message: 'Proof type must be none, photo, or note' })
  }),
  baseRewardPence: z.number().int().min(0, 'Base reward must be 0 or greater').max(10000, 'Base reward must be 10000 pence or less'),
  starsOverride: z.number().int().min(1, 'Stars override must be at least 1').max(1000, 'Stars override must be 1000 or less').optional(),
  minBidPence: z.number().int().min(0).max(10000).optional(),
  maxBidPence: z.number().int().min(0).max(10000).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
}).refine((data) => {
  // Ensure maxBidPence is greater than minBidPence if both are provided
  if (data.minBidPence && data.maxBidPence && data.maxBidPence <= data.minBidPence) {
    return false
  }
  return true
}, {
  message: 'maxBidPence must be greater than minBidPence',
  path: ['maxBidPence']
})

/**
 * Chore update validation schema
 */
export const ChoreUpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  frequency: z.enum(['daily', 'weekly', 'once']).optional(),
  proof: z.enum(['none', 'photo', 'note']).optional(),
  baseRewardPence: z.number().int().min(0).max(10000).optional(),
  starsOverride: z.number().int().min(1).max(1000).optional(),
  minBidPence: z.number().int().min(0).max(10000).optional(),
  maxBidPence: z.number().int().min(0).max(10000).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  active: z.boolean().optional()
}).refine((data) => {
  if (data.minBidPence && data.maxBidPence && data.maxBidPence <= data.minBidPence) {
    return false
  }
  return true
}, {
  message: 'maxBidPence must be greater than minBidPence',
  path: ['maxBidPence']
})

/**
 * Child creation validation schema
 */
export const ChildCreateSchema = z.object({
  nickname: z.string().min(1, 'Nickname is required').max(50, 'Nickname must be 50 characters or less'),
  realNameCipher: z.string().optional(),
  dobCipher: z.string().optional(),
  avatarId: z.string().optional(),
  ageGroup: z.string().max(20).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  theme: z.string().max(50).optional(),
  birthMonth: z.number().int().min(1).max(12).optional(),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  interestsJson: z.array(z.string()).optional()
})

/**
 * Child update validation schema
 */
export const ChildUpdateSchema = z.object({
  nickname: z.string().min(1).max(50).optional(),
  realNameCipher: z.string().optional(),
  dobCipher: z.string().optional(),
  avatarId: z.string().optional(),
  ageGroup: z.string().max(20).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  theme: z.string().max(50).optional(),
  birthMonth: z.number().int().min(1).max(12).optional(),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  interestsJson: z.array(z.string()).optional()
})

/**
 * Assignment creation validation schema
 */
export const AssignmentCreateSchema = z.object({
  choreId: z.string().uuid('Invalid chore ID format'),
  childId: z.string().uuid('Invalid child ID format').optional(),
  biddingEnabled: z.boolean().default(false)
})

/**
 * Completion creation validation schema
 */
export const CompletionCreateSchema = z.object({
  assignmentId: z.string().uuid('Invalid assignment ID format'),
  proofUrl: z.string().url('Invalid proof URL format').optional(),
  note: z.string().max(500, 'Note must be 500 characters or less').optional()
})

/**
 * Bid creation validation schema
 */
export const BidCreateSchema = z.object({
  assignmentId: z.string().uuid('Invalid assignment ID format'),
  amountPence: z.number().int().min(1, 'Bid amount must be at least 1 pence').max(10000, 'Bid amount must be 10000 pence or less'),
  disruptTargetChildId: z.string().uuid('Invalid target child ID format').optional()
})

/**
 * Payout creation validation schema
 */
export const PayoutCreateSchema = z.object({
  childId: z.string().uuid('Invalid child ID format'),
  amountPence: z.number().int().min(1, 'Payout amount must be at least 1 pence').max(100000, 'Payout amount must be 100000 pence or less'),
  method: z.enum(['cash', 'bank_transfer', 'other']).optional(),
  note: z.string().max(500, 'Note must be 500 characters or less').optional()
})

/**
 * Family update validation schema
 */
export const FamilyUpdateSchema = z.object({
  nameCipher: z.string().min(1, 'Family name is required').max(100, 'Family name must be 100 characters or less').optional(),
  region: z.string().max(50).optional(),
  maxBudgetPence: z.number().int().min(0).max(100000).optional(),
  budgetPeriod: z.enum(['weekly', 'monthly']).optional(),
  showLifetimeEarnings: z.boolean().optional()
})

/**
 * Admin signup validation schema
 */
export const AdminSignupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100, 'Password must be 100 characters or less'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less')
})

/**
 * Admin login validation schema
 */
export const AdminLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
})

/**
 * Two-factor authentication validation schema
 */
export const TwoFactorSchema = z.object({
  code: z.string().length(6, '2FA code must be 6 digits').regex(/^\d{6}$/, '2FA code must contain only digits')
})

/**
 * Email verification validation schema
 */
export const EmailVerificationSchema = z.object({
  token: z.string().min(1, 'Verification token is required')
})

/**
 * Generic validation middleware factory
 * @param schema - Zod schema to validate against
 * @returns Fastify validation middleware
 */
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return async (request: any, reply: any) => {
    try {
      const validatedData = schema.parse(request.body)
      request.validatedBody = validatedData
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
        
        return reply.status(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errorMessages
        })
      }
      
      return reply.status(400).send({
        error: 'Invalid request data',
        code: 'INVALID_REQUEST'
      })
    }
  }
}
