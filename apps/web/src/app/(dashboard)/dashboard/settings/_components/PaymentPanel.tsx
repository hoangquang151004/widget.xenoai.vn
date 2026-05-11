"use client";

import { DEFAULT_BANK_INFO, SectionProps } from "./types";

const PAYMENT_OPTIONS: { key: "cod" | "bank_transfer" | "momo" | "vnpay"; icon: string; label: string }[] = [
  { key: "cod", icon: "💵", label: "COD · Thanh toán khi nhận" },
  { key: "bank_transfer", icon: "🏦", label: "Chuyển khoản ngân hàng" },
  { key: "momo", icon: "📱", label: "Ví MoMo" },
  { key: "vnpay", icon: "💳", label: "VNPay / Thẻ ngân hàng" },
];

export default function PaymentPanel({ formData, setFormData }: SectionProps) {
  const togglePaymentMethod = (key: "cod" | "bank_transfer" | "momo" | "vnpay") => {
    setFormData((prev) => ({
      ...prev,
      payment_methods: {
        ...prev.payment_methods,
        [key]: !prev.payment_methods[key],
      },
      bank_info:
        key === "bank_transfer" && !prev.payment_methods.bank_transfer
          ? prev.bank_info || { ...DEFAULT_BANK_INFO }
          : prev.bank_info,
    }));
  };

  return (
    <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/80 hover:border-indigo-100 transition-colors duration-500 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/30 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-100/50 transition-colors"></div>

      <div className="relative">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">payments</span>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
              Thanh toán
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Bật/tắt phương thức thanh toán cho khách hàng
            </p>
          </div>
        </div>

        {/* Payment toggles — compact style like v2 */}
        <div className="space-y-[5px] mb-6">
          {PAYMENT_OPTIONS.map((opt) => {
            const active = formData.payment_methods[opt.key];
            return (
              <div
                key={opt.key}
                className="flex items-center gap-2 px-3 py-[9px] rounded-lg bg-slate-50"
              >
                <div className="w-[26px] h-[26px] rounded-[5px] flex items-center justify-center text-[13px] bg-white shadow-sm shrink-0">
                  {opt.icon}
                </div>
                <span className="text-[12px] text-slate-800 flex-1">{opt.label}</span>
                <label className="relative w-[28px] h-[16px] shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => togglePaymentMethod(opt.key)}
                    className="opacity-0 w-0 h-0 absolute"
                  />
                  <div
                    className="absolute inset-0 rounded-full transition-colors duration-200"
                    style={{ background: active ? formData.widget_color : "#cbd5e1" }}
                  >
                    <div
                      className="absolute top-[2px] w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-200"
                      style={{ left: active ? "14px" : "2px" }}
                    />
                  </div>
                </label>
              </div>
            );
          })}
        </div>

        {/* Bank info — only when bank_transfer is on */}
        {formData.payment_methods.bank_transfer && (
          <div className="space-y-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500 mt-2">
              Thông tin chuyển khoản
            </div>
            <div className="border border-slate-100 rounded-lg p-4 space-y-3">
              {[
                { key: "bank_name" as const, label: "Ngân hàng" },
                { key: "account_number" as const, label: "Số tài khoản" },
                { key: "account_name" as const, label: "Tên tài khoản" },
              ].map((item) => (
                <div
                  key={item.key}
                  className="grid gap-2"
                  style={{ gridTemplateColumns: "80px 1fr" }}
                >
                  <span className="text-[10px] text-slate-500 pt-1">{item.label}</span>
                  <input
                    value={formData.bank_info?.[item.key] ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        bank_info: {
                          ...(prev.bank_info || { ...DEFAULT_BANK_INFO }),
                          [item.key]: e.target.value,
                        },
                      }))
                    }
                    className="w-full text-[11px] border-b border-slate-200 bg-transparent text-slate-800 py-1 px-0 focus:border-indigo-400 outline-none transition-colors"
                  />
                </div>
              ))}
              <div className="grid gap-2" style={{ gridTemplateColumns: "80px 1fr" }}>
                <span className="text-[10px] text-slate-500 pt-1">QR URL</span>
                <input
                  value={formData.bank_info?.qr_url ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      bank_info: {
                        ...(prev.bank_info || { ...DEFAULT_BANK_INFO }),
                        qr_url: e.target.value,
                      },
                    }))
                  }
                  placeholder="(tùy chọn)"
                  className="w-full text-[11px] border-b border-slate-200 bg-transparent text-slate-800 py-1 px-0 focus:border-indigo-400 outline-none transition-colors placeholder:text-slate-300"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
