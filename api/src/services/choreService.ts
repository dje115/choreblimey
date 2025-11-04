import { prisma } from '../db/prisma.js'
import { ErrorCode, createError } from '../utils/errors.js'
import { ChoreCreateSchema, ChoreUpdateSchema } from '../utils/validation.js'

/**
 * Chore service for managing family chores
 */
export class ChoreService {
  /**
   * Get all chores for a family
   * @param familyId - Family ID
   * @returns Promise<Chore[]> List of chores
   */
  async getChoresByFamily(familyId: string): Promise<any[]> {
    return await prisma.chore.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * Create a new chore
   * @param familyId - Family ID
   * @param choreData - Chore creation data
   * @returns Promise<Chore> Created chore
   * @throws {Error} Validation or database error
   */
  async createChore(familyId: string, choreData: any): Promise<any> {
    // Validate input data
    const validationResult = ChoreCreateSchema.safeParse(choreData)
    if (!validationResult.success) {
      throw createError(
        ErrorCode.VALIDATION_INVALID_INPUT,
        'Invalid chore data',
        validationResult.error.errors
      )
    }

    const validatedData = validationResult.data

    // Create chore
    const chore = await prisma.chore.create({
      data: {
        familyId,
        title: validatedData.title,
        description: validatedData.description,
        frequency: validatedData.frequency,
        proof: validatedData.proof,
        baseRewardPence: validatedData.baseRewardPence,
        starsOverride: validatedData.starsOverride ?? null,
        minBidPence: validatedData.minBidPence || Math.floor(validatedData.baseRewardPence * 0.5),
        maxBidPence: validatedData.maxBidPence || Math.floor(validatedData.baseRewardPence * 1.5),
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null
      }
    })

    return chore
  }

  /**
   * Update an existing chore
   * @param choreId - Chore ID
   * @param familyId - Family ID (for security)
   * @param updateData - Update data
   * @returns Promise<Chore> Updated chore
   * @throws {Error} Chore not found or validation error
   */
  async updateChore(choreId: string, familyId: string, updateData: any): Promise<any> {
    // Validate input data
    const validationResult = ChoreUpdateSchema.safeParse(updateData)
    if (!validationResult.success) {
      throw createError(
        ErrorCode.VALIDATION_INVALID_INPUT,
        'Invalid update data',
        validationResult.error.errors
      )
    }

    const validatedData = validationResult.data

    // Verify chore belongs to family
    const existingChore = await prisma.chore.findFirst({
      where: { id: choreId, familyId }
    })

    if (!existingChore) {
      throw createError(ErrorCode.RESOURCE_NOT_FOUND, 'Chore not found')
    }

    // Convert date strings to Date objects if provided
    const dataToUpdate: any = { ...validatedData }
    if (validatedData.startDate !== undefined) {
      dataToUpdate.startDate = validatedData.startDate ? new Date(validatedData.startDate) : null
    }
    if (validatedData.endDate !== undefined) {
      dataToUpdate.endDate = validatedData.endDate ? new Date(validatedData.endDate) : null
    }

    // Update chore
    const chore = await prisma.chore.update({
      where: { id: choreId },
      data: dataToUpdate
    })

    return chore
  }

  /**
   * Delete a chore
   * @param choreId - Chore ID
   * @param familyId - Family ID (for security)
   * @returns Promise<void>
   * @throws {Error} Chore not found
   */
  async deleteChore(choreId: string, familyId: string): Promise<void> {
    // Verify chore belongs to family
    const existingChore = await prisma.chore.findFirst({
      where: { id: choreId, familyId }
    })

    if (!existingChore) {
      throw createError(ErrorCode.RESOURCE_NOT_FOUND, 'Chore not found')
    }

    // Delete chore
    await prisma.chore.delete({
      where: { id: choreId }
    })
  }

  /**
   * Get chore by ID
   * @param choreId - Chore ID
   * @param familyId - Family ID (for security)
   * @returns Promise<Chore | null> Chore or null if not found
   */
  async getChoreById(choreId: string, familyId: string): Promise<any | null> {
    return await prisma.chore.findFirst({
      where: { id: choreId, familyId }
    })
  }

  /**
   * Get active chores for a family
   * @param familyId - Family ID
   * @returns Promise<Chore[]> List of active chores
   */
  async getActiveChores(familyId: string): Promise<any[]> {
    return await prisma.chore.findMany({
      where: { 
        familyId,
        active: true 
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * Get chores by frequency
   * @param familyId - Family ID
   * @param frequency - Chore frequency
   * @returns Promise<Chore[]> List of chores with specified frequency
   */
  async getChoresByFrequency(familyId: string, frequency: 'daily' | 'weekly' | 'once'): Promise<any[]> {
    return await prisma.chore.findMany({
      where: { 
        familyId,
        frequency,
        active: true 
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * Toggle chore active status
   * @param choreId - Chore ID
   * @param familyId - Family ID (for security)
   * @param active - Active status
   * @returns Promise<Chore> Updated chore
   * @throws {Error} Chore not found
   */
  async toggleChoreActive(choreId: string, familyId: string, active: boolean): Promise<any> {
    // Verify chore belongs to family
    const existingChore = await prisma.chore.findFirst({
      where: { id: choreId, familyId }
    })

    if (!existingChore) {
      throw createError(ErrorCode.RESOURCE_NOT_FOUND, 'Chore not found')
    }

    // Update active status
    const chore = await prisma.chore.update({
      where: { id: choreId },
      data: { active }
    })

    return chore
  }
}

// Export singleton instance
export const choreService = new ChoreService()
