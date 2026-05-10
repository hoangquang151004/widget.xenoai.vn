import React, { useState } from 'react'
import type { UIComponent, WidgetConfig } from '../types'
import { ProductCard } from './ProductCard'
import type { Product } from './ProductCard'

export type SalesActionHandler = (action: string, payload: Record<string, unknown>) => void

/** Map một object sản phẩm từ API → Product cho ProductCard. */
export function apiRecordToProduct(raw: Record<string, unknown>, _config: WidgetConfig): Product {
  const images = raw.images as Array<{ url?: string }> | undefined
  const imageUrl = images?.[0]?.url
  const variantsRaw = raw.variants as Array<{ key?: string; values?: unknown[] }> | undefined
  const variants =
    variantsRaw
      ?.filter((v) => v.key && Array.isArray(v.values) && v.values.length > 0)
      .map((v) => ({
        key: String(v.key),
        values: v.values!.map((x) => String(x)),
      })) ?? undefined

  const showRating = raw.show_rating === true
  const pid = String(raw.id ?? '')
  const ext = raw.external_id != null ? String(raw.external_id) : pid

  return {
    id: pid,
    externalId: ext,
    name: String(raw.name ?? 'Sản phẩm'),
    price: Number(raw.price ?? 0),
    originalPrice: raw.compare_price != null ? Number(raw.compare_price) : undefined,
    imageUrl,
    stock: raw.stock_quantity != null ? Number(raw.stock_quantity) : undefined,
    inStock: raw.in_stock !== false,
    variants,
    rating: showRating ? 4.2 : undefined,
    reviewCount: showRating ? 128 : undefined,
  }
}

const formatVnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n)

interface SalesBlockProps {
  block: UIComponent
  config: WidgetConfig
  onAction: SalesActionHandler
}

export const SalesBlock: React.FC<SalesBlockProps> = ({ block, config, onAction }) => {
  const { primaryColor } = config
  const d = block.data || {}

  if (block.type === 'product_cards') {
    const layout = (d.layout === 'list' ? 'list' : 'card') as 'card' | 'list'
    const products = (d.products as Record<string, unknown>[]) || []
    const gridClass = layout === 'list' ? 'column' : 'grid'
    return (
      <div
        style={
          gridClass === 'grid'
            ? {
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '10px',
                width: '100%',
                maxWidth: '280px',
              }
            : { display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }
        }
      >
        {products.map((p, idx) => (
          <ProductCard
            key={String(p.id ?? idx)}
            product={apiRecordToProduct(p, config)}
            config={config}
            layout={layout}
            onAction={onAction}
          />
        ))}
      </div>
    )
  }

  if (block.type === 'cart') {
    const items = (d.items as Record<string, unknown>[]) || []
    const subtotal = Number(d.subtotal ?? 0)
    const hasItems = items.length > 0
    return (
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px',
          backgroundColor: '#fff',
          fontSize: '12px',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '8px' }}>Giỏ hàng của bạn</div>
        {items.length === 0 ? (
          <div style={{ color: '#94a3b8', padding: '8px 0' }}>Chưa có sản phẩm.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {String(it.name ?? '')} x{Number(it.quantity ?? 1)}
                </span>
                <span style={{ fontWeight: 600 }}>{formatVnd(Number(it.line_total ?? 0))}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ color: '#64748b' }}>Tạm tính</span>
          <strong style={{ color: primaryColor }}>{formatVnd(subtotal)}</strong>
        </div>
        <button
          type="button"
          disabled={!hasItems}
          onClick={() => onAction('checkout', {})}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: hasItems ? primaryColor : '#cbd5e1',
            color: '#fff',
            fontWeight: 600,
            cursor: hasItems ? 'pointer' : 'not-allowed',
            fontSize: '12px',
          }}
        >
          Thanh toán
        </button>
      </div>
    )
  }

  if (block.type === 'order_form') {
    return <SalesOrderFormBlock primaryColor={primaryColor} fields={(d.fields as FormRow[]) || []} onAction={onAction} />
  }

  if (block.type === 'payment_selection') {
    return <PaymentSelectionBlock primaryColor={primaryColor} methods={(d.methods as PayMethod[]) || []} onAction={onAction} />
  }

  if (block.type === 'order_confirmation') {
    const items = (d.items as Record<string, unknown>[]) || []
    return (
      <div
        style={{
          border: '1px solid #bbf7d0',
          borderRadius: '12px',
          padding: '14px',
          backgroundColor: '#f0fdf4',
          fontSize: '12px',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '8px' }}>Đặt hàng thành công</div>
        <div style={{ marginBottom: '8px', color: '#166534' }}>
          Mã đơn: <strong>#{String(d.order_id ?? '')}</strong>
        </div>
        <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
          {items.map((it, i) => (
            <li key={i}>
              {String(it.name ?? '')} ×{Number(it.quantity ?? 1)}
            </li>
          ))}
        </ul>
        <div>
          Tổng: <strong>{formatVnd(Number(d.subtotal ?? 0))}</strong>
        </div>
      </div>
    )
  }

  if (block.type === 'checkout_link') {
    return <CheckoutLinkBlock primaryColor={primaryColor} url={String(d.url ?? '#')} expiresMinutes={Number(d.expires_minutes ?? 30)} />
  }

  return null
}

type FormRow = { key: string; label: string; type?: string; required?: boolean; prefilled?: string }

const SalesOrderFormBlock: React.FC<{
  primaryColor: string
  fields: FormRow[]
  onAction: SalesActionHandler
}> = ({ primaryColor, fields, onAction }) => {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    fields.forEach((f) => {
      o[f.key] = f.prefilled != null ? String(f.prefilled) : ''
    })
    return o
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    onAction('submit_form', { ...vals })
  }

  return (
    <form
      onSubmit={submit}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        fontSize: '12px',
      }}
    >
      {fields.map((f) => (
        <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span>{f.label}</span>
          {f.type === 'textarea' ? (
            <textarea
              required={f.required}
              value={vals[f.key] ?? ''}
              onChange={(e) => setVals((s) => ({ ...s, [f.key]: e.target.value }))}
              rows={3}
              style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'inherit' }}
            />
          ) : (
            <input
              type={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text'}
              required={f.required}
              value={vals[f.key] ?? ''}
              onChange={(e) => setVals((s) => ({ ...s, [f.key]: e.target.value }))}
              style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
            />
          )}
        </label>
      ))}
      <button
        type="submit"
        style={{
          padding: '10px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: primaryColor,
          color: '#fff',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Gửi đơn
      </button>
    </form>
  )
}

type PayMethod = { key?: string; label?: string; bank_info?: Record<string, unknown> }

const PaymentSelectionBlock: React.FC<{
  primaryColor: string
  methods: PayMethod[]
  onAction: SalesActionHandler
}> = ({ primaryColor, methods, onAction }) => {
  const [selected, setSelected] = useState(methods[0]?.key || 'cod')

  if (!methods.length) {
    return <div style={{ fontSize: '12px', color: '#64748b' }}>Chưa có phương thức thanh toán.</div>
  }

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '12px',
        fontSize: '12px',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '10px' }}>Chọn phương thức thanh toán</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {methods.map((m, idx) => {
          const key = String(m.key ?? `m${idx}`)
          return (
            <label
              key={key}
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="pay"
                checked={selected === key}
                onChange={() => setSelected(key)}
              />
              <span>
                {m.label || key}
                {m.bank_info && (
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                    {Object.values(m.bank_info)
                      .filter(Boolean)
                      .map(String)
                      .join(' · ')}
                  </div>
                )}
              </span>
            </label>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => onAction('confirm_order', { payment_method: selected })}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: primaryColor,
          color: '#fff',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Xác nhận và đặt hàng
      </button>
    </div>
  )
}

const CheckoutLinkBlock: React.FC<{ primaryColor: string; url: string; expiresMinutes: number }> = ({
  primaryColor,
  url,
  expiresMinutes,
}) => (
  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', fontSize: '12px' }}>
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-block',
        padding: '10px 14px',
        backgroundColor: primaryColor,
        color: '#fff',
        borderRadius: '8px',
        textDecoration: 'none',
        fontWeight: 600,
      }}
    >
      Mở trang thanh toán
    </a>
    <div style={{ marginTop: '8px', color: '#64748b', fontSize: '11px' }}>
      Link có hiệu lực khoảng {expiresMinutes} phút.
    </div>
  </div>
)
