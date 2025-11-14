import React from 'react'
import { FamilyChat } from '../../../components/FamilyChat'

interface ChatTabProps {
  activeTab: string
  onUnreadCountChange?: (count: number) => void
}

const ChatTab: React.FC<ChatTabProps> = ({ activeTab, onUnreadCountChange }) => {
  return (
    <div className="cb-card p-6">
      <h3 className="cb-heading-lg text-[var(--primary)] mb-4">💬 Family Chat</h3>
      <div className="h-[60vh]">
        <FamilyChat
          compact={false}
          days={30}
          maxMessages={150}
          childFriendly={true}
          onNewMessage={() => {
            // Only count as unread if chat tab is not active
            if (activeTab !== 'chat' && onUnreadCountChange) {
              onUnreadCountChange(1)
            }
          }}
        />
      </div>
    </div>
  )
}

export default ChatTab


