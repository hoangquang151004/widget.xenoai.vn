import type { Dispatch, SetStateAction } from "react";

export type FormFieldType = "text" | "tel" | "email" | "textarea";

export type FormFieldDef = {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  enabled: boolean;
  order: number;
};

export type PaymentMethods = {
  cod: boolean;
  bank_transfer: boolean;
  momo: boolean;
  vnpay: boolean;
};

export type BankInfo = {
  bank_name: string;
  account_name: string;
  account_number: string;
  qr_url?: string;
};

export type OrderTrackingConfig = {
  show_order_summary: boolean;
  show_delivery_estimate: boolean;
  delivery_estimate_text: string;
  success_message: string;
  show_tracking_button: boolean;
  tracking_button_text: string;
};

export type SettingsFormData = {
  name: string;
  widget_welcome_message: string;
  widget_color: string;
  logo_url: string;
  widget_placeholder: string;
  font_family: "sans" | "serif";
  position: "bottom-right" | "bottom-left";

  system_prompt: string;
  is_sql_enabled: boolean;
  is_rag_enabled: boolean;

  product_layout: "card" | "list";
  show_stock: boolean;
  show_rating: boolean;
  action_mode: "lead" | "link" | "direct";
  form_fields: FormFieldDef[];
  payment_methods: PaymentMethods;
  bank_info: BankInfo | null;
  order_tracking: OrderTrackingConfig;
};

export const DEFAULT_FORM_FIELDS: FormFieldDef[] = [
  { key: "name", label: "Họ và tên", type: "text", required: true, enabled: true, order: 1 },
  { key: "phone", label: "Số điện thoại", type: "tel", required: true, enabled: true, order: 2 },
  { key: "address", label: "Địa chỉ giao hàng", type: "text", required: true, enabled: true, order: 3 },
  { key: "email", label: "Email", type: "email", required: false, enabled: false, order: 4 },
  { key: "note", label: "Ghi chú", type: "textarea", required: false, enabled: true, order: 5 },
];

export const DEFAULT_PAYMENT_METHODS: PaymentMethods = {
  cod: true,
  bank_transfer: false,
  momo: false,
  vnpay: false,
};

export const DEFAULT_BANK_INFO: BankInfo = {
  bank_name: "",
  account_name: "",
  account_number: "",
  qr_url: "",
};

export const DEFAULT_ORDER_TRACKING: OrderTrackingConfig = {
  show_order_summary: true,
  show_delivery_estimate: true,
  delivery_estimate_text: "24–48 giờ làm việc",
  success_message: "Đặt hàng thành công! 🎉",
  show_tracking_button: true,
  tracking_button_text: "Theo dõi đơn hàng",
};

export type SectionProps = {
  formData: SettingsFormData;
  setFormData: Dispatch<SetStateAction<SettingsFormData>>;
  onUploadAvatar?: (file: File) => Promise<void>;
  isUploadingAvatar?: boolean;
};

export type ActiveTab = "widget" | "sales";
export type ActiveSub = "brand" | "form" | "payment" | "product" | "tracking" | "ai" | "embed";

export const COLOR_PRESETS = [
  "#185FA5",
  "#1D9E75",
  "#7F77DD",
  "#D85A30",
  "#D4537E",
  "#BA7517",
];
