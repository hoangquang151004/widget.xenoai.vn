"use client";

import Image from "next/image";
import { COLOR_PRESETS, SectionProps } from "./types";

export default function BrandingSection({
  formData,
  setFormData,
  onUploadAvatar,
  isUploadingAvatar = false,
}: SectionProps) {
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/80 hover:border-indigo-100 transition-colors duration-500 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-100/50 transition-colors"></div>

      <div className="relative">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">palette</span>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
              Thương hiệu & Giao diện
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Định hình cách chatbot xuất hiện trước khách hàng
            </p>
          </div>
        </div>

        <div className="mb-8 flex flex-col md:flex-row items-center gap-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
          <div className="relative group/avatar">
            <div className="w-24 h-24 rounded-[2rem] bg-white shadow-md border-2 border-white overflow-hidden flex items-center justify-center group-hover/avatar:border-indigo-400 transition-all">
              {formData.logo_url ? (
                <Image
                  src={formData.logo_url}
                  alt="Avatar"
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="material-symbols-outlined text-4xl text-slate-200">
                  smart_toy
                </span>
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-sm font-bold">
                link
              </span>
            </div>
          </div>
          <div className="flex-1 space-y-2 w-full">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1 block">
              URL Ảnh đại diện (Avatar URL)
            </label>
            <input
              id="logo_url"
              value={formData.logo_url}
              onChange={handleChange}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 outline-none transition-all placeholder:text-slate-300 shadow-sm"
              placeholder="https://example.com/avatar.png"
            />
            <p className="text-[10px] text-slate-400 italic px-1">
              Gợi ý: Sử dụng ảnh vuông (1:1) để hiển thị đẹp nhất.
            </p>
            <div className="pt-1">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-sm">upload</span>
                {isUploadingAvatar ? "Đang tải ảnh..." : "Tải ảnh từ máy"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={isUploadingAvatar || !onUploadAvatar}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !onUploadAvatar) return;
                    await onUploadAvatar(file);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1 block">
              Tên hiển thị
            </label>
            <input
              id="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 outline-none transition-all placeholder:text-slate-300"
              placeholder="VD: AI Support"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1 block">
              Màu sắc chủ đạo
            </label>
            {/* Color swatches preset */}
            <div className="flex items-center gap-[6px] mb-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, widget_color: c }))
                  }
                  className="w-[28px] h-[28px] rounded-lg cursor-pointer transition-all duration-150 shrink-0"
                  style={{
                    background: c,
                    border:
                      formData.widget_color === c
                        ? "2.5px solid #1e293b"
                        : "2.5px solid transparent",
                    boxShadow:
                      formData.widget_color === c
                        ? "0 0 0 2px rgba(255,255,255,1), 0 2px 8px rgba(0,0,0,0.15)"
                        : "none",
                  }}
                  title={c}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative group/color">
                <input
                  type="color"
                  value={formData.widget_color}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      widget_color: e.target.value,
                    }))
                  }
                  className="w-14 h-[52px] rounded-2xl cursor-pointer border-0 p-0 overflow-hidden shadow-sm"
                />
                <div className="absolute inset-0 rounded-2xl ring-2 ring-inset ring-black/5 pointer-events-none"></div>
              </div>
              <div className="flex-1 bg-slate-50 rounded-2xl px-4 py-4 flex items-center justify-between border border-slate-100">
                <code className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                  {formData.widget_color}
                </code>
                <span className="material-symbols-outlined text-slate-400 text-lg">
                  colorize
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1 block">
              Lời chào mừng (Welcome)
            </label>
            <input
              id="widget_welcome_message"
              value={formData.widget_welcome_message}
              onChange={handleChange}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 outline-none transition-all"
              placeholder="Xin chào! Tôi có thể giúp gì cho bạn?"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1 block">
              Ô nhập câu hỏi (Placeholder)
            </label>
            <input
              id="widget_placeholder"
              value={formData.widget_placeholder}
              onChange={handleChange}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 outline-none transition-all"
              placeholder="Nhập câu hỏi của bạn..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1 block">
                Bộ chữ (Font family)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["sans", "serif"] as const).map((option) => {
                  const active = formData.font_family === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          font_family: option,
                        }))
                      }
                      className={`px-4 py-3 rounded-2xl text-sm font-bold border transition-all ${
                        active
                          ? "bg-slate-900 text-white border-slate-900 shadow"
                          : "bg-slate-50 text-slate-600 border-slate-100 hover:border-slate-300"
                      } ${option === "sans" ? "font-sans" : "font-serif"}`}
                    >
                      {option === "sans" ? "Sans-serif" : "Serif"}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1 block">
                Vị trí widget
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["bottom-right", "bottom-left"] as const).map((option) => {
                  const active = formData.position === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, position: option }))
                      }
                      className={`px-4 py-3 rounded-2xl text-sm font-bold border transition-all ${
                        active
                          ? "bg-slate-900 text-white border-slate-900 shadow"
                          : "bg-slate-50 text-slate-600 border-slate-100 hover:border-slate-300"
                      }`}
                    >
                      {option === "bottom-right" ? "Phải dưới" : "Trái dưới"}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
