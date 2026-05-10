import React from 'react'

interface ChatBubbleProps {
  primaryColor: string
  position: 'bottom-right' | 'bottom-left'
  isOpen: boolean
  onClick: () => void
  unreadCount?: number
}

const ICON_CHAT = (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
  </svg>
)

const ICON_CLOSE = (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
)

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  primaryColor,
  position,
  isOpen,
  onClick,
  unreadCount = 0,
}) => {
  const positionStyles: React.CSSProperties = {
    position: 'fixed',
    bottom: '16px',
    ...(position === 'bottom-right' ? { right: '16px' } : { left: '16px' }),
  }

  const bubbleStyles: React.CSSProperties = {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: primaryColor,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 4px 14px ${primaryColor}55`,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    padding: 0,
  }

  const iconStyles: React.CSSProperties = {
    width: '24px',
    height: '24px',
    color: '#fff',
  }

  return (
    <button
      style={{ ...positionStyles, ...bubbleStyles }}
      onClick={onClick}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
      className={isOpen ? 'w-bubble w-bubble--open' : 'w-bubble'}
    >
      <style>{`
        .w-bubble:hover {
          transform: scale(1.05);
        }
        .w-bubble:active {
          transform: scale(0.95);
        }
        .w-bubble .icon-chat,
        .w-bubble .icon-close {
          transition: opacity 0.2s ease;
        }
        .w-bubble .icon-chat { opacity: 1; }
        .w-bubble .icon-close { opacity: 0; position: absolute; }
        .w-bubble--open .icon-chat { opacity: 0; }
        .w-bubble--open .icon-close { opacity: 1; }
        .w-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          min-width: 18px;
          height: 18px;
          border-radius: 9px;
          background-color: #ef4444;
          color: #fff;
          font-size: 10px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          font-family: system-ui, sans-serif;
        }
      `}</style>
      <span className="icon-chat" style={iconStyles}>
        {ICON_CHAT}
      </span>
      <span className="icon-close" style={iconStyles}>
        {ICON_CLOSE}
      </span>
      {unreadCount > 0 && !isOpen && (
        <span className="w-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
      )}
    </button>
  )
}

export type { ChatBubbleProps }