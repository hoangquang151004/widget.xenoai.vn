import React from 'react'
import type { CartItem, WidgetConfig } from '../types'

interface CartPanelProps {
  items: CartItem[]
  config: WidgetConfig
  onUpdateQuantity?: (itemId: string, quantity: number) => void
  onRemoveItem?: (itemId: string) => void
  onContinueShopping?: () => void
  onCheckout?: () => void
}

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(price)
}

export const CartPanel: React.FC<CartPanelProps> = ({
  items,
  config,
  onUpdateQuantity,
  onRemoveItem,
  onContinueShopping,
  onCheckout,
}) => {
  const { primaryColor } = config
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <div style={{
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      backgroundColor: '#fff',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #f1f5f9',
        fontSize: '12px',
        fontWeight: 600,
        color: '#1e293b',
      }}>
        Giỏ hàng của bạn
      </div>

      {/* Items */}
      <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
        {items.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
            Giỏ hàng trống
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '6px',
                backgroundColor: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#ccc">
                    <rect x="2" y="2" width="20" height="20" rx="2" />
                  </svg>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </div>
                {item.options && (
                  <div style={{ fontSize: '9px', color: '#64748b' }}>
                    {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(', ')}
                  </div>
                )}
                <div style={{ fontSize: '11px', fontWeight: 600, color: primaryColor }}>
                  {formatPrice(item.price)}
                </div>
              </div>

              {/* Quantity controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => {
                    if (item.quantity > 1) {
                      onUpdateQuantity?.(item.id, item.quantity - 1)
                    } else {
                      onRemoveItem?.(item.id)
                    }
                  }}
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: '#64748b',
                  }}
                >
                  −
                </button>
                <span style={{ fontSize: '11px', fontWeight: 500, minWidth: '16px', textAlign: 'center' }}>
                  {item.quantity}
                </span>
                <button
                  onClick={() => onUpdateQuantity?.(item.id, item.quantity + 1)}
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: '#64748b',
                  }}
                >
                  +
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Tổng cộng</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: primaryColor }}>
            {formatPrice(total)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onContinueShopping}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: 'transparent',
              color: '#64748b',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Tiếp tục mua
          </button>
          <button
            onClick={onCheckout}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: primaryColor,
              color: '#fff',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Đặt hàng →
          </button>
        </div>
      </div>
    </div>
  )
}

export type { CartPanelProps }