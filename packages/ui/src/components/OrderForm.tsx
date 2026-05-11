import React, { useState } from 'react'
import type { PaymentMethods, WidgetConfig, OrderFormData } from '../types'

interface OrderFormProps {
  config: WidgetConfig
  onSubmit: (data: OrderFormData) => void
  onBack?: () => void
}

const PAYMENT_ICONS: Record<string, string> = {
  cod: '💵',
  bank_transfer: '🏦',
  momo: '📱',
  vnpay: '💳',
}

const PAYMENT_LABELS: Record<string, string> = {
  cod: 'COD · Thanh toán khi nhận',
  bank_transfer: 'Chuyển khoản ngân hàng',
  momo: 'Ví MoMo',
  vnpay: 'VNPay / Thẻ ngân hàng',
}

export const OrderForm: React.FC<OrderFormProps> = ({ config, onSubmit, onBack }) => {
  const { primaryColor, formFields, paymentMethods } = config
  const enabledFields = (formFields || []).filter((f) => f.enabled)

  const [formData, setFormData] = useState<Record<string, string>>({})
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const activePayments = Object.entries(paymentMethods || {}).filter(([, enabled]) => enabled)

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    enabledFields.forEach((field) => {
      if (field.required && !formData[field.key]?.trim()) {
        newErrors[field.key] = `${field.label} là bắt buộc`
      }
      if (field.type === 'email' && formData[field.key]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(formData[field.key])) {
          newErrors[field.key] = 'Email không hợp lệ'
        }
      }
      if (field.type === 'phone' && formData[field.key]) {
        const phoneRegex = /^[0-9]{9,11}$/
        if (!phoneRegex.test(formData[field.key].replace(/\s/g, ''))) {
          newErrors[field.key] = 'Số điện thoại không hợp lệ'
        }
      }
    })

    if (activePayments.length > 0 && !selectedPayment) {
      newErrors.payment = 'Vui lòng chọn phương thức thanh toán'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      onSubmit({
        fields: formData,
        paymentMethod: selectedPayment as keyof PaymentMethods | null,
      })
    }
  }

  const inputStyles: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    fontSize: '12px',
    outline: 'none',
    boxSizing: 'border-box',
  }

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
        Thông tin giao hàng
      </div>

      <form onSubmit={handleSubmit}>
        {/* Form fields */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {enabledFields.map((field) => (
            <div key={field.key}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '10px', color: '#64748b' }}>{field.label}</span>
                {field.required && (
                  <span style={{ fontSize: '8px', padding: '1px 4px', borderRadius: '3px', backgroundColor: '#fef2f2', color: '#dc2626' }}>
                    Bắt buộc
                  </span>
                )}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={formData[field.key] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  placeholder={`Nhập ${field.label.toLowerCase()}...`}
                  rows={3}
                  style={{ ...inputStyles, resize: 'vertical' }}
                />
              ) : (
                <input
                  type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                  value={formData[field.key] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  placeholder={`Nhập ${field.label.toLowerCase()}...`}
                  style={{
                    ...inputStyles,
                    borderColor: errors[field.key] ? '#ef4444' : '#e2e8f0',
                  }}
                />
              )}
              {errors[field.key] && (
                <span style={{ fontSize: '9px', color: '#ef4444', marginTop: '2px', display: 'block' }}>
                  {errors[field.key]}
                </span>
              )}
            </div>
          ))}

          {/* Payment methods */}
          {activePayments.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px' }}>
                Phương thức thanh toán
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {activePayments.map(([key]) => (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1.5px solid ${selectedPayment === key ? primaryColor : '#e2e8f0'}`,
                      cursor: 'pointer',
                      fontSize: '11px',
                      color: '#1e293b',
                    }}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={key}
                      checked={selectedPayment === key}
                      onChange={() => setSelectedPayment(key)}
                      style={{ display: 'none' }}
                    />
                    <div
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        border: `1.5px solid ${selectedPayment === key ? primaryColor : '#cbd5e1'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selectedPayment === key && (
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: primaryColor }} />
                      )}
                    </div>
                    <span>{PAYMENT_ICONS[key]}</span>
                    <span>{PAYMENT_LABELS[key]}</span>
                  </label>
                ))}
              </div>
              {errors.payment && (
                <span style={{ fontSize: '9px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                  {errors.payment}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px' }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
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
              ← Quay lại
            </button>
          )}
          <button
            type="submit"
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
            Xác nhận đặt hàng →
          </button>
        </div>
      </form>
    </div>
  )
}

export type { OrderFormProps }