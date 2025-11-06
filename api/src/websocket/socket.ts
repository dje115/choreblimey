/**
 * WebSocket server for real-time updates
 * 
 * Handles Socket.io connections with authentication and room-based messaging
 * Rooms are organized by familyId to ensure users only receive updates from their family
 * 
 * @module websocket/socket
 */

import { Server as SocketIOServer } from 'socket.io'
import jwt from 'jsonwebtoken'
import type { Claims } from '../utils/auth.js'

export interface SocketData {
  userId: string
  familyId: string
  role: string
  email?: string
  childId?: string
}

/**
 * Initialize Socket.io server with authentication
 */
export function initializeSocketIO(server: any): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'] // Fallback to polling if WebSocket fails
  })

  // Authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '')
      
      if (!token) {
        return next(new Error('Authentication token required'))
      }

      const claims = jwt.verify(token, process.env.JWT_SECRET!) as Claims
      
      // Attach user data to socket
      socket.data = {
        userId: claims.sub,
        familyId: claims.familyId,
        role: claims.role,
        email: claims.email,
        childId: claims.childId
      }

      console.log('🔌 WebSocket authenticated:', {
        userId: socket.data.userId,
        familyId: socket.data.familyId,
        role: socket.data.role
      })

      next()
    } catch (error) {
      console.error('❌ WebSocket authentication failed:', error)
      next(new Error('Authentication failed'))
    }
  })

  // Connection handler
  io.on('connection', (socket) => {
    const { userId, familyId, role } = socket.data as SocketData

    console.log('✅ WebSocket connected:', { userId, familyId, role })

    // Join family room - all family members receive updates
    const familyRoom = `family:${familyId}`
    socket.join(familyRoom)
    console.log(`👥 Socket joined room: ${familyRoom}`)

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', { userId, familyId, reason })
    })

    // Handle errors
    socket.on('error', (error) => {
      console.error('❌ WebSocket error:', { userId, familyId, error })
    })
  })

  return io
}

/**
 * Emit event to all members of a family
 */
export function emitToFamily(io: SocketIOServer, familyId: string, event: string, data: any): void {
  const familyRoom = `family:${familyId}`
  io.to(familyRoom).emit(event, data)
  console.log(`📢 Emitted ${event} to room ${familyRoom}`, { familyId, event, dataKeys: Object.keys(data) })
}

/**
 * Emit event to specific user
 */
export function emitToUser(io: SocketIOServer, userId: string, event: string, data: any): void {
  io.to(userId).emit(event, data)
  console.log(`📢 Emitted ${event} to user ${userId}`, { event, dataKeys: Object.keys(data) })
}

