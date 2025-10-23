import type { FastifyRequest, FastifyReply } from 'fastify'
import { ErrorCode, sendError } from '../utils/errors.js'
import { choreService } from '../services/choreService.js'

/**
 * Request body for creating a new chore
 */
interface ChoreCreateBody {
  /** Chore title (required) */
  title: string
  /** Optional description of the chore */
  description?: string
  /** How often the chore should be done */
  frequency: 'daily' | 'weekly' | 'once'
  /** Type of proof required for completion */
  proof: 'none' | 'photo' | 'note'
  /** Base reward in pence */
  baseRewardPence: number
  /** Minimum bid amount in pence (optional) */
  minBidPence?: number
  /** Maximum bid amount in pence (optional) */
  maxBidPence?: number
  /** Start date for the chore (ISO string) */
  startDate?: string
  /** End date for the chore (ISO string) */
  endDate?: string
}

/**
 * Request body for updating an existing chore
 */
interface ChoreUpdateBody {
  /** Updated chore title */
  title?: string
  /** Updated description */
  description?: string
  /** Updated frequency */
  frequency?: 'daily' | 'weekly' | 'once'
  /** Updated proof type */
  proof?: 'none' | 'photo' | 'note'
  /** Updated base reward in pence */
  baseRewardPence?: number
  /** Updated minimum bid amount in pence */
  minBidPence?: number
  /** Updated maximum bid amount in pence */
  maxBidPence?: number
  /** Updated start date (ISO string) */
  startDate?: string
  /** Updated end date (ISO string) */
  endDate?: string
  /** Whether the chore is active */
  active?: boolean
}

/**
 * Get all chores for the authenticated family
 * @route GET /chores
 * @description Retrieves all active chores for the family
 * @param {FastifyRequest} req - Fastify request object
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<void>} List of chores
 * @throws {500} Internal Server Error - Database error
 */
export const list = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
  try {
    const { familyId } = req.claims!
    
    const chores = await choreService.getChoresByFamily(familyId)
    return { chores }
  } catch (error) {
    console.error('Error fetching chores:', error)
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, 'Failed to fetch chores', 500)
  }
}

/**
 * Create a new chore for the family
 * @route POST /chores
 * @description Creates a new chore with specified details
 * @param {FastifyRequest<{ Body: ChoreCreateBody }>} req - Request with chore data
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<void>} Created chore object
 * @throws {400} Bad Request - Missing required fields
 * @throws {500} Internal Server Error - Database error
 */
export const create = async (req: FastifyRequest<{ Body: ChoreCreateBody }>, reply: FastifyReply): Promise<void> => {
  try {
    const { familyId } = req.claims!
    
    const chore = await choreService.createChore(familyId, req.body)
    return { chore }
  } catch (error: any) {
    console.error('Error creating chore:', error)
    
    if (error.code === ErrorCode.VALIDATION_INVALID_INPUT) {
      return sendError(reply, error.code, error.message, 400, error.details)
    }
    
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, 'Failed to create chore', 500)
  }
}

/**
 * Update an existing chore
 * @route PATCH /chores/:id
 * @description Updates chore details for the specified chore
 * @param {FastifyRequest<{ Params: { id: string }, Body: ChoreUpdateBody }>} req - Request with chore ID and update data
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<void>} Updated chore object
 * @throws {404} Not Found - Chore not found
 * @throws {500} Internal Server Error - Database error
 */
export const update = async (req: FastifyRequest<{ Params: { id: string }, Body: ChoreUpdateBody }>, reply: FastifyReply): Promise<void> => {
  try {
    const { familyId } = req.claims!
    const { id } = req.params
    
    const chore = await choreService.updateChore(id, familyId, req.body)
    return { chore }
  } catch (error: any) {
    console.error('Error updating chore:', error)
    
    if (error.code === ErrorCode.VALIDATION_INVALID_INPUT) {
      return sendError(reply, error.code, error.message, 400, error.details)
    }
    
    if (error.code === ErrorCode.RESOURCE_NOT_FOUND) {
      return sendError(reply, error.code, error.message, 404)
    }
    
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, 'Failed to update chore', 500)
  }
}
