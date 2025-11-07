/**
 * Admin Profanity Word Management Controller
 * Handles CRUD operations and bulk upload for profanity words
 */

import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'

/**
 * Normalize word for storage (lowercase, trim)
 */
function normalizeWordForStorage(word: string): string {
  return word.toLowerCase().trim()
}

interface CreateProfanityWordBody {
  word: string
}

interface BulkUploadBody {
  words: string[]
}

/**
 * GET /admin/profanity/words
 * Get all profanity words
 */
export const listProfanityWords = async (
  req: FastifyRequest<{ 
    Querystring: { 
      limit?: string
      offset?: string
      search?: string
    } 
  }>, 
  reply: FastifyReply
) => {
  try {
    const { limit = '1000', offset = '0', search } = req.query
    
    const limitNum = Math.min(parseInt(limit, 10), 2000) // Max 2000 words
    const offsetNum = parseInt(offset, 10)
    
    const whereClause: any = {}
    if (search) {
      whereClause.word = {
        contains: search.toLowerCase(),
        mode: 'insensitive'
      }
    }
    
    const [words, total] = await Promise.all([
      prisma.profanityWord.findMany({
        where: whereClause,
        orderBy: { word: 'asc' },
        take: limitNum,
        skip: offsetNum
      }),
      prisma.profanityWord.count({ where: whereClause })
    ])
    
    return {
      success: true,
      words: words.map(w => ({ id: w.id, word: w.word })),
      total,
      limit: limitNum,
      offset: offsetNum
    }
  } catch (error) {
    console.error('Error listing profanity words:', error)
    reply.status(500).send({ error: 'Failed to list profanity words' })
  }
}

/**
 * POST /admin/profanity/words
 * Create a single profanity word
 */
export const createProfanityWord = async (
  req: FastifyRequest<{ Body: CreateProfanityWordBody }>,
  reply: FastifyReply
) => {
  try {
    const { word } = req.body
    
    if (!word || typeof word !== 'string' || word.trim().length === 0) {
      return reply.status(400).send({ error: 'Word is required' })
    }
    
    const normalizedWord = normalizeWordForStorage(word)
    
    if (normalizedWord.length < 2) {
      return reply.status(400).send({ error: 'Word must be at least 2 characters' })
    }
    
    // Check if word already exists
    const existing = await prisma.profanityWord.findUnique({
      where: { word: normalizedWord }
    })
    
    if (existing) {
      return reply.status(409).send({ error: 'Word already exists' })
    }
    
    const created = await prisma.profanityWord.create({
      data: { word: normalizedWord }
    })
    
    // Note: Cache in main API will refresh automatically within 10 seconds (TTL)
    // The main API's cache checks the database on every request after TTL expires
    
    return {
      success: true,
      word: created.word
    }
  } catch (error: any) {
    console.error('Error creating profanity word:', error)
    if (error.code === 'P2002') {
      return reply.status(409).send({ error: 'Word already exists' })
    }
    reply.status(500).send({ error: 'Failed to create profanity word' })
  }
}

/**
 * POST /admin/profanity/words/bulk
 * Bulk upload profanity words from a list
 */
export const bulkUploadProfanityWords = async (
  req: FastifyRequest<{ Body: BulkUploadBody }>,
  reply: FastifyReply
) => {
  try {
    const { words } = req.body
    
    if (!Array.isArray(words) || words.length === 0) {
      return reply.status(400).send({ error: 'Words array is required and must not be empty' })
    }
    
    if (words.length > 2000) {
      return reply.status(400).send({ error: 'Maximum 2000 words allowed per upload' })
    }
    
    // Normalize and deduplicate words
    const normalizedWords = words
      .map(w => typeof w === 'string' ? normalizeWordForStorage(w) : '')
      .filter(w => w.length >= 2) // Filter out empty/short words
      .filter((w, index, self) => self.indexOf(w) === index) // Deduplicate
    
    if (normalizedWords.length === 0) {
      return reply.status(400).send({ error: 'No valid words found after normalization' })
    }
    
    // Check existing words
    const existingWords = await prisma.profanityWord.findMany({
      where: {
        word: { in: normalizedWords }
      },
      select: { word: true }
    })
    
    const existingWordSet = new Set(existingWords.map(w => w.word))
    const newWords = normalizedWords.filter(w => !existingWordSet.has(w))
    
    if (newWords.length === 0) {
      return {
        success: true,
        message: 'All words already exist',
        added: 0,
        skipped: normalizedWords.length,
        total: normalizedWords.length
      }
    }
    
    // Bulk insert new words
    await prisma.profanityWord.createMany({
      data: newWords.map(word => ({ word })),
      skipDuplicates: true
    })
    
    // Invalidate cache in main API
    
    return {
      success: true,
      message: `Added ${newWords.length} new words`,
      added: newWords.length,
      skipped: normalizedWords.length - newWords.length,
      total: normalizedWords.length
    }
  } catch (error) {
    console.error('Error bulk uploading profanity words:', error)
    reply.status(500).send({ error: 'Failed to bulk upload profanity words' })
  }
}

/**
 * DELETE /admin/profanity/words/:id
 * Delete a profanity word by ID
 */
export const deleteProfanityWord = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const { id } = req.params
    
    await prisma.profanityWord.delete({
      where: { id }
    })
    
    // Invalidate cache
    
    return {
      success: true,
      message: 'Word deleted successfully'
    }
  } catch (error: any) {
    console.error('Error deleting profanity word:', error)
    if (error.code === 'P2025') {
      return reply.status(404).send({ error: 'Word not found' })
    }
    reply.status(500).send({ error: 'Failed to delete profanity word' })
  }
}

/**
 * POST /admin/profanity/words/delete
 * Delete multiple profanity words by word value
 */
export const deleteProfanityWords = async (
  req: FastifyRequest<{ Body: { words: string[] } }>,
  reply: FastifyReply
) => {
  try {
    const { words } = req.body
    
    if (!Array.isArray(words) || words.length === 0) {
      return reply.status(400).send({ error: 'Words array is required' })
    }
    
    const normalizedWords = words.map(w => normalizeWordForStorage(w))
    
    const result = await prisma.profanityWord.deleteMany({
      where: {
        word: { in: normalizedWords }
      }
    })
    
    // Invalidate cache
    
    return {
      success: true,
      deleted: result.count,
      message: `Deleted ${result.count} word(s)`
    }
  } catch (error) {
    console.error('Error deleting profanity words:', error)
    reply.status(500).send({ error: 'Failed to delete profanity words' })
  }
}

/**
 * GET /admin/profanity/flagged
 * Get flagged messages for review
 */
export const getFlaggedMessages = async (
  req: FastifyRequest<{ 
    Querystring: { 
      limit?: string
      offset?: string
      familyId?: string
    } 
  }>,
  reply: FastifyReply
) => {
  try {
    const { limit = '50', offset = '0', familyId } = req.query
    
    const limitNum = parseInt(limit, 10)
    const offsetNum = parseInt(offset, 10)
    
    const whereClause: any = {}
    if (familyId) {
      whereClause.familyId = familyId
    }
    
    const [flaggedMessages, total] = await Promise.all([
      prisma.flaggedMessage.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip: offsetNum
      }),
      prisma.flaggedMessage.count({ where: whereClause })
    ])
    
    return {
      success: true,
      flaggedMessages,
      total,
      limit: limitNum,
      offset: offsetNum
    }
  } catch (error) {
    console.error('Error getting flagged messages:', error)
    reply.status(500).send({ error: 'Failed to get flagged messages' })
  }
}

