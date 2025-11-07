import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma.js'
import { cache } from '../utils/cache.js'

interface SendMessageBody {
  message: string
}

interface GetMessagesQuery {
  limit?: string
  before?: string // ISO date string for pagination
  days?: string // Number of days to fetch
}

/**
 * Send a chat message
 * @route POST /chat/messages
 */
export const sendMessage = async (req: FastifyRequest<{ Body: SendMessageBody }>, reply: FastifyReply) => {
  try {
    const { familyId, sub: userId, role, childId } = req.claims!
    const { message } = req.body

    if (!message || message.trim().length === 0) {
      return reply.status(400).send({ error: 'Message cannot be empty' })
    }

    if (message.length > 1000) {
      return reply.status(400).send({ error: 'Message is too long (max 1000 characters)' })
    }

    // Filter profanity from message
    let filteredMessage = message
    let flaggedWords: string[] = []
    try {
      const { getProfanityWords } = await import('../utils/profanityCache.js')
      const { filterProfanity } = await import('../utils/profanityFilter.js')
      const profanityWords = await getProfanityWords()
      
      if (profanityWords.length > 0) {
        console.log(`🧾 Loaded ${profanityWords.length} profanity words. Sample: ${profanityWords.slice(0, 5).join(', ')}`)
        const filterResult = filterProfanity(message, profanityWords)
        filteredMessage = filterResult.filteredMessage
        flaggedWords = filterResult.flaggedWords
        
        if (filterResult.filteredMessage !== message) {
          console.log(`🚫 Filtered profanity: "${message}" -> "${filteredMessage}" (flagged: ${flaggedWords.join(', ')})`)
        }
      } else {
        console.log('⚠️ No profanity words in cache - filter not applied')
      }
    } catch (error) {
      console.error('Error filtering profanity:', error)
      // Continue with original message if filtering fails
    }

    // Store flag info for logging after message is created
    const shouldLogFlagged = flaggedWords.length > 0

    // Determine sender type and sender ID
    const senderType = role === 'child_player' ? 'child' : 'parent'
    
    // For children, use childId (Child record)
    // For parents, use userId (User record)
    const data: any = {
      familyId,
      senderType,
      message: filteredMessage.trim() // Use filtered message
    }
    
    if (role === 'child_player' && childId) {
      // Child sending message - use senderChildId
      data.senderChildId = childId
      data.senderId = null
    } else {
      // Parent sending message - use senderId (User record)
      data.senderId = userId
      data.senderChildId = null
    }

    // Create message (messages ARE stored in database - persistent across restarts)
    const newMessage = await prisma.familyMessage.create({
      data,
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            members: {
              where: { familyId },
              select: {
                id: true,
                displayName: true,
                role: true,
              },
            },
          }
        },
        senderChild: {
          select: {
            id: true,
            nickname: true,
          }
        }
      }
    })

    // Log flagged message asynchronously (don't block message sending)
    if (shouldLogFlagged) {
      // Fire and forget - log in background
      setImmediate(async () => {
        try {
          await prisma.flaggedMessage.create({
            data: {
              messageId: newMessage.id,
              familyId,
              originalMessage: message,
              filteredMessage,
              flaggedWords: flaggedWords as any, // Store as JSON
              senderId: role === 'child_player' ? childId : userId,
              senderType: role === 'child_player' ? 'child' : 'parent'
            }
          }).catch((err) => {
            console.error('Failed to log flagged message:', err)
          })
        } catch (error) {
          console.error('Error logging flagged message:', error)
        }
      })
    }

    // Invalidate cache
    await cache.invalidateFamily(familyId)

    // Emit WebSocket event to notify all family members
    const { io } = await import('../server.js')
    if (io) {
      const { emitToFamily } = await import('../websocket/socket.js')
      // Build sender info for WebSocket event
      let senderInfo: any = {}
      if (newMessage.sender) {
        senderInfo = {
          id: newMessage.sender.id,
          email: newMessage.sender.email,
          familyMembers: newMessage.sender.members || []
        }
      } else if (newMessage.senderChild) {
        senderInfo = {
          id: newMessage.senderChild.id,
          nickname: newMessage.senderChild.nickname,
          email: null
        }
      }

      emitToFamily(io, familyId, 'chat:message', {
        message: {
          id: newMessage.id,
          familyId: newMessage.familyId,
          senderId: newMessage.senderId || newMessage.senderChildId,
          senderType: newMessage.senderType,
          message: newMessage.message, // Already filtered
          createdAt: newMessage.createdAt,
          sender: senderInfo
        }
      })
    }

    // Format the response message to match getMessages format
    const formattedMessage = {
      ...newMessage,
      sender: newMessage.sender ? {
        id: newMessage.sender.id,
        email: newMessage.sender.email,
        familyMembers: newMessage.sender.members || []
      } : newMessage.senderChild ? {
        id: newMessage.senderChild.id,
        nickname: newMessage.senderChild.nickname,
        email: null
      } : null
    }
    
    return reply.send({ message: formattedMessage })
  } catch (error: any) {
    console.error('Failed to send message:', error)
    req.log.error(error, 'Failed to send chat message')
    const errorMessage = error?.message || 'Failed to send message'
    return reply.status(500).send({ error: errorMessage })
  }
}

/**
 * Get chat messages
 * @route GET /chat/messages
 */
export const getMessages = async (req: FastifyRequest<{ Querystring: GetMessagesQuery }>, reply: FastifyReply) => {
  try {
    const { familyId } = req.claims!
    const { limit = '150', before, days } = req.query

    const limitNum = Math.min(parseInt(limit, 10) || 150, 500) // Max 500 messages
    const daysNum = days ? parseInt(days, 10) : null

    // Build where clause
    const where: any = { familyId }
    
    if (before) {
      where.createdAt = { lt: new Date(before) }
    }

    if (daysNum) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysNum)
      if (where.createdAt) {
        where.createdAt = {
          ...where.createdAt,
          gte: cutoffDate
        }
      } else {
        where.createdAt = { gte: cutoffDate }
      }
    }

    // Get messages (messages ARE stored in database - persistent across restarts)
    const messages = await prisma.familyMessage.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            members: {
              where: { familyId },
              select: {
                id: true,
                displayName: true,
                role: true,
              },
            },
          }
        },
        senderChild: {
          select: {
            id: true,
            nickname: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limitNum
    })

    // Reverse to get chronological order (oldest first)
    messages.reverse()

    // Format messages for response (ensure sender info is properly structured)
    const formattedMessages = messages.map(msg => ({
      ...msg,
      sender: msg.sender ? {
        id: msg.sender.id,
        email: msg.sender.email,
        familyMembers: msg.sender.members || []
      } : msg.senderChild ? {
        id: msg.senderChild.id,
        nickname: msg.senderChild.nickname,
        email: null
      } : null
    }))

    return reply.send({ messages: formattedMessages })
  } catch (error) {
    console.error('Failed to get messages:', error)
    reply.status(500).send({ error: 'Failed to get messages' })
  }
}

