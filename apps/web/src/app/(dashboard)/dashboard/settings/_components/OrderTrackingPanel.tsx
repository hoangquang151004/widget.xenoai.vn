"use client";

import { SectionProps } from "./types";

export default function OrderTrackingPanel({ formData, setFormData }: SectionProps) {
  const t = formData.order_tracking;

  const toggle = (key: keyof typeof t) => {
    setFormData((prev) => ({
      ...prev,
      order_tracking: {
        ...prev.order_tracking,
        [key]: !prev.order_tracking[key],
      },
    }));
  };

  const updateText = (key: "delivery_estimate_text" | "success_message" | "tracking_button_text", value: string) => {
    setFormData((prev) => ({
      ...prev,
      order_tracking: {
        ...prev.order_tracking,
        [key]: value,
      },
    }));
  };

  return (
    <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/80 hover:border-indigo-100 transition-colors duration-500 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50/30 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-sky-100/50 transition-colors"></div>

      <div className="relative">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">local_shipping</span>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
              Theo dõi đơn hàng
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Tùy chỉnh giao diện xác nhận và theo dõi đơn trên widget
            </p>
          </div>
        </div>

        {/* Success message */}
        <div className="space-y-2 mb-6">
          <label className="text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500">
            Thông báo đặt hàng thành công
          </label>
          <input
            value={t.success_message}
            onChange={(e) => updateText("success_message", e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-sky-500/10 focus:border-sky-300 outline-none transition-all placeholder:text-slate-300"
            placeholder="Đặt hàng thành công! 🎉"
          />
        </div>

        {/* Toggles */}
        <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500 mb-3">
          Thông tin hiển thị
        </div>
        <div className="space-y-0 mb-6">
          {([
            { key: "show_order_summary" as const, label: "Hiển thị tóm tắt đơn hàng", desc: "Sản phẩm, size, số lượng, tổng tiền" },
            { key: "show_delivery_estimate" as const, label: "Hiển thị thời gian giao hàng dự kiến", desc: "VD: 24–48 giờ làm việc" },
            { key: "show_tracking_button" as const, label: "Nút theo dõi đơn hàng", desc: "Cho phép khách tra cứu trạng thái đơn" },
          ]).map((item) => {
            const active = !!t[item.key];
            return (
              <div
                key={item.key}
                className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-b-0"
              >
                <label className="relative w-[28px] h-[16px] shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggle(item.key)}
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
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] text-slate-800 block">{item.label}</span>
                  <span className="text-[10px] text-slate-400">{item.desc}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Delivery estimate text — only when toggle is on */}
        {t.show_delivery_estimate && (
          <div className="space-y-2 mb-6">
            <label className="text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500">
              Thời gian giao hàng dự kiến
            </label>
            <input
              value={t.delivery_estimate_text}
              onChange={(e) => updateText("delivery_estimate_text", e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-medium focus:ring-4 focus:ring-sky-500/10 focus:border-sky-300 outline-none transition-all placeholder:text-slate-300"
              placeholder="24–48 giờ làm việc"
            />
          </div>
        )}

        {/* Tracking button text — only when toggle is on */}
        {t.show_tracking_button && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500">
              Nội dung nút theo dõi
            </label>
            <input
              value={t.tracking_button_text}
              onChange={(e) => updateText("tracking_button_text", e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-medium focus:ring-4 focus:ring-sky-500/10 focus:border-sky-300 outline-none transition-all placeholder:text-slate-300"
              placeholder="Theo dõi đơn hàng"
            />
          </div>
        )}
      </div>
    </section>
  );
}
