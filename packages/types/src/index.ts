// chat.ts
export type ComponentType =
  | 'product_grid' | 'cart_summary'
  | 'chart_bar'    | 'chart_line'
  | 'order_history'| 'payment_form'
  | 'invoice'      | 'text_markdown';

export interface Component {
  type: ComponentType;
  data: any;
  meta?: {
    title?: string;
    subtitle?: string;
    actions?: { label: string; event: string }[];
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  component?: Component;
  timestamp: number;
}

// tenant.ts
export interface TenantKeys {
  public_key: string;   // pk_live_xxx — nhúng vào shop
  admin_key: string;    // sk_live_xxx — dashboard admin
}

export interface WidgetConfig {
  primaryColor: string;
  botName: string;
  greeting: string;
  position: 'bottom-right' | 'bottom-left';
  language: string;
  showSources: boolean;
}

export * from './sales-v2';
