"use client";

import { useEffect, useState } from "react";
import { SettingsFormData } from "./types";

/* eslint-disable @next/next/no-img-element */

type Props = {
  formData: SettingsFormData;
  activeSub: string;
};

const STEPS = ["Sản phẩm", "Giỏ hàng", "Thông tin", "Thanh toán", "Xác nhận"];

/** Map sub-tab → step mặc định trong preview */
const SUB_TO_STEP: Record<string, number> = {
  product: 0,
  form: 2,
  payment: 3,
  tracking: 4,
};

const PAYS: Record<string, { icon: string; label: string }> = {
  cod: { icon: "💵", label: "COD · Thanh toán khi nhận" },
  bank_transfer: { icon: "🏦", label: "Chuyển khoản ngân hàng" },
  momo: { icon: "📱", label: "Ví MoMo" },
  vnpay: { icon: "💳", label: "VNPay / Thẻ ngân hàng" },
};

/* ── bubble styles ─────────────────────────────── */
const mbStyle: React.CSSProperties = {
  fontSize: 11,
  lineHeight: 1.45,
  padding: "6px 8px",
  background: "#f1f5f9",
  borderRadius: "3px 9px 9px 9px",
  color: "#1e293b",
  maxWidth: "88%",
  alignSelf: "flex-start",
};

const muBaseStyle: React.CSSProperties = {
  fontSize: 11,
  lineHeight: 1.45,
  padding: "6px 8px",
  borderRadius: "9px 3px 9px 9px",
  color: "#fff",
  maxWidth: "80%",
  alignSelf: "flex-end",
};

/* ── step renderers ────────────────────────────── */

function StepProduct({ fd }: { fd: SettingsFormData }) {
  const isCard = fd.product_layout === "card";
  const ctaLabel =
    fd.action_mode === "link"
      ? "Xem sản phẩm ↗"
      : fd.action_mode === "direct"
        ? "Mua ngay →"
        : "Thêm vào giỏ →";
  const ctaLabelShort =
    fd.action_mode === "link"
      ? "Xem ↗"
      : fd.action_mode === "direct"
        ? "Mua"
        : "Chọn";
  const stock = fd.show_stock ? (
    <div className="text-[9px] text-emerald-600 font-medium">
      Còn hàng · 45 sản phẩm
    </div>
  ) : null;
  const rating = fd.show_rating ? (
    <div className="text-[9px] text-amber-600">★★★★☆ 4.2 (128)</div>
  ) : null;

  if (isCard) {
    return (
      <>
        <div style={mbStyle}>Tìm thấy sản phẩm phù hợp 👇</div>
        <div className="rounded-[10px] border border-slate-200 overflow-hidden self-start w-full">
          <div className="h-[72px] bg-slate-100 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="3" y="3" width="26" height="26" rx="4" fill="#ddd" />
              <circle cx="11" cy="11" r="3" fill="#bbb" />
              <path d="M3 22l8-6 5 4 4-3 9 7" fill="#e5e7eb" />
            </svg>
          </div>
          <div className="p-2">
            <div className="text-[11px] font-medium text-slate-800 mb-0.5">
              Áo thun Premium Cotton
            </div>
            {rating}
            {stock}
            <div className="text-[13px] font-medium mt-1" style={{ color: fd.widget_color }}>
              249.000đ
            </div>
            <div className="text-[9px] text-slate-500 mt-1 mb-0.5">Kích thước:</div>
            <div className="flex gap-[3px] flex-wrap">
              {["S", "M", "L", "XL"].map((s, i) => (
                <span
                  key={s}
                  className="text-[9px] px-[7px] py-[2px] rounded-lg border"
                  style={
                    i === 1
                      ? { background: fd.widget_color, color: "#fff", borderColor: "transparent" }
                      : { borderColor: "#ddd", color: "#777" }
                  }
                >
                  {s}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-[5px] mt-1">
              <button className="w-[18px] h-[18px] rounded border border-slate-200 text-[12px] flex items-center justify-center bg-transparent text-slate-700 leading-none">
                −
              </button>
              <span className="text-[11px] font-medium text-slate-800 min-w-[14px] text-center">
                1
              </span>
              <button className="w-[18px] h-[18px] rounded border border-slate-200 text-[12px] flex items-center justify-center bg-transparent text-slate-700 leading-none">
                +
              </button>
              <span className="text-[9px] text-slate-500 ml-1">cái</span>
            </div>
            <button
              className="w-full py-[5px] rounded-lg text-[11px] font-medium text-white mt-[5px] border-none cursor-pointer"
              style={{ background: fd.widget_color }}
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      </>
    );
  }

  /* list layout */
  const items = [
    { name: "Áo thun Premium Cotton", price: "249k" },
    { name: "Áo thun Basic Slim", price: "189k" },
    { name: "Áo polo Classic", price: "319k" },
  ];
  return (
    <>
      <div style={mbStyle}>Tìm thấy 3 sản phẩm:</div>
      <div className="rounded-[10px] border border-slate-200 overflow-hidden self-start w-full">
        <div className="p-[7px]">
          {items.map((it, i) => (
            <div
              key={i}
              className="flex gap-[7px] items-center py-[5px]"
              style={i < 2 ? { borderBottom: "0.5px solid #e5e7eb" } : undefined}
            >
              <div className="w-[34px] h-[34px] rounded-[5px] bg-slate-100 shrink-0 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="1" width="14" height="14" rx="2" fill="#ddd" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium text-slate-800">{it.name}</div>
                {fd.show_rating && (
                  <div className="text-[8px] text-amber-600">★★★★☆ 4.2</div>
                )}
                {fd.show_stock && (
                  <div className="text-[8px] text-emerald-600">Còn hàng</div>
                )}
                <div className="text-[10px] font-medium" style={{ color: fd.widget_color }}>
                  {it.price}
                </div>
              </div>
              <button
                className="text-[9px] px-[7px] py-[3px] rounded-[5px] border font-medium bg-transparent cursor-pointer"
                style={{ color: fd.widget_color, borderColor: fd.widget_color }}
              >
                {ctaLabelShort}
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function StepCart({ fd }: { fd: SettingsFormData }) {
  return (
    <>
      <div style={{ ...muBaseStyle, background: fd.widget_color }}>
        Cho tôi cái size M đó
      </div>
      <div style={mbStyle}>Giỏ hàng của bạn:</div>
      <div className="rounded-[10px] border border-slate-200 overflow-hidden self-start w-full">
        <div className="p-2">
          <div className="flex justify-between items-center py-1 border-b border-slate-100 text-[10px] text-slate-800">
            <span>Áo thun Premium – M × 1</span>
            <span className="font-medium">249.000đ</span>
          </div>
          <div className="flex justify-between text-[11px] font-medium pt-[5px] pb-[2px] text-slate-800">
            <span>Tổng cộng</span>
            <span style={{ color: fd.widget_color }}>249.000đ</span>
          </div>
          <div className="flex gap-[5px] mt-1">
            <button className="flex-1 py-[5px] rounded-lg text-[10px] border border-slate-200 bg-transparent text-slate-500 cursor-pointer">
              Tiếp tục mua
            </button>
            <button
              className="flex-1 py-[5px] rounded-lg text-[11px] font-medium text-white border-none cursor-pointer"
              style={{ background: fd.widget_color }}
            >
              Đặt hàng →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function StepForm({ fd }: { fd: SettingsFormData }) {
  const active = fd.form_fields.filter((f) => f.enabled);
  if (!active.length) {
    return <div style={mbStyle}>Bạn chưa bật trường nào trong Form đặt hàng.</div>;
  }
  return (
    <>
      <div style={mbStyle}>Điền thông tin giao hàng nhé:</div>
      <div className="rounded-[10px] border border-slate-200 overflow-hidden self-start w-full">
        <div className="p-2 space-y-[5px]">
          {active.map((f) => (
            <div key={f.key}>
              <div className="text-[9px] text-slate-500 mb-[2px] flex gap-[3px] items-center">
                {f.label}
                {f.required && (
                  <span className="text-[8px] px-1 rounded bg-red-50 text-red-700">
                    Bắt buộc
                  </span>
                )}
              </div>
              <div className="w-full text-[10px] py-[3px] px-[6px] border border-slate-200 rounded-[5px] bg-slate-50 text-slate-400 truncate">
                {f.label}...
              </div>
            </div>
          ))}
          <button
            className="w-full py-[5px] rounded-lg text-[11px] font-medium text-white mt-[6px] border-none cursor-pointer"
            style={{ background: fd.widget_color }}
          >
            Tiếp tục →
          </button>
        </div>
      </div>
    </>
  );
}

function StepPay({ fd }: { fd: SettingsFormData }) {
  const active = Object.entries(fd.payment_methods).filter(([, v]) => v);
  if (!active.length) {
    return <div style={mbStyle}>Chưa bật phương thức thanh toán nào.</div>;
  }
  return (
    <>
      <div style={mbStyle}>Chọn cách thanh toán:</div>
      <div className="rounded-[10px] border border-slate-200 overflow-hidden self-start w-full">
        <div className="p-2 space-y-1">
          {active.map(([k], i) => {
            const pay = PAYS[k];
            if (!pay) return null;
            const selected = i === 0;
            return (
              <div
                key={k}
                className="flex items-center gap-[6px] rounded-lg border"
                style={{
                  padding: "6px 8px",
                  borderColor: selected ? fd.widget_color : "#e2e8f0",
                  borderWidth: selected ? "1.5px" : "0.5px",
                }}
              >
                <div
                  className="w-[11px] h-[11px] rounded-full flex items-center justify-center shrink-0"
                  style={{
                    borderWidth: "1.5px",
                    borderStyle: "solid",
                    borderColor: selected ? fd.widget_color : "#cbd5e1",
                  }}
                >
                  {selected && (
                    <div
                      className="w-[5px] h-[5px] rounded-full"
                      style={{ background: fd.widget_color }}
                    />
                  )}
                </div>
                <span className="text-[13px]">{pay.icon}</span>
                <span className="text-[10px] text-slate-800">{pay.label}</span>
              </div>
            );
          })}
          <button
            className="w-full py-[5px] rounded-lg text-[11px] font-medium text-white mt-1 border-none cursor-pointer"
            style={{ background: fd.widget_color }}
          >
            Xác nhận đặt hàng →
          </button>
        </div>
      </div>
    </>
  );
}

function StepConfirm({ fd }: { fd: SettingsFormData }) {
  const t = fd.order_tracking;
  return (
    <>
      <div style={{ ...muBaseStyle, background: fd.widget_color }}>Xác nhận</div>
      <div style={mbStyle}>{t.success_message}</div>
      <div className="bg-slate-50 rounded-lg p-2 text-[10px] text-slate-800 leading-[1.7] w-full">
        <div className="text-[13px] mb-1">✓</div>
        <div className="font-medium text-[11px] mb-[6px]">
          Mã đơn: <span style={{ color: fd.widget_color }}>#8821</span>
        </div>
        {t.show_order_summary && (
          <div className="text-[10px] text-slate-500 text-left" style={{ lineHeight: 1.8 }}>
            Áo thun Premium – M × 1
            <br />
            Tổng: 249.000đ
          </div>
        )}
        {t.show_delivery_estimate && (
          <div className="text-[10px] text-slate-500 mt-1">
            Dự kiến giao: {t.delivery_estimate_text}
          </div>
        )}
        {t.show_tracking_button && (
          <button
            className="w-full py-[5px] rounded-lg text-[10px] font-medium text-white mt-2 border-none cursor-pointer"
            style={{ background: fd.widget_color }}
          >
            {t.tracking_button_text}
          </button>
        )}
      </div>
    </>
  );
}

/* ── main component ────────────────────────────── */

export default function LivePreview({ formData, activeSub }: Props) {
  const [step, setStep] = useState(0);
  const [isOpen, setIsOpen] = useState(true);

  /* Auto-sync step khi chuyển sub-tab */
  useEffect(() => {
    const mapped = SUB_TO_STEP[activeSub];
    if (mapped !== undefined) {
      setStep(mapped);
    }
  }, [activeSub]);

  const showSalesPreview = ["form", "payment", "product", "tracking"].includes(activeSub);

  const renderStep = () => {
    if (!showSalesPreview) return null;
    switch (step) {
      case 0:
        return <StepProduct fd={formData} />;
      case 1:
        return <StepCart fd={formData} />;
      case 2:
        return <StepForm fd={formData} />;
      case 3:
        return <StepPay fd={formData} />;
      case 4:
        return <StepConfirm fd={formData} />;
      default:
        return null;
    }
  };

  const fontClass = formData.font_family === "serif" ? "font-serif" : "font-sans";
  const isRight = formData.position !== "bottom-left";

  return (
    <div className="sticky top-28 space-y-4">
      {/* header */}
      <div className="flex items-center justify-between px-1">
        <h4 className="text-[9px] font-bold uppercase tracking-[0.07em] text-slate-400">
          Live preview
        </h4>
        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-tight">Real-time</span>
        </div>
      </div>

      {/* Simulated website viewport */}
      <div className="relative bg-slate-50 border-2 border-slate-200 rounded-[20px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.08)]" style={{ minHeight: 540 }}>
        {/* Fake browser bar */}
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

        {/* Fake page content */}
        <div className="px-4 pt-5 pb-2">
          <div className="h-3 w-3/4 bg-slate-200 rounded mb-2" />
          <div className="h-2 w-full bg-slate-100 rounded mb-1.5" />
          <div className="h-2 w-5/6 bg-slate-100 rounded mb-1.5" />
          <div className="h-2 w-2/3 bg-slate-100 rounded mb-4" />
          <div className="h-[60px] bg-slate-100 rounded-lg mb-3" />
          <div className="h-2 w-full bg-slate-100 rounded mb-1.5" />
          <div className="h-2 w-4/5 bg-slate-100 rounded" />
        </div>

        {/* Chat window — positioned based on formData.position */}
        <div
          className="absolute transition-all duration-300 ease-out"
          style={{
            bottom: 56,
            ...(isRight ? { right: 8 } : { left: 8 }),
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? "translateY(0) scale(1)" : "translateY(12px) scale(0.95)",
            pointerEvents: isOpen ? "auto" : "none",
          }}
        >
          <div className="w-[230px] border border-slate-200 rounded-[18px] overflow-hidden bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            {/* chat header */}
            <div
              className="px-2.5 py-[6px] flex items-center gap-1.5 border-b border-white/20"
              style={{ background: formData.widget_color }}
            >
              {formData.logo_url ? (
                <img
                  src={formData.logo_url}
                  alt="avatar"
                  className="w-[18px] h-[18px] rounded-full object-cover shrink-0 border border-white/30"
                />
              ) : (
                <div className="w-[18px] h-[18px] rounded-full bg-white/20 shrink-0 flex items-center justify-center">
                  <span className="text-[8px] text-white/80">🤖</span>
                </div>
              )}
              <span className={`text-[11px] font-semibold text-white truncate flex-1 ${fontClass}`}>
                {formData.name || "AI Assistant"}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="w-[16px] h-[16px] rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center text-white border-none cursor-pointer transition-colors shrink-0"
              >
                <svg width="8" height="8" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M9.17 3.53L7.71 2.07 6 3.78 4.29 2.07 2.83 3.53 4.54 5.24 2.83 6.95l1.46 1.46L6 6.7l1.71 1.71 1.46-1.46-1.71-1.71z" />
                </svg>
              </button>
            </div>

            {/* messages */}
            <div
              className={`px-2 py-1.5 flex flex-col gap-[5px] overflow-y-auto ${fontClass}`}
              style={{ minHeight: 200, maxHeight: 280 }}
            >
              <div style={{ ...mbStyle, fontSize: 10, padding: "4px 7px" }}>
                {formData.widget_welcome_message}
              </div>

              {renderStep()}

              {!showSalesPreview && (
                <>
                  <div style={{ ...muBaseStyle, background: formData.widget_color, fontSize: 10, padding: "4px 7px" }}>
                    Hỏi về sản phẩm
                  </div>
                  <div style={{ ...mbStyle, fontSize: 10, padding: "4px 7px" }}>
                    Tôi có thể giúp bạn tìm sản phẩm phù hợp. Bạn cần gì?
                  </div>
                </>
              )}
            </div>

            {/* step dots — sales */}
            {showSalesPreview && (
              <>
                <div className="text-center py-[1px]">
                  <span className="text-[8px] text-slate-400">{STEPS[step]}</span>
                </div>
                <div className="flex justify-center gap-[4px] py-[4px] border-t border-slate-100">
                  {STEPS.map((label, i) => (
                    <button
                      key={i}
                      title={label}
                      onClick={() => setStep(i)}
                      className="w-[6px] h-[6px] rounded-full border-none p-0 cursor-pointer transition-colors duration-200"
                      style={{
                        background: i === step ? formData.widget_color : "#d1d5db",
                      }}
                    />
                  ))}
                </div>
              </>
            )}

            {/* input bar */}
            {!showSalesPreview && (
              <div className="flex items-center gap-1.5 p-1.5 border-t border-slate-100">
                <div className="flex-1 bg-slate-50 rounded-md px-2 py-1.5">
                  <span className="text-[9px] text-slate-400 italic truncate block">
                    {formData.widget_placeholder}
                  </span>
                </div>
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white shrink-0"
                  style={{ background: formData.widget_color }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FAB — floating action button */}
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="absolute transition-all duration-300 ease-out border-none cursor-pointer group/fab"
          style={{
            bottom: 12,
            ...(isRight ? { right: 12 } : { left: 12 }),
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: formData.widget_color,
            boxShadow: `0 4px 14px ${formData.widget_color}55`,
          }}
        >
          <div className="w-full h-full flex items-center justify-center text-white transition-transform duration-300"
            style={{ transform: isOpen ? "rotate(0deg)" : "rotate(0deg)" }}
          >
            {isOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
              </svg>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
