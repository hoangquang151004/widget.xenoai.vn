import React, { useEffect, useState } from 'react'
import type { WidgetConfig } from '../types'

interface ChatWindowProps {
  config: WidgetConfig
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  headerExtra?: React.ReactNode
  footer?: React.ReactNode
}

const ICON_CLOSE = (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
)

/** Mở rộng (fullscreen / maximize) */
const ICON_EXPAND = (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden>
    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
  </svg>
)

/** Thu nhỏ về cửa sổ chuẩn */
const ICON_COMPRESS = (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden>
    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
  </svg>
)

const ICON_DEFAULT_AVATAR = (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
  </svg>
)

export const ChatWindow: React.FC<ChatWindowProps> = ({
  config,
  isOpen,
  onClose,
  children,
  headerExtra,
  footer,
}) => {
  const { primaryColor, botName, logoUrl, position, fontFamily = 'sans' } = config
  const [layoutMode, setLayoutMode] = useState<'normal' | 'expanded'>('normal')

  useEffect(() => {
    if (!isOpen) setLayoutMode('normal')
  }, [isOpen])

  const isExpanded = layoutMode === 'expanded'

  /** Kích thước cố định theo chế độ; expanded rộng/cao hơn nhưng vẫn an toàn trên mobile. */
  const windowWidth = isExpanded ? 'min(440px, calc(100vw - 32px))' : '320px'
  const windowHeight = isExpanded
    ? 'min(720px, calc(100vh - 96px))'
    : 'min(580px, calc(100vh - 120px))'

  const positionStyles: React.CSSProperties = {
    position: 'fixed',
    bottom: '84px',
    ...(position === 'bottom-left' ? { left: '16px' } : { right: '16px' }),
    width: windowWidth,
    maxWidth: 'calc(100vw - 32px)',
    height: windowHeight,
    minHeight: windowHeight,
    maxHeight: windowHeight,
    borderRadius: '18px',
    overflow: 'hidden',
    backgroundColor: '#fff',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: fontFamily === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif',
  }

  const headerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: primaryColor,
    color: '#fff',
  }

  const avatarStyles: React.CSSProperties = {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255, 255, 255, 0.8)',
  }

  const headerIconButtonStyles = (disabled: boolean): React.CSSProperties => ({
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    padding: 0,
    opacity: disabled ? 0.45 : 1,
    transition: 'background-color 0.2s, opacity 0.2s',
    flexShrink: 0,
  })

  return (
    <div
      style={{
        ...positionStyles,
        opacity: isOpen ? 1 : 0,
        transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.95)',
        pointerEvents: isOpen ? 'auto' : 'none',
        transition:
          'opacity 0.3s ease, transform 0.3s ease, width 0.25s ease, height 0.25s ease, min-height 0.25s ease, max-height 0.25s ease',
      }}
      className="w-chat-window"
    >
      <style>{`
        .w-chat-window { z-index: 999999; }
        .w-header-close:hover:not(:disabled),
        .w-header-resize:hover:not(:disabled) { background-color: rgba(255, 255, 255, 0.3) !important; }
        .w-messages-container::-webkit-scrollbar { width: 4px; }
        .w-messages-container::-webkit-scrollbar-track { background: transparent; }
        .w-messages-container::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={headerStyles}>
        {logoUrl ? (
          <img src={logoUrl} alt={botName} style={avatarStyles} />
        ) : (
          <div style={avatarStyles}>{ICON_DEFAULT_AVATAR}</div>
        )}
        <span style={{ fontSize: '14px', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {botName}
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginLeft: 'auto',
            flexShrink: 0,
          }}
        >
          {headerExtra}
          <button
            type="button"
            className="w-header-resize"
            style={headerIconButtonStyles(false)}
            onClick={() => setLayoutMode(isExpanded ? 'normal' : 'expanded')}
            aria-label={isExpanded ? 'Thu nhỏ cửa sổ chat' : 'Mở rộng cửa sổ chat'}
            title={isExpanded ? 'Thu nhỏ' : 'Mở rộng'}
          >
            {isExpanded ? ICON_COMPRESS : ICON_EXPAND}
          </button>
          <button
            type="button"
            className="w-header-close"
            style={headerIconButtonStyles(false)}
            onClick={onClose}
            aria-label="Đóng chat"
          >
            {ICON_CLOSE}
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div
        className="w-messages-container"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div style={{
          borderTop: '1px solid #f1f5f9',
          padding: '12px 16px',
          position: 'sticky',
          bottom: 0,
          backgroundColor: '#fff',
          zIndex: 1,
        }}>
          {footer}
        </div>
      )}
    </div>
  )
}

export type { ChatWindowProps }