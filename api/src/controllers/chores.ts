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
  /** Custom star amount (overrides auto-calculation) */
  starsOverride?: number
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
  /** Updated custom star amount (overrides auto-calculation) */
  starsOverride?: number
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
    
    // Emit WebSocket event to notify all family members
    const { io } = await import('../server.js')
    if (io) {
      const { emitToFamily } = await import('../websocket/socket.js')
      emitToFamily(io, familyId, 'chore:created', {
        chore: {
          id: chore.id,
          title: chore.title,
          description: chore.description,
          frequency: chore.frequency,
          baseRewardPence: chore.baseRewardPence,
          active: chore.active
        }
      })
    }
    
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
    
    // Emit WebSocket event to notify all family members
    const { io } = await import('../server.js')
    if (io) {
      const { emitToFamily } = await import('../websocket/socket.js')
      emitToFamily(io, familyId, 'chore:updated', {
        chore: {
          id: chore.id,
          title: chore.title,
          description: chore.description,
          frequency: chore.frequency,
          baseRewardPence: chore.baseRewardPence,
          active: chore.active
        }
      })
    }
    
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

/**
 * Delete a chore
 * @route DELETE /chores/:id
 * @description Deletes the specified chore and all associated assignments
 * @param {FastifyRequest<{ Params: { id: string } }>} req - Request with chore ID
 * @param {FastifyReply} reply - Fastify reply object
 * @returns {Promise<void>} Success message
 * @throws {404} Not Found - Chore not found
 * @throws {500} Internal Server Error - Database error
 */
export const remove = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> => {
  try {
    const { familyId } = req.claims!
    const { id } = req.params
    
    // Verify chore exists and belongs to family
    const chore = await choreService.getChoreById(id, familyId)
    
    if (!chore) {
      return sendError(reply, ErrorCode.RESOURCE_NOT_FOUND, 'Chore not found', 404)
    }
    
    // Delete the chore (assignments will be cascade deleted)
    await choreService.deleteChore(id, familyId)
    
    // Emit WebSocket event to notify all family members
    const { io } = await import('../server.js')
    if (io) {
      const { emitToFamily } = await import('../websocket/socket.js')
      emitToFamily(io, familyId, 'chore:deleted', {
        choreId: id
      })
    }
    
    return { message: 'Chore deleted successfully' }
  } catch (error: any) {
    console.error('Error deleting chore:', error)
    
    if (error.code === ErrorCode.RESOURCE_NOT_FOUND) {
      return sendError(reply, error.code, error.message, 404)
    }
    
    sendError(reply, ErrorCode.SYSTEM_DATABASE_ERROR, 'Failed to delete chore', 500)
  }
}
