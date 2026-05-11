/**
 * WidgetConfig - Source of truth for widget UI configuration
 * Shared between packages/ui, apps/web, and apps/widget-sdk
 */

export interface FormField {
  key: string
  label: string
  required: boolean
  enabled: boolean
  type?: 'text' | 'email' | 'phone' | 'textarea'
}

export interface PaymentMethod {
  enabled: boolean
  label: string
  icon?: string
}

export interface PaymentMethods {
  cod?: boolean
  bank_transfer?: boolean
  momo?: boolean
  vnpay?: boolean
}

export interface BankInfo {
  bank_name?: string
  account_number?: string
  account_holder?: string
  /** Khớp dashboard / một số API (đồng nghĩa account_holder khi hiển thị). */
  account_name?: string
}

export interface OrderTracking {
  success_message: string
  show_order_summary: boolean
  show_delivery_estimate: boolean
  delivery_estimate_text?: string
  show_tracking_button: boolean
  tracking_button_text?: string
}

export interface WidgetConfig {
  // Branding
  botName: string
  primaryColor: string
  welcomeMessage: string
  logoUrl?: string
  placeholder?: string

  // Layout
  position: 'bottom-right' | 'bottom-left'
  fontSize?: string
  fontFamily?: 'sans' | 'serif'
  borderRadius?: string

  // Features
  salesEnabled: boolean
  showLogo: boolean
  showStock: boolean
  showRating: boolean
  productLayout: 'card' | 'list'
  actionMode: 'lead' | 'link' | 'direct'
  showSources: boolean

  // Form
  formFields: FormField[]
  paymentMethods: PaymentMethods
  bankInfo?: BankInfo
  orderTracking?: OrderTracking

  // API response fields (for backward compatibility)
  name?: string
  widget_color?: string
  widget_placeholder?: string
  widget_position?: string
  widget_welcome_message?: string
  widget_avatar_url?: string
  widget_font_size?: string
  widget_show_logo?: boolean
  sales_enabled?: boolean
  font_family?: string
  product_layout?: string
  show_stock?: boolean
  show_rating?: boolean
  form_fields?: FormField[]
  payment_methods?: PaymentMethods
  action_mode?: string
  greeting?: string
  primary_color?: string
}

/** Trích dẫn RAG (khớp client vanilla). */
export interface ChatCitation {
  source?: string
  metadata?: { title?: string; url?: string }
}

/** Rich component từ orchestrator (table, product_grid, bar_chart). */
export interface RichComponent {
  type: string
  data: unknown
}

export interface ActionButton {
  type: string
  label: string
  data?: Record<string, unknown>
}

export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
  /** Đang stream: chỉ dùng nội dung tạm */
  isStreaming?: boolean
  component?: RichComponent | null
  ui_components?: UIComponent[]
  citations?: ChatCitation[]
  metadata?: Record<string, unknown>
  action_buttons?: ActionButton[]
}

/** Block UI từ API sales (và tương thích product_card đơn lẻ). */
export type UIComponentType =
  | 'product_card'
  | 'product_cards'
  | 'cart'
  | 'order_form'
  | 'payment_selection'
  | 'order_confirmation'
  | 'checkout_link'

export interface UIComponent {
  type: UIComponentType | string
  data: Record<string, unknown>
  action?: {
    label: string
    payload: Record<string, unknown>
  }
}

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  imageUrl?: string
  options?: Record<string, string>
}

export interface CartState {
  items: CartItem[]
  total: number
}

export interface OrderFormData {
  fields: Record<string, string>
  paymentMethod: keyof PaymentMethods | null
}