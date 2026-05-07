"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import AiSection from "./_components/AiSection";
import BrandingSection from "./_components/BrandingSection";
import EmbedSection from "./_components/EmbedSection";
import FormFieldsPanel from "./_components/FormFieldsPanel";
import LivePreview from "./_components/LivePreview";
import OrderTrackingPanel from "./_components/OrderTrackingPanel";
import PaymentPanel from "./_components/PaymentPanel";
import ProductPanel from "./_components/ProductPanel";
import {
  ActiveSub,
  ActiveTab,
  DEFAULT_BANK_INFO,
  DEFAULT_FORM_FIELDS,
  DEFAULT_ORDER_TRACKING,
  DEFAULT_PAYMENT_METHODS,
  FormFieldDef,
  FormFieldType,
  SettingsFormData,
} from "./_components/types";

function normalizeFormFields(input: unknown): FormFieldDef[] {
  if (!Array.isArray(input) || input.length === 0) return [...DEFAULT_FORM_FIELDS];
  const allowedTypes: FormFieldType[] = ["text", "tel", "email", "textarea"];
  return input
    .map((item, idx) => {
      const row = item as Partial<FormFieldDef>;
      const type = allowedTypes.includes(row.type as FormFieldType)
        ? (row.type as FormFieldType)
        : "text";
      return {
        key: (row.key || `field_${idx + 1}`).toString(),
        label: (row.label || `Trường ${idx + 1}`).toString(),
        type,
        required: Boolean(row.required),
        enabled: row.enabled !== false,
        order: Number(row.order) > 0 ? Number(row.order) : idx + 1,
      };
    })
    .sort((a, b) => a.order - b.order);
}

function normalizePaymentMethods(input: unknown) {
  const source = (input || {}) as Record<string, unknown>;
  return {
    cod: source.cod !== undefined ? Boolean(source.cod) : DEFAULT_PAYMENT_METHODS.cod,
    bank_transfer:
      source.bank_transfer !== undefined
        ? Boolean(source.bank_transfer)
        : DEFAULT_PAYMENT_METHODS.bank_transfer,
    momo:
      source.momo !== undefined ? Boolean(source.momo) : DEFAULT_PAYMENT_METHODS.momo,
    vnpay:
      source.vnpay !== undefined ? Boolean(source.vnpay) : DEFAULT_PAYMENT_METHODS.vnpay,
  };
}

function mapToFormData(data: any): SettingsFormData {
  const paymentMethods = normalizePaymentMethods(data.widget?.payment_methods);
  return {
    name: data.name || "",
    widget_welcome_message: data.widget?.greeting || "Xin chào! Tôi có thể giúp gì cho bạn?",
    widget_color: data.widget?.primary_color || "#4F46E5",
    logo_url: data.widget?.logo_url || "",
    widget_placeholder: data.widget?.placeholder || "Nhập câu hỏi...",
    font_family: data.widget?.font_family === "serif" ? "serif" : "sans",
    position: data.widget?.position === "bottom-left" ? "bottom-left" : "bottom-right",
    system_prompt:
      data.ai_settings?.system_prompt ||
      "Bạn là một trợ lý AI chuyên nghiệp và thân thiện.",
    is_sql_enabled:
      data.ai_settings?.is_sql_enabled !== undefined
        ? data.ai_settings.is_sql_enabled
        : true,
    is_rag_enabled:
      data.ai_settings?.is_rag_enabled !== undefined
        ? data.ai_settings.is_rag_enabled
        : true,
    product_layout: data.widget?.product_layout === "list" ? "list" : "card",
    show_stock: data.widget?.show_stock !== undefined ? Boolean(data.widget?.show_stock) : true,
    show_rating:
      data.widget?.show_rating !== undefined ? Boolean(data.widget?.show_rating) : false,
    action_mode:
      data.widget?.action_mode === "link" || data.widget?.action_mode === "direct"
        ? data.widget.action_mode
        : "lead",
    form_fields: normalizeFormFields(data.widget?.form_fields),
    payment_methods: paymentMethods,
    bank_info:
      data.widget?.bank_info && typeof data.widget.bank_info === "object"
        ? {
            bank_name: String(data.widget.bank_info.bank_name || ""),
            account_name: String(data.widget.bank_info.account_name || ""),
            account_number: String(data.widget.bank_info.account_number || ""),
            qr_url: String(data.widget.bank_info.qr_url || ""),
          }
        : paymentMethods.bank_transfer
          ? { ...DEFAULT_BANK_INFO }
          : null,
    order_tracking:
      data.widget?.order_tracking && typeof data.widget.order_tracking === "object"
        ? {
            show_order_summary: data.widget.order_tracking.show_order_summary !== false,
            show_delivery_estimate: data.widget.order_tracking.show_delivery_estimate !== false,
            delivery_estimate_text: String(data.widget.order_tracking.delivery_estimate_text || DEFAULT_ORDER_TRACKING.delivery_estimate_text),
            success_message: String(data.widget.order_tracking.success_message || DEFAULT_ORDER_TRACKING.success_message),
            show_tracking_button: data.widget.order_tracking.show_tracking_button !== false,
            tracking_button_text: String(data.widget.order_tracking.tracking_button_text || DEFAULT_ORDER_TRACKING.tracking_button_text),
          }
        : { ...DEFAULT_ORDER_TRACKING },
  };
}

const OVER_TABS: { key: ActiveTab; label: string }[] = [
  { key: "widget", label: "Giao diện widget" },
  { key: "sales", label: "Giao diện bán hàng" },
];

const SUB_TABS_MAP: Record<ActiveTab, { key: ActiveSub; label: string; icon: string }[]> = {
  widget: [
    { key: "brand", label: "Thương hiệu", icon: "palette" },
    { key: "ai", label: "Năng lực AI", icon: "bolt" },
    { key: "embed", label: "Mã nhúng", icon: "integration_instructions" },
  ],
  sales: [
    { key: "form", label: "Form đặt hàng", icon: "list_alt" },
    { key: "payment", label: "Thanh toán", icon: "payments" },
    { key: "product", label: "Sản phẩm", icon: "inventory_2" },
    { key: "tracking", label: "Theo dõi đơn", icon: "local_shipping" },
  ],
};

const VALID_SUBS: ActiveSub[] = Object.values(SUB_TABS_MAP).flat().map((t) => t.key);

export default function SettingsPage() {
  const api = useApi();
  const { tenant, refreshTenant } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("widget");
  const [activeSub, setActiveSub] = useState<ActiveSub>("brand");
  const [formData, setFormData] = useState<SettingsFormData>({
    name: "",
    widget_welcome_message: "",
    widget_color: "#4F46E5",
    logo_url: "",
    widget_placeholder: "Nhập câu hỏi...",
    font_family: "sans",
    position: "bottom-right",
    system_prompt: "",
    is_sql_enabled: true,
    is_rag_enabled: true,
    product_layout: "card",
    show_stock: true,
    show_rating: false,
    action_mode: "lead",
    form_fields: [...DEFAULT_FORM_FIELDS],
    payment_methods: { ...DEFAULT_PAYMENT_METHODS },
    bank_info: null,
    order_tracking: { ...DEFAULT_ORDER_TRACKING },
  });
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");

  useEffect(() => {
    const tab = searchParams.get("tab");
    const sub = searchParams.get("sub");
    if (tab === "widget" || tab === "sales") {
      setActiveTab(tab);
    }
    if (sub && VALID_SUBS.includes(sub as ActiveSub)) {
      setActiveSub(sub as ActiveSub);
      // Tự đồng bộ over-tab theo sub-tab
      if (SUB_TABS_MAP.widget.some((s) => s.key === sub)) setActiveTab("widget");
      else if (SUB_TABS_MAP.sales.some((s) => s.key === sub)) setActiveTab("sales");
    }
  }, [searchParams]);

  useEffect(() => {
    async function fetchSettings() {
      if (tenant && tenant.widget && tenant.ai_settings) {
        const mapped = mapToFormData(tenant);
        setFormData(mapped);
        setSavedSnapshot(JSON.stringify(mapped));
        setIsLoading(false);
        return;
      }

      try {
        const data = await api.get("/api/v1/admin/me");
        const mapped = mapToFormData(data);
        setFormData(mapped);
        setSavedSnapshot(JSON.stringify(mapped));
      } catch (error) {
        console.error("Lỗi khi tải cấu hình:", error);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchSettings();
  }, [api, tenant]);

  const isDirty = useMemo(
    () => !!savedSnapshot && JSON.stringify(formData) !== savedSnapshot,
    [formData, savedSnapshot],
  );

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const handleSetTab = (tab: ActiveTab) => {
    const firstSub = SUB_TABS_MAP[tab][0].key;
    const next = new URLSearchParams();
    next.set("tab", tab);
    next.set("sub", firstSub);
    router.replace(`/dashboard/settings?${next.toString()}`);
  };

  const setSub = (sub: ActiveSub) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", activeTab);
    next.set("sub", sub);
    router.replace(`/dashboard/settings?${next.toString()}`);
  };

  const handleSave = async () => {
    const duplicate = formData.form_fields.some(
      (field, idx) => formData.form_fields.findIndex((item) => item.key === field.key) !== idx,
    );
    if (duplicate) {
      alert("Một số field trong form lead đang trùng key. Vui lòng sửa trước khi lưu.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        bot_name: formData.name,
        greeting: formData.widget_welcome_message,
        primary_color: formData.widget_color,
        logo_url: formData.logo_url,
        placeholder: formData.widget_placeholder,
        position: formData.position,
        font_family: formData.font_family,
        system_prompt: formData.system_prompt,
        is_sql_enabled: formData.is_sql_enabled,
        is_rag_enabled: formData.is_rag_enabled,
        product_layout: formData.product_layout,
        show_stock: formData.show_stock,
        show_rating: formData.show_rating,
        action_mode: formData.action_mode,
        form_fields: formData.form_fields,
        payment_methods: formData.payment_methods,
        bank_info: formData.payment_methods.bank_transfer ? formData.bank_info : null,
        order_tracking: formData.order_tracking,
      };

      await api.patch("/api/v1/admin/me", payload);
      await refreshTenant();
      setSavedSnapshot(JSON.stringify(formData));
      alert("Đã lưu tất cả thay đổi thành công!");
    } catch (error: any) {
      alert(`Lỗi khi lưu cấu hình: ${error.message || "Vui lòng kiểm tra lại kết nối."}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadAvatar = async (file: File) => {
    setIsUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.postFormData("/api/v1/admin/widget/avatar", form);
      const nextLogoUrl = typeof res?.logo_url === "string" ? res.logo_url : "";
      if (!nextLogoUrl) {
        throw new Error("Không nhận được URL avatar từ hệ thống.");
      }
      setFormData((prev) => ({ ...prev, logo_url: nextLogoUrl }));
    } catch (error: any) {
      alert(`Upload avatar thất bại: ${error.message || "Vui lòng thử lại."}`);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-100 rounded-full"></div>
            <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
            Đang đồng bộ dữ liệu...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Cấu hình Chatbot
          </h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium">
            Tùy chỉnh giao diện chatbot và giao diện bán hàng. Cấu hình kết nối
            WooCommerce/Shopify tại{" "}
            <Link href="/dashboard/widget-sales" className="text-indigo-600 font-semibold hover:underline">
              Widget bán hàng
            </Link>
            .
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="group relative flex items-center gap-2 bg-slate-900 hover:bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-xl shadow-slate-200 hover:shadow-indigo-200 transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              Đang lưu dữ liệu...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[20px] group-hover:rotate-12 transition-transform">
                save
              </span>
              Lưu tất cả thay đổi
            </>
          )}
        </button>
      </div>

      {/* Over-tabs */}
      <div className="flex flex-wrap gap-2 p-2 bg-slate-100 rounded-2xl">
        {OVER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleSetTab(tab.key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab.key
                ? "bg-white text-indigo-600 shadow"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2 p-2 bg-white rounded-2xl border border-slate-100">
        {SUB_TABS_MAP[activeTab].map((sub) => (
          <button
            key={sub.key}
            type="button"
            onClick={() => setSub(sub.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${
              activeSub === sub.key
                ? "bg-slate-900 text-white"
                : "bg-slate-50 text-slate-500 hover:text-slate-700"
            }`}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 16 }}
            >
              {sub.icon}
            </span>
            {sub.label}
          </button>
        ))}
      </div>

      {/* Layout: Preview LEFT, Config RIGHT */}
      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Live Preview — left column */}
        <div className="col-span-12 lg:col-span-5">
          <LivePreview formData={formData} activeSub={activeSub} />
        </div>

        {/* Config panels — right column */}
        <div className="col-span-12 lg:col-span-7 space-y-8">
          {activeSub === "brand" && (
            <BrandingSection
              formData={formData}
              setFormData={setFormData}
              onUploadAvatar={handleUploadAvatar}
              isUploadingAvatar={isUploadingAvatar}
            />
          )}
          {activeSub === "form" && (
            <FormFieldsPanel formData={formData} setFormData={setFormData} />
          )}
          {activeSub === "payment" && (
            <PaymentPanel formData={formData} setFormData={setFormData} />
          )}
          {activeSub === "product" && (
            <ProductPanel formData={formData} setFormData={setFormData} />
          )}
          {activeSub === "tracking" && (
            <OrderTrackingPanel formData={formData} setFormData={setFormData} />
          )}
          {activeSub === "ai" && (
            <AiSection formData={formData} setFormData={setFormData} />
          )}
          {activeSub === "embed" && (
            <EmbedSection formData={formData} publicKey={tenant?.public_key} />
          )}
        </div>
      </div>
    </div>
  );
}
