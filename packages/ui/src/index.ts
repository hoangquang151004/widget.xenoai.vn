// WidgetConfig and types
export type {
  WidgetConfig,
  FormField,
  PaymentMethod,
  PaymentMethods,
  BankInfo,
  OrderTracking,
  ChatMessage,
  ChatCitation,
  RichComponent,
  UIComponent,
  UIComponentType,
  CartItem,
  CartState,
  OrderFormData,
  ActionButton,
} from './types'

export { ChatBubble } from './components/ChatBubble'
export type { ChatBubbleProps } from './components/ChatBubble'

export { ChatWindow } from './components/ChatWindow'
export type { ChatWindowProps } from './components/ChatWindow'
export { MessageList } from './components/MessageList'
export type { MessageListProps, MessageBubbleProps } from './components/MessageList'
export { ChatComposer } from './components/ChatComposer'
export type { ChatComposerProps } from './components/ChatComposer'
export { ProductCard } from './components/ProductCard'
export type { ProductCardProps, Product } from './components/ProductCard'
export { CartPanel } from './components/CartPanel'
export type { CartPanelProps } from './components/CartPanel'
export { OrderForm } from './components/OrderForm'
export type { OrderFormProps } from './components/OrderForm'
export { SalesPanel } from './components/SalesPanel'
export type { SalesPanelProps } from './components/SalesPanel'

// Utility functions
export { settingsToWidgetConfig, apiResponseToWidgetConfig, stripPriorSalesUi } from './utils'
export type { SettingsFormData } from './utils'

export * from './types'