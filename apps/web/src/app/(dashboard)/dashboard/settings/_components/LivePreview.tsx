"use client";

import { useEffect, useMemo, useState } from "react";
import type { SettingsFormData } from "./types";
import {
  ChatBubble,
  ChatComposer,
  ChatWindow,
  MessageList,
  SalesPanel,
  settingsToWidgetConfig,
  type ChatMessage,
  type Product,
  type SettingsFormData as PackageSettingsFormData,
  type UIComponent,
} from "@widget-chatbot/ui";

type Props = {
  formData: SettingsFormData;
  activeSub: string;
};

const STEPS = ["Sản phẩm", "Giỏ hàng", "Thông tin", "Thanh toán", "Xác nhận"];

const SUB_TO_STEP: Record<string, number> = {
  product: 0,
  form: 2,
  payment: 3,
  tracking: 4,
};

const PAY_LABELS: Record<string, string> = {
  cod: "COD · Thanh toán khi nhận",
  bank_transfer: "Chuyển khoản ngân hàng",
  momo: "Ví MoMo",
  vnpay: "VNPay / Thẻ ngân hàng",
};

const MOCK_PANEL_PRODUCT: Product = {
  id: "preview-p1",
  externalId: "preview-p1",
  name: "Áo thun Premium Cotton",
  price: 249_000,
  originalPrice: 299_000,
  imageUrl: "https://placehold.co/120x120/e2e8f0/64748b?text=IMG",
  stock: 45,
  inStock: true,
  variants: [{ key: "size", values: ["S", "M", "L", "XL"] }],
};

function toPackageSettings(fd: SettingsFormData): PackageSettingsFormData {
  return {
    name: fd.name,
    widget_welcome_message: fd.widget_welcome_message,
    widget_color: fd.widget_color,
    logo_url: fd.logo_url,
    widget_placeholder: fd.widget_placeholder,
    font_family: fd.font_family,
    position: fd.position,
    product_layout: fd.product_layout,
    show_stock: fd.show_stock,
    show_rating: fd.show_rating,
    action_mode: fd.action_mode,
    form_fields: fd.form_fields.map(({ key, label, type, required, enabled }) => ({
      key,
      label,
      type,
      required,
      enabled,
    })),
    payment_methods: fd.payment_methods,
    bank_info: fd.bank_info,
    order_tracking: fd.order_tracking,
  };
}

function demoProductRecord(fd: SettingsFormData): Record<string, unknown> {
  return {
    id: "preview-p1",
    external_id: "preview-p1",
    name: "Áo thun Premium Cotton",
    price: 249_000,
    compare_price: 299_000,
    images: [{ url: "https://placehold.co/120x120/e2e8f0/64748b?text=IMG" }],
    stock_quantity: fd.show_stock ? 45 : undefined,
    in_stock: true,
    show_rating: fd.show_rating,
    variants: [{ key: "size", values: ["S", "M", "L", "XL"] }],
  };
}

function buildPaymentMethodsForBlock(fd: SettingsFormData) {
  const methods: Array<{ key: string; label: string; bank_info?: Record<string, string> }> = [];
  const pm = fd.payment_methods;
  if (pm.cod) methods.push({ key: "cod", label: PAY_LABELS.cod });
  if (pm.bank_transfer) {
    const bi = fd.bank_info;
    methods.push({
      key: "bank_transfer",
      label: PAY_LABELS.bank_transfer,
      bank_info: bi
        ? {
            bank: bi.bank_name,
            stk: bi.account_number,
            owner: bi.account_name,
          }
        : undefined,
    });
  }
  if (pm.momo) methods.push({ key: "momo", label: PAY_LABELS.momo });
  if (pm.vnpay) methods.push({ key: "vnpay", label: PAY_LABELS.vnpay });
  if (methods.length === 0) methods.push({ key: "cod", label: PAY_LABELS.cod });
  return methods;
}

function buildFormFields(fd: SettingsFormData) {
  return [...fd.form_fields]
    .filter((f) => f.enabled)
    .sort((a, b) => a.order - b.order)
    .map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      prefilled:
        f.key === "name"
          ? "Nguyễn Văn A"
          : f.key === "phone"
            ? "0901234567"
            : f.key === "address"
              ? "123 Đường ABC, Quận 1"
              : "",
    }));
}

function buildMessagesForSalesStep(step: number, fd: SettingsFormData): ChatMessage[] {
  const now = () => new Date();
  const welcome: ChatMessage = {
    id: "welcome",
    role: "assistant",
    content: fd.widget_welcome_message,
    timestamp: now(),
  };
  const userBrowse: ChatMessage = {
    id: "u-browse",
    role: "user",
    content: "Tìm áo thun đi chơi cuối tuần",
    timestamp: now(),
  };
  const prod = demoProductRecord(fd);
  const productUi: UIComponent = {
    type: "product_cards",
    data: { layout: fd.product_layout, products: [prod] },
  };
  const assistProduct: ChatMessage = {
    id: "a-product",
    role: "assistant",
    content: "Tìm thấy sản phẩm phù hợp 👇",
    timestamp: now(),
    ui_components: [productUi],
  };

  if (step === 0) return [welcome, userBrowse, assistProduct];

  const price = Number(prod.price ?? 0);
  const cartUi: UIComponent = {
    type: "cart",
    data: {
      items: [
        {
          name: String(prod.name ?? ""),
          quantity: 1,
          line_total: price,
        },
      ],
      subtotal: price,
    },
  };
  const assistCart: ChatMessage = {
    id: "a-cart",
    role: "assistant",
    content: "Bạn đã thêm sản phẩm vào giỏ.",
    timestamp: now(),
    ui_components: [cartUi],
  };
  if (step === 1) return [welcome, userBrowse, assistProduct, assistCart];

  const formUi: UIComponent = {
    type: "order_form",
    data: { fields: buildFormFields(fd) },
  };
  const assistForm: ChatMessage = {
    id: "a-form",
    role: "assistant",
    content: "Vui lòng điền thông tin giao hàng:",
    timestamp: now(),
    ui_components: [formUi],
  };
  if (step === 2) return [welcome, userBrowse, assistProduct, assistCart, assistForm];

  const payUi: UIComponent = {
    type: "payment_selection",
    data: { methods: buildPaymentMethodsForBlock(fd) },
  };
  const assistPay: ChatMessage = {
    id: "a-pay",
    role: "assistant",
    content: "Chọn cách thanh toán:",
    timestamp: now(),
    ui_components: [payUi],
  };
  if (step === 3) return [welcome, userBrowse, assistProduct, assistCart, assistForm, assistPay];

  const t = fd.order_tracking;
  const confirmUi: UIComponent = {
    type: "order_confirmation",
    data: {
      order_id: "8821",
      items: [{ name: String(prod.name ?? ""), quantity: 1 }],
      subtotal: price,
    },
  };
  const tail: ChatMessage[] = [
    {
      id: "a-confirm",
      role: "assistant",
      content: t.success_message,
      timestamp: now(),
      ui_components: [confirmUi],
    },
  ];
  if (t.show_tracking_button) {
    tail.push({
      id: "a-track",
      role: "assistant",
      content: t.show_delivery_estimate
        ? `Dự kiến giao: ${t.delivery_estimate_text}`
        : "Theo dõi đơn hàng của bạn bên dưới.",
      timestamp: now(),
      action_buttons: [
        {
          type: "link",
          label: t.tracking_button_text,
          data: { url: "#" },
        },
      ],
    });
  }
  return [welcome, userBrowse, assistProduct, assistCart, assistForm, assistPay, ...tail];
}

function buildMessagesGeneral(fd: SettingsFormData): ChatMessage[] {
  const now = () => new Date();
  return [
    {
      id: "welcome",
      role: "assistant",
      content: fd.widget_welcome_message,
      timestamp: now(),
    },
    {
      id: "u1",
      role: "user",
      content: "Hỏi về sản phẩm",
      timestamp: now(),
    },
    {
      id: "a1",
      role: "assistant",
      content: "Tôi có thể giúp bạn tìm sản phẩm phù hợp. Bạn cần gì?",
      timestamp: now(),
    },
  ];
}

export default function LivePreview({ formData, activeSub }: Props) {
  const [step, setStep] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const [salesPanelOpen, setSalesPanelOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);

  useEffect(() => {
    const mapped = SUB_TO_STEP[activeSub];
    if (mapped !== undefined) setStep(mapped);
  }, [activeSub]);

  const showSalesPreview = ["form", "payment", "product", "tracking"].includes(activeSub);

  const widgetConfig = useMemo(
    () => settingsToWidgetConfig(toPackageSettings(formData)),
    [formData],
  );

  const messages = useMemo(() => {
    if (showSalesPreview) return buildMessagesForSalesStep(step, formData);
    return buildMessagesGeneral(formData);
  }, [showSalesPreview, step, formData]);

  const isRight = formData.position !== "bottom-left";

  const openSalesPanel = () => {
    setSelectedProduct(MOCK_PANEL_PRODUCT);
    setSalesPanelOpen(true);
  };

  const closeSalesPanel = () => {
    setSalesPanelOpen(false);
    setSelectedProduct(undefined);
  };

  const noopAction = (_action: string, _payload: Record<string, unknown>) => {
    /* preview: không gọi API */
  };

  const panelOpenButton = (
    <button
      type="button"
      onClick={openSalesPanel}
      style={{
        fontSize: "11px",
        padding: "4px 8px",
        borderRadius: "6px",
        border: "1px solid rgba(255,255,255,0.5)",
        background: "rgba(255,255,255,0.15)",
        color: "#fff",
        cursor: "pointer",
        marginRight: "4px",
      }}
    >
      Panel bán hàng
    </button>
  );

  return (
    <div className="sticky top-28 space-y-4">
      <div className="flex items-center justify-between px-1">
        <h4 className="text-[9px] font-bold uppercase tracking-[0.07em] text-slate-400">
          Live preview
        </h4>
        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-tight">@widget-chatbot/ui</span>
        </div>
      </div>

      <div
        className="relative bg-slate-50 border-2 border-slate-200 rounded-[20px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.08)]"
        style={{ minHeight: 620 }}
      >
        <div className="bg-white border-b border-slate-100 px-3 py-2 flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-[7px] h-[7px] rounded-full bg-red-300" />
            <div className="w-[7px] h-[7px] rounded-full bg-amber-300" />
            <div className="w-[7px] h-[7px] rounded-full bg-emerald-300" />
          </div>
          <div className="flex-1 bg-slate-100 rounded-md px-2 py-[3px]">
            <span className="text-[8px] text-slate-400 font-medium">yourwebsite.com</span>
          </div>
        </div>

        <div className="px-4 pt-5 pb-2">
          <div className="h-3 w-3/4 bg-slate-200 rounded mb-2" />
          <div className="h-2 w-full bg-slate-100 rounded mb-1.5" />
          <div className="h-2 w-5/6 bg-slate-100 rounded mb-1.5" />
          <div className="h-2 w-2/3 bg-slate-100 rounded mb-4" />
          <div className="h-[60px] bg-slate-100 rounded-lg mb-3" />
          <div className="h-2 w-full bg-slate-100 rounded mb-1.5" />
          <div className="h-2 w-4/5 bg-slate-100 rounded" />
        </div>

        <div
          className="absolute"
          style={{
            bottom: 48,
            ...(isRight ? { right: 4 } : { left: 4 }),
            width: 320,
            height: 620,
            transform: "scale(0.72)",
            transformOrigin: isRight ? "bottom right" : "bottom left",
            pointerEvents: "auto",
          }}
        >
          <ChatBubble
            primaryColor={widgetConfig.primaryColor}
            position={widgetConfig.position}
            isOpen={isOpen}
            onClick={() => setIsOpen((v) => !v)}
            unreadCount={0}
          />
          <ChatWindow
            config={widgetConfig}
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            headerExtra={panelOpenButton}
            footer={
              <>
                {showSalesPreview ? (
                  <div
                    style={{
                      padding: "0 0 8px",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontSize: "9px", color: "#94a3b8" }}>{STEPS[step]}</span>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "4px",
                        marginTop: "4px",
                      }}
                    >
                      {STEPS.map((label, i) => (
                        <button
                          key={label}
                          type="button"
                          title={label}
                          onClick={() => setStep(i)}
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "999px",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            background: i === step ? widgetConfig.primaryColor : "#d1d5db",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
                <ChatComposer
                  placeholder={widgetConfig.placeholder || "Nhập tin nhắn..."}
                  primaryColor={widgetConfig.primaryColor}
                  disabled
                  onSend={() => {}}
                />
              </>
            }
          >
            <MessageList
              messages={messages}
              config={widgetConfig}
              onAction={noopAction}
              onOpenSalesPanel={(data?: Record<string, unknown>) => {
                const p = data?.product as Product | undefined;
                setSelectedProduct(p ?? MOCK_PANEL_PRODUCT);
                setSalesPanelOpen(true);
              }}
            />
          </ChatWindow>
          <SalesPanel
            isOpen={salesPanelOpen}
            onClose={closeSalesPanel}
            config={widgetConfig}
            initialProduct={selectedProduct}
            onAction={noopAction}
          />
        </div>
      </div>
    </div>
  );
}
