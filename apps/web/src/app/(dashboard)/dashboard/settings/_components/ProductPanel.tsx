"use client";

import { SectionProps } from "./types";

export default function ProductPanel({ formData, setFormData }: SectionProps) {
  return (
    <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/80 hover:border-indigo-100 transition-colors duration-500 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50/30 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-purple-100/50 transition-colors"></div>

      <div className="relative">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">inventory_2</span>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
              Sản phẩm
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Bố cục và thông tin hiển thị sản phẩm trong widget
            </p>
          </div>
        </div>

        {/* Layout options — card vs list with SVG icons like v2 */}
        <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500 mb-3">
          Bố cục hiển thị
        </div>
        <div className="flex gap-3 mb-8">
          {([
            {
              key: "card" as const,
              label: "Card · ảnh lớn",
              svg: (
                <svg width="44" height="30" viewBox="0 0 44 30" fill="none">
                  <rect x="1" y="1" width="42" height="28" rx="3" stroke="#cbd5e1" strokeWidth="1" />
                  <rect x="4" y="4" width="36" height="13" rx="2" fill="#f1f5f9" />
                  <rect x="4" y="20" width="20" height="2" rx="1" fill="#cbd5e1" />
                  <rect x="4" y="24" width="12" height="2" rx="1" fill="#e2e8f0" />
                </svg>
              ),
            },
            {
              key: "list" as const,
              label: "List · ảnh nhỏ",
              svg: (
                <svg width="44" height="30" viewBox="0 0 44 30" fill="none">
                  <rect x="1" y="1" width="42" height="28" rx="3" stroke="#cbd5e1" strokeWidth="1" />
                  <rect x="4" y="5" width="9" height="8" rx="1" fill="#f1f5f9" />
                  <rect x="16" y="5" width="18" height="2" rx="1" fill="#cbd5e1" />
                  <rect x="16" y="9" width="12" height="2" rx="1" fill="#e2e8f0" />
                  <line x1="4" y1="17" x2="40" y2="17" stroke="#e2e8f0" strokeWidth="0.5" />
                  <rect x="4" y="20" width="9" height="8" rx="1" fill="#f1f5f9" />
                  <rect x="16" y="20" width="18" height="2" rx="1" fill="#cbd5e1" />
                  <rect x="16" y="24" width="12" height="2" rx="1" fill="#e2e8f0" />
                </svg>
              ),
            },
          ]).map((opt) => {
            const active = formData.product_layout === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, product_layout: opt.key }))}
                className="flex-1 flex flex-col items-center gap-2 rounded-xl py-3 px-4 cursor-pointer transition-all border"
                style={{
                  borderColor: active ? formData.widget_color : "#e2e8f0",
                  borderWidth: active ? "1.5px" : "0.5px",
                  background: "transparent",
                }}
              >
                {opt.svg}
                <span className="text-[10px] text-slate-500">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Display info toggles */}
        <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500 mb-3">
          Thông tin hiển thị
        </div>
        <div className="space-y-0">
          {([
            { key: "show_stock" as const, label: "Trạng thái tồn kho" },
            { key: "show_rating" as const, label: "Điểm đánh giá" },
          ]).map((item) => {
            const active = formData[item.key];
            return (
              <div
                key={item.key}
                className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-b-0"
              >
                <label className="relative w-[28px] h-[16px] shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() =>
                      setFormData((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                    }
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
                <span className="text-[12px] text-slate-800">{item.label}</span>
              </div>
            );
          })}
        </div>

        {/* CTA action mode */}
        <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500 mt-8 mb-3">
          Hành động CTA
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { key: "lead", label: "Thu lead", hint: "Hiện form để lấy thông tin khách." },
            { key: "link", label: "Đi đến sản phẩm", hint: "Mở link sản phẩm bên ngoài." },
            { key: "direct", label: "Đặt trực tiếp", hint: "Đi thẳng luồng tạo đơn." },
          ].map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  action_mode: action.key as "lead" | "link" | "direct",
                }))
              }
              className={`p-4 rounded-2xl text-left border transition-all ${
                formData.action_mode === action.key
                  ? "bg-indigo-600 text-white border-indigo-600 shadow"
                  : "bg-slate-50 text-slate-600 border-slate-100 hover:border-slate-300"
              }`}
            >
              <div className="text-sm font-black">{action.label}</div>
              <div className={`text-[11px] mt-1 ${formData.action_mode === action.key ? "text-white/80" : "text-slate-400"}`}>
                {action.hint}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
