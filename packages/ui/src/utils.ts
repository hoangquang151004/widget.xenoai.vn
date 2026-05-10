/**
 * Conversion utilities between API response format and WidgetConfig
 */

import type { WidgetConfig, FormField, PaymentMethods, OrderTracking } from './types'

// Re-export SettingsFormData for convenience
export interface SettingsFormData {
  name: string;
  widget_welcome_message: string;
  widget_color: string;
  logo_url: string;
  widget_placeholder: string;
  font_family: 'sans' | 'serif';
  position: 'bottom-right' | 'bottom-left';
  product_layout: 'card' | 'list';
  show_stock: boolean;
  show_rating: boolean;
  action_mode: 'lead' | 'link' | 'direct';
  form_fields: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    enabled: boolean;
  }>;
  payment_methods: PaymentMethods;
  bank_info: { bank_name: string; account_name: string; account_number: string; qr_url?: string } | null;
  order_tracking: OrderTracking;
}

/**
 * Convert SettingsFormData (web dashboard) to WidgetConfig (packages/ui)
 */
export function settingsToWidgetConfig(formData: SettingsFormData): WidgetConfig {
  return {
    // Branding
    botName: formData.name,
    primaryColor: formData.widget_color,
    welcomeMessage: formData.widget_welcome_message,
    logoUrl: formData.logo_url || undefined,
    placeholder: formData.widget_placeholder,
    
    // Layout
    position: formData.position,
    fontFamily: formData.font_family,
    
    // Features
    salesEnabled: true,
    showLogo: Boolean(formData.logo_url),
    showStock: formData.show_stock,
    showRating: formData.show_rating,
    productLayout: formData.product_layout,
    actionMode: formData.action_mode,
    showSources: true,
    
    // Form
    formFields: formData.form_fields.map(f => ({
      key: f.key,
      label: f.label,
      required: f.required,
      enabled: f.enabled,
      type: f.type === 'tel' ? 'phone' : f.type,
    })) as FormField[],
    paymentMethods: formData.payment_methods as PaymentMethods,
    bankInfo: formData.bank_info || undefined,
    orderTracking: formData.order_tracking,
    
    // Backward compatibility fields
    name: formData.name,
    widget_color: formData.widget_color,
    widget_placeholder: formData.widget_placeholder,
    widget_position: formData.position,
    widget_welcome_message: formData.widget_welcome_message,
    sales_enabled: true,
    font_family: formData.font_family,
    product_layout: formData.product_layout,
    show_stock: formData.show_stock,
    show_rating: formData.show_rating,
    form_fields: formData.form_fields.map(f => ({
      key: f.key,
      label: f.label,
      required: f.required,
      enabled: f.enabled,
      type: f.type === 'tel' ? 'phone' : f.type,
    })) as FormField[],
    payment_methods: formData.payment_methods,
    action_mode: formData.action_mode,
  }
}

/**
 * Convert API response to WidgetConfig
 */
export function apiResponseToWidgetConfig(apiResponse: Record<string, unknown>): WidgetConfig {
  return {
    botName: (apiResponse.bot_name || apiResponse.name || 'AI Assistant') as string,
    primaryColor: (apiResponse.primary_color || apiResponse.widget_color || '#2563eb') as string,
    welcomeMessage: (apiResponse.widget_welcome_message || apiResponse.greeting || 'Xin chào!') as string,
    logoUrl: (apiResponse.widget_avatar_url || apiResponse.logo_url) as string | undefined,
    placeholder: (apiResponse.widget_placeholder || apiResponse.placeholder || 'Nhập câu hỏi...') as string,
    
    position: ((apiResponse.widget_position || apiResponse.position || 'bottom-right') as 'bottom-right' | 'bottom-left'),
    fontFamily: (apiResponse.font_family || 'sans') as 'sans' | 'serif',
    
    salesEnabled: Boolean(apiResponse.sales_enabled),
    showLogo: Boolean(apiResponse.widget_show_logo),
    showStock: Boolean(apiResponse.show_stock),
    showRating: Boolean(apiResponse.show_rating),
    productLayout: ((apiResponse.product_layout || 'card') as 'card' | 'list'),
    actionMode: ((apiResponse.action_mode || 'lead') as 'lead' | 'link' | 'direct'),
    showSources: true,
    
    formFields: ((apiResponse.form_fields || []) as FormField[]),
    paymentMethods: ((apiResponse.payment_methods || {}) as PaymentMethods),
    bankInfo: (apiResponse.bank_info || undefined) as { bank_name?: string; account_number?: string; account_holder?: string } | undefined,
    
    // API response fields
    ...apiResponse,
  }
}