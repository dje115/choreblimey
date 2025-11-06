/**
 * Socket.io context for real-time updates
 * 
 * Provides WebSocket connection to the API server for real-time updates
 * across all family members (adults and children)
 * 
 * @module contexts/SocketContext
 */

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  emit: (event: string, data: any) => void
  on: (event: string, callback: (data: any) => void) => void
  off: (event: string, callback?: (data: any) => void) => void
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  emit: () => {},
  on: () => {},
  off: () => {}
})

export const useSocket = () => useContext(SocketContext)

interface SocketProviderProps {
  children: React.ReactNode
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth()
  
  // Get token from localStorage (same place AuthContext stores it)
  const getToken = useCallback(() => {
    return localStorage.getItem('auth_token') || null
  }, [])
  
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const eventHandlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map())

  // Initialize socket connection
  useEffect(() => {
    // Wait for auth to be ready
    if (!isAuthenticated || !user) {
      console.log('🔌 Socket: Waiting for authentication...', { isAuthenticated, user: !!user })
      return
    }
    
    const token = getToken()
    if (!token) {
      console.log('🔌 Socket: No token found in localStorage')
      return
    }
    
    console.log('🔌 Socket: Initializing connection with token...', { userId: user.id, familyId: user.familyId })

    console.log('🔌 Socket: Initializing connection...')

    // Create socket connection
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:1501/v1'
    const socketUrl = apiBaseUrl.replace('/v1', '') // Remove /v1 prefix for socket.io

    const newSocket = io(socketUrl, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'], // Fallback to polling if WebSocket fails
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      reconnectionDelayMax: 5000
    })

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('✅ Socket connected:', newSocket.id)
      setIsConnected(true)
    })

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason)
      setIsConnected(false)
    })

    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error)
      setIsConnected(false)
    })

    newSocket.on('error', (error) => {
      console.error('❌ Socket error:', error)
    })

    socketRef.current = newSocket
    setSocket(newSocket)

    // Cleanup on unmount
    return () => {
      console.log('🧹 Socket: Cleaning up connection')
      // Remove all event listeners
      eventHandlersRef.current.forEach((handlers, event) => {
        handlers.forEach(handler => {
          newSocket.off(event, handler)
        })
      })
      eventHandlersRef.current.clear()
      newSocket.disconnect()
      socketRef.current = null
      setSocket(null)
      setIsConnected(false)
    }
  }, [user, isAuthenticated, getToken]) // Depend on user and isAuthenticated

  // Emit event
  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current && isConnected) {
      console.log('📤 Socket emit:', event, data)
      socketRef.current.emit(event, data)
    } else {
      console.warn('⚠️ Socket not connected, cannot emit:', event)
    }
  }, [isConnected])

  // Register event listener
  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (!socketRef.current) {
      console.warn('⚠️ Socket not initialized, cannot listen to:', event)
      return
    }

    // Store handler for cleanup
    if (!eventHandlersRef.current.has(event)) {
      eventHandlersRef.current.set(event, new Set())
    }
    eventHandlersRef.current.get(event)!.add(callback)

    // Register with socket
    socketRef.current.on(event, callback)
    console.log('👂 Socket: Listening to event:', event)
  }, [])

  // Remove event listener
  const off = useCallback((event: string, callback?: (data: any) => void) => {
    if (!socketRef.current) {
      return
    }

    if (callback) {
      // Remove specific handler
      const handlers = eventHandlersRef.current.get(event)
      if (handlers) {
        handlers.delete(callback)
        socketRef.current.off(event, callback)
      }
    } else {
      // Remove all handlers for this event
      const handlers = eventHandlersRef.current.get(event)
      if (handlers) {
        handlers.forEach(handler => {
          socketRef.current?.off(event, handler)
        })
        handlers.clear()
      }
    }
  }, [])

  return (
    <SocketContext.Provider value={{ socket, isConnected, emit, on, off }}>
      {children}
    </SocketContext.Provider>
  )
}

