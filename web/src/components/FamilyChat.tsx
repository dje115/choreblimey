import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { apiClient } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'

interface ChatMessage {
  id: string
  senderId: string | null
  senderType: 'parent' | 'child'
  message: string
  createdAt: string
  sender: {
    id?: string
    email?: string | null
    nickname?: string
    familyMembers?: Array<{
      id: string
      displayName?: string | null
      role: string
    }>
  }
}

interface FamilyChatProps {
  compact?: boolean // If true, shows only 6 messages in a compact box
  onOpenFull?: () => void // Callback when clicking to open full chat
  days?: number // Number of days to fetch (for compact view)
  maxMessages?: number // Max messages to show (for compact view)
  childFriendly?: boolean // If true, uses larger fonts for better readability (for child dashboard)
  onNewMessage?: () => void // Callback when a new message is received (for unread tracking)
  canSend?: boolean // If false, render read-only chat (no sending)
}

export const FamilyChat: React.FC<FamilyChatProps> = ({ 
  compact = false, 
  onOpenFull,
  days = 2,
  maxMessages = 6,
  childFriendly = false,
  onNewMessage,
  canSend = true
}) => {
  const { user } = useAuth()
  const { socket, isConnected, on, off } = useSocket()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const currentSenderIds = useMemo(() => {
    const ids: string[] = []
    if (user?.id) {
      ids.push(user.id)
    }
    if (user?.childId) {
      ids.push(user.childId)
    }
    return ids
  }, [user])

  const isOwnMessage = useCallback((message: ChatMessage) => {
    if (!message.senderId) {
      return false
    }
    return currentSenderIds.includes(message.senderId)
  }, [currentSenderIds])

  // Get display name for sender
  const getSenderName = (message: ChatMessage): string => {
    if (isOwnMessage(message)) {
      return 'You'
    }
    
    // For children, check for nickname first (should be in sender.nickname)
    if (message.senderType === 'child') {
      if (message.sender?.nickname) {
        return message.sender.nickname
      }
      // Fallback if nickname not found
      return 'Child'
    }
    
    // For parents, try to get display name from family member info
    if (message.sender?.familyMembers && message.sender.familyMembers.length > 0) {
      const member = message.sender.familyMembers[0]
      return member.displayName || message.sender.email?.split('@')[0] || 'Unknown'
    }
    // Fallback to email
    if (message.sender?.email) {
      return message.sender.email.split('@')[0]
    }
    return 'Parent'
  }

  // Format time
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Load messages
  const loadMessages = useCallback(async () => {
    try {
      setLoading(true)
      const params: any = { limit: compact ? maxMessages : 150 }
      if (days) {
        params.days = days
      }
      const response = await apiClient.getChatMessages(params)
      setMessages(response.messages || [])
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      setLoading(false)
    }
  }, [compact, maxMessages, days])

  // Send message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSend) {
      return
    }
    if (!newMessage.trim() || sending || !isConnected) {
      if (!isConnected) {
        alert('Not connected to server. Please refresh the page.')
      }
      return
    }

    const messageToSend = newMessage.trim()
    setNewMessage('') // Clear input immediately for better UX
    
    try {
      setSending(true)
      await apiClient.sendChatMessage(messageToSend)
      // Message will be added via WebSocket
    } catch (error: any) {
      console.error('Failed to send message:', error)
      // Restore message on error
      setNewMessage(messageToSend)
      const errorMessage = error?.message || error?.error || 'Failed to send message. Please try again.'
      console.error('Chat send error details:', { error, message: errorMessage })
      alert(errorMessage)
    } finally {
      setSending(false)
    }
  }

  // Scroll to bottom
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Load messages on mount
  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // Listen for new messages via WebSocket
  useEffect(() => {
    if (!socket || !isConnected) return

    const handleNewMessage = (data: any) => {
      console.log('📢 WebSocket: chat:message received', data)
      const newMsg = data.message
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.find((m) => m.id === newMsg.id)) {
          return prev
        }
        // Add new message and keep only the most recent messages
        const updated = [...prev, newMsg]
        if (compact) {
          // Keep only the last maxMessages
          return updated.slice(-maxMessages)
        }
        // Keep only the last 150 messages
        return updated.slice(-150)
      })
      // Scroll to bottom after a short delay to ensure DOM is updated
      setTimeout(scrollToBottom, 100)
      // Notify parent component of new message (for unread tracking)
      if (onNewMessage) {
        onNewMessage()
      }
    }

    on('chat:message', handleNewMessage)

    return () => {
      off('chat:message', handleNewMessage)
    }
  }, [socket, isConnected, on, off, compact, maxMessages, onNewMessage])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (!loading) {
      scrollToBottom()
    }
  }, [messages, loading])

  if (loading) {
    return (
      <div className="cb-card p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-[var(--primary)] border-t-transparent"></div>
        </div>
      </div>
    )
  }

  // Compact view (for parent dashboard sidebar)
  if (compact) {
    return (
      <div className="cb-card p-4 cursor-pointer hover:shadow-lg transition-all" onClick={onOpenFull}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="cb-heading-md text-[var(--primary)]">💬 Family Chat</h3>
          <span className="text-xs text-[var(--text-secondary)]">Click to open</span>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto" ref={messagesContainerRef}>
          {messages.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] text-center py-4">No messages yet. Start the conversation!</p>
          ) : (
            messages.map((msg) => {
              const isOwn = isOwnMessage(msg)
              const displayName = getSenderName(msg)
              const bubbleClasses = isOwn
                ? 'bg-[var(--primary)] text-white'
                : 'bg-gray-100 text-gray-800'
              const metaTextClass = isOwn ? 'text-white/70' : 'text-gray-500'
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? 'justify-end text-right' : 'justify-start text-left'}`}
                >
                  <div
                    className={`inline-flex flex-wrap items-center gap-2 max-w-[90%] sm:max-w-[80%] rounded-2xl px-3 py-2 ${bubbleClasses}`}
                  >
                    <span className={`text-xs font-semibold uppercase tracking-wide ${isOwn ? 'text-white/80' : 'text-gray-500'}`}>
                      {displayName}
                    </span>
                    <span className={`text-sm font-semibold whitespace-pre-wrap break-words ${isOwn ? 'text-white' : 'text-gray-900'}`}>
                      {msg.message}
                    </span>
                    <span className={`text-[10px] ${metaTextClass}`}>
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        {messages.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--card-border)]">
            <p className="text-xs text-[var(--text-secondary)] text-center">
              {messages.length} message{messages.length !== 1 ? 's' : ''} • Click to see more
            </p>
          </div>
        )}
      </div>
    )
  }

  // Full view (for modal/page)
  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-4">💬</p>
            <p className="text-[var(--text-secondary)]">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = isOwnMessage(msg)
            const displayName = getSenderName(msg)
            const bubblePalette = isOwn
              ? 'bg-[var(--primary)] text-white'
              : childFriendly
                ? 'bg-blue-50 border-2 border-blue-200 text-gray-900'
                : 'bg-gray-100 text-gray-800'
            const spacing = childFriendly ? 'px-5 py-3' : 'px-4 py-2 sm:py-2'
            const metaTextClass = `${childFriendly ? 'text-sm' : 'text-xs'} ${isOwn ? 'text-white/70' : 'text-gray-500'}`
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? 'justify-end text-right' : 'justify-start text-left'}`}
              >
                <div
                  className={`inline-flex flex-wrap items-center gap-2 max-w-[95%] sm:max-w-[75%] rounded-2xl ${spacing} ${bubblePalette}`}
                >
                  <span className={`${childFriendly ? 'text-sm' : 'text-xs'} font-semibold uppercase tracking-wide ${isOwn ? 'text-white/80' : 'text-gray-500'}`}>
                    {displayName}
                  </span>
                  <span className={`${childFriendly ? 'text-base' : 'text-sm'} font-semibold whitespace-pre-wrap break-words ${isOwn ? 'text-white' : 'text-gray-900'}`}>
                    {msg.message}
                  </span>
                  <span className={metaTextClass}>
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="border-t border-[var(--card-border)] p-4">
        <div className="flex gap-2 items-end flex-wrap sm:flex-nowrap">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className={`flex-1 min-h-[44px] ${childFriendly ? 'px-4 py-3 text-base sm:px-5 sm:py-2 sm:text-base' : 'px-4 py-3 sm:px-4 sm:py-2 text-base sm:text-sm'} border-2 border-[var(--card-border)] rounded-full focus:border-[var(--primary)] focus:outline-none bg-white text-gray-900 placeholder:text-gray-500 font-medium touch-manipulation ${!canSend ? 'cursor-not-allowed opacity-70' : ''}`}
            style={{ color: '#111827' }}
            maxLength={1000}
            disabled={sending || !isConnected || !canSend}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending || !isConnected || !canSend}
            className={`min-h-[44px] shrink-0 ${childFriendly ? 'px-5 py-3 text-sm sm:px-6 sm:py-2 sm:text-base' : 'px-5 py-3 sm:px-6 sm:py-2 text-sm sm:text-base'} bg-[var(--primary)] text-white rounded-full font-bold hover:shadow-lg active:shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation`}
            style={{ 
              color: '#ffffff',
              backgroundColor: sending || !newMessage.trim() || !isConnected || !canSend ? undefined : 'var(--primary)'
            }}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
        {!canSend && (
          <p className={`${childFriendly ? 'text-sm' : 'text-xs'} text-slate-500 mt-2 font-semibold`}>
            You have read-only access to the family chat.
          </p>
        )}
        {!isConnected && (
          <p className={`${childFriendly ? 'text-sm' : 'text-xs'} text-red-500 mt-2 font-semibold`}>⚠️ Not connected. Messages may not send.</p>
        )}
      </form>
    </div>
  )
}

