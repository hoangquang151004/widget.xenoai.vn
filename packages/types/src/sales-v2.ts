/**
 * Hợp đồng API V2 — UI components trong chat + action từ widget.
 * Đồng bộ với tasks/task_version_2/plan_v2.md (mục 5.2–5.3).
 * Response chat hiện tại: content, metadata, citations, component.
 * Khi bật sales: thêm ui_components (mặc định []), slots?, intent?.
 */

export type SalesUIComponentType =
  | 'product_cards'
  | 'cart'
  | 'order_form'
  | 'payment_selection'
  | 'order_confirmation'
  | 'checkout_link';

export interface ProductImage {
  url: string;
  alt?: string;
}

export interface ProductVariantDef {
  key: string;
  values: string[];
}

export interface ProductCardItem {
  id: string;
  external_id: string;
  name: string;
  price: number;
  compare_price?: number | null;
  in_stock: boolean;
  stock_quantity?: number | null;
  images: ProductImage[];
  variants: ProductVariantDef[];
  show_stock: boolean;
  show_rating: boolean;
}

export interface ProductCardsData {
  layout: 'card' | 'list';
  products: ProductCardItem[];
}

export interface CartLineItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  variant_key?: string | null;
  variant_value?: string | null;
  line_total: number;
}

export interface CartData {
  items: CartLineItem[];
  subtotal: number;
  primary_color: string;
}

export interface OrderFormField {
  key: string;
  label: string;
  type: 'text' | 'tel' | 'email' | 'textarea';
  required: boolean;
  prefilled?: string;
}

/** Cấu hình field trên tenant (GET /api/v1/chat/config). */
export interface SalesFormFieldConfig {
  key: string;
  label: string;
  type: 'text' | 'tel' | 'email' | 'textarea';
  required: boolean;
  enabled: boolean;
  order: number;
}

export interface OrderFormData {
  fields: OrderFormField[];
  primary_color: string;
}

export interface PaymentMethodOption {
  key: string;
  label: string;
  icon: string;
  bank_info?: {
    bank_name?: string;
    account?: string;
    holder?: string;
  };
}

export interface PaymentSelectionData {
  methods: PaymentMethodOption[];
  primary_color: string;
}

export interface OrderConfirmationData {
  order_id: string;
  external_order_id?: string | null;
  items: CartLineItem[];
  subtotal: number;
  payment_method: string;
  estimated_delivery?: string | null;
  primary_color: string;
}

export interface CheckoutLinkData {
  url: string;
  expires_minutes: number;
  subtotal: number;
  primary_color: string;
}

export type SalesUIComponent =
  | { type: 'product_cards'; data: ProductCardsData }
  | { type: 'cart'; data: CartData }
  | { type: 'order_form'; data: OrderFormData }
  | { type: 'payment_selection'; data: PaymentSelectionData }
  | { type: 'order_confirmation'; data: OrderConfirmationData }
  | { type: 'checkout_link'; data: CheckoutLinkData };

/** Contract response chat sales đã chốt giữa API ↔ SDK ↔ packages/types. */
export interface SalesChatResponse {
  text: string;
  ui_components: SalesUIComponent[];
  slots: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  // Backward compatibility với client cũ.
  content?: string;
  citations?: unknown[];
  component?: unknown;
}

/** Gửi từ widget khi user tương tác UI (đề xuất body mở rộng hoặc message đặc biệt). */
export type WidgetClientActionType = 'add_to_cart' | 'submit_form' | 'confirm_order';

export interface WidgetActionMessage {
  type: 'action';
  action: WidgetClientActionType;
  data: Record<string, unknown>;
}

/** Public widget config — mở rộng GET /api/v1/chat/config (không chứa secret). */
export interface SalesWidgetPublicConfig {
  font_family: 'sans' | 'serif';
  product_layout: 'card' | 'list';
  show_stock: boolean;
  show_rating: boolean;
  form_fields: SalesFormFieldConfig[];
  payment_methods: Record<string, boolean>;
  action_mode: 'lead' | 'link' | 'direct';
}
