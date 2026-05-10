import React, { useMemo, useState } from 'react'
import type { WidgetConfig } from '../types'

export interface Product {
  id?: string
  externalId?: string
  name: string
  price: number
  originalPrice?: number
  imageUrl?: string
  rating?: number
  reviewCount?: number
  stock?: number
  inStock?: boolean
  options?: Array<{ name: string; value: string }>
  sizes?: string[]
  /** Biến thể từ API sales (key + danh sách giá trị). */
  variants?: Array<{ key: string; values: string[] }>
}

interface ProductCardProps {
  product: Product
  config: WidgetConfig
  onAction?: (action: string, payload: Record<string, unknown>) => void
  layout?: 'card' | 'list'
  interactionsDisabled?: boolean
}

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(price)
}

function buildAddToCartPayload(
  product: Product,
  quantity: number,
  variantPick: Record<string, string>,
): Record<string, unknown> {
  const pid = String(product.id ?? '')
  const ext = String(product.externalId ?? product.id ?? '')
  const firstVariantKey = product.variants?.[0]?.key
  const firstVariantVal = firstVariantKey ? variantPick[firstVariantKey] : undefined
  return {
    product_id: pid,
    external_id: ext,
    name: product.name,
    price: product.price,
    quantity: Math.max(1, quantity),
    variant_key: firstVariantKey ?? undefined,
    variant_value: firstVariantVal ?? undefined,
  }
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  config,
  onAction,
  layout: layoutProp,
  interactionsDisabled = false,
}) => {
  const { primaryColor, productLayout = 'card', showStock, showRating, actionMode = 'lead' } = config
  const layout = layoutProp || productLayout
  const [quantity, setQuantity] = useState(1)

  const initialVariants = useMemo(() => {
    const o: Record<string, string> = {}
    product.variants?.forEach((v) => {
      if (v.values[0]) o[v.key] = v.values[0]
    })
    return o
  }, [product.variants])

  const [variantPick, setVariantPick] = useState<Record<string, string>>(initialVariants)

  const getCTA = () => {
    switch (actionMode) {
      case 'link':
        return 'Xem sản phẩm'
      case 'direct':
        return 'Mua ngay'
      default:
        return 'Thêm vào giỏ'
    }
  }

  const fireAddToCart = () => {
    if (interactionsDisabled) return
    onAction?.('add_to_cart', buildAddToCartPayload(product, quantity, variantPick))
  }

  const stockLabel =
    showStock && product.stock !== undefined
      ? product.inStock === false
        ? 'Hết hàng'
        : `Còn hàng · ${product.stock} sản phẩm`
      : showStock && product.inStock === false
        ? 'Hết hàng'
        : null

  const variantSelectors =
    product.variants && product.variants.length > 0 ? (
      <div style={{ marginBottom: '8px' }}>
        {product.variants.map((v) => (
          <label key={v.key} style={{ display: 'block', fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>
            {v.key}
            <select
              value={variantPick[v.key] ?? ''}
              disabled={interactionsDisabled}
              onChange={(e) => setVariantPick((s) => ({ ...s, [v.key]: e.target.value }))}
              style={{
                width: '100%',
                marginTop: '4px',
                padding: '6px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                fontSize: '11px',
              }}
            >
              {v.values.map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    ) : null

  if (layout === 'list') {
    return (
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '8px',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          backgroundColor: '#fff',
        }}
      >
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '8px',
            backgroundColor: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
            />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#ccc">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#1e293b', marginBottom: '2px' }}>
            {product.name}
          </div>
          {showRating && product.rating && (
            <div style={{ fontSize: '10px', color: '#f59e0b' }}>
              {'★'.repeat(Math.floor(product.rating))}
              {'☆'.repeat(5 - Math.floor(product.rating))} {product.rating} ({product.reviewCount})
            </div>
          )}
          {stockLabel && (
            <div style={{ fontSize: '10px', color: product.inStock === false ? '#ef4444' : '#10b981' }}>{stockLabel}</div>
          )}
          <div style={{ fontSize: '14px', fontWeight: 600, color: primaryColor, marginTop: '4px' }}>
            {formatPrice(product.price)}
          </div>
        </div>
        <button
          type="button"
          disabled={interactionsDisabled}
          onClick={fireAddToCart}
          style={{
            padding: '6px 10px',
            border: `1px solid ${primaryColor}`,
            borderRadius: '6px',
            backgroundColor: 'transparent',
            color: primaryColor,
            fontSize: '11px',
            fontWeight: 500,
            cursor: interactionsDisabled ? 'not-allowed' : 'pointer',
            alignSelf: 'center',
            opacity: interactionsDisabled ? 0.6 : 1,
          }}
        >
          {getCTA()}
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden',
        backgroundColor: '#fff',
      }}
    >
      <div
        style={{
          height: '120px',
          backgroundColor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="48" height="48" viewBox="0 0 48 48" fill="#ddd">
            <rect x="4" y="4" width="40" height="40" rx="4" />
            <circle cx="16" cy="16" r="4" />
            <path d="M4 36l12-10 8 7 8-6 12 9" fill="#e5e7eb" />
          </svg>
        )}
      </div>
      <div style={{ padding: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b', marginBottom: '4px' }}>
          {product.name}
        </div>
        {showRating && product.rating && (
          <div style={{ fontSize: '10px', color: '#f59e0b', marginBottom: '2px' }}>
            {'★'.repeat(Math.floor(product.rating))}
            {'☆'.repeat(5 - Math.floor(product.rating))} {product.rating} ({product.reviewCount})
          </div>
        )}
        {stockLabel && (
          <div style={{ fontSize: '10px', color: product.inStock === false ? '#ef4444' : '#10b981', marginBottom: '4px' }}>
            {stockLabel}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
          <span style={{ fontSize: '16px', fontWeight: 600, color: primaryColor }}>
            {formatPrice(product.price)}
          </span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span style={{ fontSize: '12px', color: '#94a3b8', textDecoration: 'line-through' }}>
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </div>

        {product.sizes && product.sizes.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>Kích thước:</div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {product.sizes.map((size, idx) => (
                <span
                  key={size}
                  style={{
                    fontSize: '10px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: idx === 1 ? 'none' : '1px solid #e2e8f0',
                    backgroundColor: idx === 1 ? primaryColor : 'transparent',
                    color: idx === 1 ? '#fff' : '#64748b',
                  }}
                >
                  {size}
                </span>
              ))}
            </div>
          </div>
        )}

        {variantSelectors}

        <label style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          SL
          <input
            type="number"
            min={1}
            disabled={interactionsDisabled}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            style={{ width: '56px', padding: '4px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
          />
        </label>

        <button
          type="button"
          disabled={interactionsDisabled}
          onClick={fireAddToCart}
          style={{
            width: '100%',
            padding: '8px',
            border: 'none',
            borderRadius: '8px',
            backgroundColor: interactionsDisabled ? '#cbd5e1' : primaryColor,
            color: '#fff',
            fontSize: '12px',
            fontWeight: 500,
            cursor: interactionsDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {getCTA()}
        </button>
      </div>
    </div>
  )
}

export type { ProductCardProps }
