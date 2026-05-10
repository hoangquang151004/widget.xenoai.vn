import { describe, expect, it } from 'vitest'
import { stripPriorSalesUi } from './utils'
import type { ChatMessage } from './types'

describe('stripPriorSalesUi', () => {
  it('không đổi khi add_to_cart', () => {
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'Giỏ',
        ui_components: [{ type: 'cart', data: { items: [], subtotal: 0 } }],
      },
    ]
    const out = stripPriorSalesUi(messages, 'add_to_cart')
    expect(out[0].ui_components).toHaveLength(1)
  })

  it('confirm_order gỡ cart, order_form, payment_selection khỏi tin cũ', () => {
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'Pay',
        ui_components: [
          { type: 'payment_selection', data: { methods: [] } },
          { type: 'order_confirmation', data: { order_id: 'x' } },
        ],
      },
    ]
    const out = stripPriorSalesUi(messages, 'confirm_order')
    expect(out[0].ui_components).toEqual([{ type: 'order_confirmation', data: { order_id: 'x' } }])
  })

  it('checkout chỉ gỡ cart', () => {
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'A',
        ui_components: [
          { type: 'cart', data: {} },
          { type: 'product_cards', data: { products: [] } },
        ],
      },
    ]
    const out = stripPriorSalesUi(messages, 'checkout')
    expect(out[0].ui_components).toEqual([{ type: 'product_cards', data: { products: [] } }])
  })

  it('bỏ hẳn ui_components khi không còn phần tử', () => {
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'C',
        ui_components: [{ type: 'cart', data: {} }],
      },
    ]
    const out = stripPriorSalesUi(messages, 'submit_form')
    expect(out[0].ui_components).toBeUndefined()
  })
})
