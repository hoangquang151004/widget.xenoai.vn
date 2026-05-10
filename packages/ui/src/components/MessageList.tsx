import React, { useLayoutEffect, useRef } from 'react'
import type { ChatMessage, WidgetConfig, ActionButton, UIComponent } from '../types'
import { ProductCard } from './ProductCard'
import { SalesBlock, apiRecordToProduct } from './SalesBlocks'
import { RichComponentView } from './RichComponent'

interface MessageBubbleProps {
  message: ChatMessage
  config: WidgetConfig
  onOpenSalesPanel?: (data?: Record<string, unknown>) => void
  onAction?: (action: string, payload: Record<string, unknown>) => void
  interactionsDisabled?: boolean
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  config,
  onOpenSalesPanel,
  onAction,
  interactionsDisabled = false,
}) => {
  const { primaryColor } = config
  const isUser = message.role === 'user'

  const bubbleStyles: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: isUser ? '9px 3px 9px 9px' : '3px 9px 9px 9px',
    backgroundColor: isUser ? primaryColor : '#f1f5f9',
    color: isUser ? '#fff' : '#1e293b',
    maxWidth: '85%',
    alignSelf: isUser ? 'flex-end' : 'flex-start',
    fontSize: '13px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
  }

  const handleActionButtonClick = (button: ActionButton) => {
    if (button.type === 'open_sales') {
      onOpenSalesPanel?.(button.data)
    } else if (button.type === 'link' && button.data?.url) {
      window.open(button.data.url as string, '_blank')
    } else if (button.type === 'copy' && button.data?.text) {
      navigator.clipboard.writeText(button.data.text as string)
    }
    onAction?.(button.type, button.data || {})
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={bubbleStyles}>
        {message.content}
        {message.role === 'assistant' && message.isStreaming ? <span style={{ opacity: 0.6 }}>▍</span> : null}
      </div>
      {message.action_buttons && message.action_buttons.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
          {message.action_buttons.map((btn, idx) => (
            <button
              key={idx}
              type="button"
              disabled={interactionsDisabled}
              onClick={() => !interactionsDisabled && handleActionButtonClick(btn)}
              style={{
                padding: '6px 12px',
                borderRadius: '16px',
                border: `1px solid ${primaryColor}`,
                backgroundColor: 'transparent',
                color: primaryColor,
                fontSize: '11px',
                fontWeight: 500,
                cursor: interactionsDisabled ? 'not-allowed' : 'pointer',
                opacity: interactionsDisabled ? 0.55 : 1,
              }}
            >
              {btn.type === 'open_sales' && '🛒 '}{btn.label}
            </button>
          ))}
        </div>
      )}
      {message.citations && message.citations.length > 0 && (
        <div style={{ fontSize: '9px', color: '#64748b', marginTop: '6px', maxWidth: '85%' }}>
          <span style={{ fontWeight: 600 }}>Nguồn: </span>
          {message.citations.map((c, i) => {
            const title = c.metadata?.title || c.source || `[${i + 1}]`
            const url = c.metadata?.url
            return url ? (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ marginRight: '6px', color: primaryColor }}>
                [{i + 1}]
              </a>
            ) : (
              <span key={i} style={{ marginRight: '6px' }}>
                [{i + 1}] {title}
              </span>
            )
          })}
        </div>
      )}
      {message.component ? <RichComponentView component={message.component} /> : null}
      {message.timestamp && (
        <span
          style={{
            fontSize: '9px',
            color: '#94a3b8',
            marginTop: '2px',
            paddingLeft: isUser ? 0 : '4px',
            paddingRight: isUser ? '4px' : 0,
          }}
        >
          {new Date(message.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  )
}

interface MessageListProps {
  messages: ChatMessage[]
  config: WidgetConfig
  onAction?: (action: string, payload: Record<string, unknown>) => void
  onOpenSalesPanel?: (data?: Record<string, unknown>) => void
  /** Khi true: khóa nút sales / form trong lúc gửi action. */
  interactionsDisabled?: boolean
  renderUIComponent?: (
    component: UIComponent,
    onAction?: (action: string, payload: Record<string, unknown>) => void,
  ) => React.ReactNode
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  config,
  onAction,
  onOpenSalesPanel,
  interactionsDisabled = false,
  renderUIComponent,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null)

  /** Cuộn xuống cuối khi có tin mới / stream chunk; chỉ tác động vùng `.w-messages-container` (không cuộn cả trang). */
  useLayoutEffect(() => {
    const el = bottomRef.current
    if (!el) return
    const pane = el.closest('.w-messages-container') as HTMLElement | null
    if (pane) {
      pane.scrollTop = pane.scrollHeight
    } else {
      el.scrollIntoView({ block: 'end', behavior: 'auto' })
    }
  }, [messages])

  const handleAction = (action: string, payload: Record<string, unknown>) => {
    onAction?.(action, payload)
  }

  const renderComponent = (component: UIComponent) => {
    if (renderUIComponent) {
      return renderUIComponent(component, handleAction)
    }

    const salesTypes = new Set([
      'product_cards',
      'cart',
      'order_form',
      'payment_selection',
      'order_confirmation',
      'checkout_link',
    ])
    if (salesTypes.has(component.type)) {
      return (
        <SalesBlock
          block={component}
          config={config}
          onAction={handleAction}
          interactionsDisabled={interactionsDisabled}
        />
      )
    }

    switch (component.type) {
      case 'product_card':
        return (
          <div style={{ width: '100%', maxWidth: '280px' }}>
            <ProductCard
              product={apiRecordToProduct(component.data as Record<string, unknown>, config)}
              config={config}
              onAction={(action, payload) => handleAction(action, payload)}
              interactionsDisabled={interactionsDisabled}
            />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {messages.map((message, index) => (
        <div key={message.id || index}>
          <MessageBubble
            message={message}
            config={config}
            onOpenSalesPanel={onOpenSalesPanel}
            onAction={onAction}
            interactionsDisabled={interactionsDisabled}
          />
          {message.ui_components?.map((comp, compIndex) => (
            <div key={`comp-${compIndex}`} style={{ marginTop: '8px' }}>
              {renderComponent(comp)}
            </div>
          ))}
        </div>
      ))}
      <div
        ref={bottomRef}
        style={{ height: '1px', width: '100%', flexShrink: 0, pointerEvents: 'none' }}
        aria-hidden
      />
    </div>
  )
}

export type { MessageListProps, MessageBubbleProps }
