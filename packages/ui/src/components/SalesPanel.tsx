import React, { useState, useCallback } from 'react'
import type { WidgetConfig, CartItem } from '../types'
import { ProductCard } from './ProductCard'
import type { Product } from './ProductCard'

type SalesPanelStep = 'products' | 'cart' | 'form' | 'payment' | 'confirm'

interface SalesPanelProps {
  isOpen: boolean
  onClose: () => void
  config: WidgetConfig
  initialProduct?: Product
  onAction?: (action: string, payload: Record<string, unknown>) => void
}

const formatVnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n)

const ICON_CLOSE = (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
)

const ICON_CART = (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
    <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.09-.16.15-.35.15-.55 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
  </svg>
)

const ICON_ARROW_LEFT = (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
  </svg>
)

export const SalesPanel: React.FC<SalesPanelProps> = ({ isOpen, onClose, config, initialProduct, onAction }) => {
  const { primaryColor, productLayout = 'card', paymentMethods = {}, bankInfo } = config
  const [step, setStep] = useState<SalesPanelStep>(initialProduct ? 'cart' : 'products')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [selectedPayment, setSelectedPayment] = useState<string>('cod')
  const [orderId, setOrderId] = useState('')

  const handleAddToCart = useCallback((product: Product, quantity: number) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      }
      const newItem: CartItem = {
        id: product.id || `p-${Date.now()}`,
        name: product.name,
        price: product.price,
        quantity,
        imageUrl: product.imageUrl,
      }
      return [...prev, newItem]
    })
  }, [])

  const handleRemoveFromCart = useCallback((id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id))
  }, [])

  const handleUpdateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) return
    setCartItems(prev => prev.map(item => item.id === id ? { ...item, quantity } : item))
  }, [])

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  const handleCheckout = () => {
    setStep('form')
  }

  const handleSubmitForm = (data: Record<string, string>) => {
    setFormData(data)
    setStep('payment')
  }

  const handleConfirmOrder = () => {
    const newOrderId = `#${Date.now().toString().slice(-6)}`
    setOrderId(newOrderId)
    setStep('confirm')
    onAction?.('create_order', {
      items: cartItems,
      total: cartTotal,
      form_data: formData,
      payment_method: selectedPayment,
    })
  }

  const handleClose = () => {
    setStep(initialProduct ? 'cart' : 'products')
    setCartItems([])
    setFormData({})
    setOrderId('')
    onClose()
  }

  if (!isOpen) return null

  const panelStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999999,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  }

  const contentStyles: React.CSSProperties = {
    width: '100%',
    maxWidth: '420px',
    maxHeight: '90vh',
    backgroundColor: '#fff',
    borderRadius: '18px 18px 0 0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }

  const headerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #f1f5f9',
    backgroundColor: primaryColor,
    color: '#fff',
    gap: '8px',
  }

  const renderHeader = () => {
    const titles: Record<SalesPanelStep, string> = {
      products: '🛒 Mua sắm',
      cart: 'Giỏ hàng',
      form: 'Thông tin đặt hàng',
      payment: 'Thanh toán',
      confirm: 'Hoàn tất',
    }

    return (
      <div style={headerStyles}>
        {step !== 'products' && step !== 'confirm' && (
          <button
            onClick={() => setStep(step === 'cart' ? 'products' : step === 'form' ? 'cart' : 'form')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {ICON_ARROW_LEFT}
          </button>
        )}
        <span style={{ flex: 1, fontSize: '15px', fontWeight: 600 }}>{titles[step]}</span>
        {cartCount > 0 && step === 'products' && (
          <button
            onClick={() => setStep('cart')}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {ICON_CART}
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#ef4444',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {cartCount}
            </span>
          </button>
        )}
        <button
          onClick={handleClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {ICON_CLOSE}
        </button>
      </div>
    )
  }

  const renderProducts = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
        Chọn sản phẩm bạn muốn mua
      </div>
      {initialProduct ? (
        <ProductCard
          product={initialProduct}
          config={config}
          onAction={(action, payload) => {
            if (action === 'add_to_cart') {
              handleAddToCart(initialProduct, 1)
            }
            onAction?.(action, payload)
          }}
          layout={productLayout}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            padding: '24px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '13px',
            border: '2px dashed #e2e8f0',
            borderRadius: '12px',
          }}>
            <div style={{ marginBottom: '8px', fontSize: '24px' }}>🛍️</div>
            Danh sách sản phẩm sẽ hiển thị ở đây
          </div>
          <button
            onClick={() => onAction?.('load_products', {})}
            style={{
              padding: '12px',
              border: `1px solid ${primaryColor}`,
              borderRadius: '8px',
              backgroundColor: 'transparent',
              color: primaryColor,
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Tải sản phẩm
          </button>
        </div>
      )}
    </div>
  )

  const renderCart = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
      {cartItems.length === 0 ? (
        <div style={{
          padding: '32px 16px',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '13px',
        }}>
          <div style={{ marginBottom: '8px', fontSize: '32px' }}>🛒</div>
          <div>Giỏ hàng trống</div>
          <button
            onClick={() => setStep('products')}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              backgroundColor: primaryColor,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Tiếp tục mua sắm
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {cartItems.map(item => (
              <div key={item.id} style={{
                display: 'flex',
                gap: '8px',
                padding: '10px',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
              }}>
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px' }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: primaryColor }}>
                    {formatVnd(item.price)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <button
                      onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                      style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}
                    >
                      -
                    </button>
                    <span style={{ fontSize: '12px', minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                      style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}
                    >
                      +
                    </button>
                    <button
                      onClick={() => handleRemoveFromCart(item.id)}
                      style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#f8fafc',
            borderRadius: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Tạm tính</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: primaryColor }}>{formatVnd(cartTotal)}</span>
          </div>
        </>
      )}
    </div>
  )

  const renderForm = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const form = e.target as HTMLFormElement
          const data: Record<string, string> = {}
          new FormData(form).forEach((value, key) => {
            data[key] = value.toString()
          })
          handleSubmitForm(data)
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Họ và tên *</span>
          <input
            name="name"
            required
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Số điện thoại *</span>
          <input
            name="phone"
            type="tel"
            required
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Địa chỉ *</span>
          <textarea
            name="address"
            required
            rows={3}
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', resize: 'none' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Ghi chú</span>
          <textarea
            name="note"
            rows={2}
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', resize: 'none' }}
          />
        </label>
        <button
          type="submit"
          style={{
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: primaryColor,
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: '8px',
          }}
        >
          Tiếp tục thanh toán
        </button>
      </form>
    </div>
  )

  const renderPayment = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>Tóm tắt đơn hàng</div>
        {cartItems.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span>{item.name} x{item.quantity}</span>
            <span style={{ fontWeight: 500 }}>{formatVnd(item.price * item.quantity)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
          <span>Tổng cộng</span>
          <span style={{ color: primaryColor }}>{formatVnd(cartTotal)}</span>
        </div>
      </div>

      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Phương thức thanh toán</div>
        {(Object.entries(paymentMethods || {}) as [string, boolean][])
          .filter(([, enabled]) => enabled)
          .map(([method]) => {
            const labels: Record<string, string> = {
              cod: 'COD · Thanh toán khi nhận',
              bank_transfer: 'Chuyển khoản ngân hàng',
              momo: 'Ví MoMo',
              vnpay: 'VNPay / Thẻ ngân hàng',
            }
            const isSelected = selectedPayment === method
            return (
              <label
                key={method}
                style={{
                  display: 'flex',
                  gap: '10px',
                  padding: '12px',
                  border: `1px solid ${isSelected ? primaryColor : '#e2e8f0'}`,
                  borderRadius: '8px',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? `${primaryColor}10` : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={isSelected}
                  onChange={() => setSelectedPayment(method)}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{labels[method] || method}</div>
                  {method === 'bank_transfer' && bankInfo && (
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                      STK: {bankInfo.account_number}<br />
                      CTK: {bankInfo.account_name ?? bankInfo.account_holder}
                    </div>
                  )}
                </div>
              </label>
            )
          })}

      <button
        onClick={handleConfirmOrder}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: primaryColor,
          color: '#fff',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          marginTop: '16px',
        }}
      >
        Xác nhận đặt hàng
      </button>
    </div>
  )

  const renderConfirm = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: '#10b981', marginBottom: '8px' }}>Đặt hàng thành công!</div>
      <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
        Mã đơn hàng: <strong style={{ color: '#1e293b' }}>{orderId}</strong>
      </div>
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '24px' }}>
        Cảm ơn bạn đã đặt hàng. Chúng tôi sẽ liên hệ xác nhận trong thời gian sớm nhất.
      </div>
      <button
        onClick={handleClose}
        style={{
          padding: '12px 24px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: primaryColor,
          color: '#fff',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Tiếp tục mua sắm
      </button>
    </div>
  )

  const renderFooter = () => {
    if (step === 'products') return null
    if (step === 'confirm') return null

    return (
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #f1f5f9',
        backgroundColor: '#fff',
      }}>
        {step === 'cart' && cartItems.length > 0 && (
          <button
            onClick={handleCheckout}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: primaryColor,
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Thanh toán ({formatVnd(cartTotal)})
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={panelStyles} onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div style={contentStyles}>
        {renderHeader()}
        {step === 'products' && renderProducts()}
        {step === 'cart' && renderCart()}
        {step === 'form' && renderForm()}
        {step === 'payment' && renderPayment()}
        {step === 'confirm' && renderConfirm()}
        {renderFooter()}
      </div>
    </div>
  )
}

export type { SalesPanelProps }
