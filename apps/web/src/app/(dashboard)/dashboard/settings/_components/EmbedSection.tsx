"use client";

import { useState } from "react";
import { SettingsFormData } from "./types";

type Props = {
  formData: SettingsFormData;
  publicKey: string | null | undefined;
};

export default function EmbedSection({ formData, publicKey }: Props) {
  const [copied, setCopied] = useState(false);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
  const code = `<script
  src="${apiUrl}/sdk/widget.js"
  data-public-key="${publicKey || "pk_live_..."}"
  data-api-url="${apiUrl}"
  data-bot-name="${formData.name}"
  data-color="${formData.widget_color}"
  data-placeholder="${formData.widget_placeholder}"
  data-position="${formData.position}"
></script>`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback nếu clipboard API không khả dụng
      alert("Không sao chép được, vui lòng chọn thủ công.");
    }
  };

  return (
    <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/80 hover:border-indigo-100 transition-colors duration-500 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-100/50 transition-colors"></div>

      <div className="relative">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">
              integration_instructions
            </span>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
              Mã nhúng Website
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Tích hợp chatbot chuyên nghiệp vào website của bạn
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="relative group/code">
            <div className="absolute top-4 right-4 z-10">
              <button
                type="button"
                onClick={onCopy}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-indigo-500/50 active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">
                  {copied ? "check" : "content_copy"}
                </span>
                {copied ? "Đã sao chép" : "Sao chép mã"}
              </button>
            </div>

            <div className="bg-slate-900 rounded-[2rem] p-8 pt-12 border border-slate-800 shadow-2xl font-mono text-[12px] leading-relaxed text-slate-300 overflow-hidden relative">
              <div className="absolute top-5 left-6 flex gap-1.5 opacity-40">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
              </div>

              <div className="space-y-1">
                <p>
                  <span className="text-pink-400">&lt;script</span>
                </p>
                <p className="pl-6">
                  <span className="text-indigo-400">src</span>=
                  <span className="text-emerald-400">{`"${apiUrl}/sdk/widget.js"`}</span>
                </p>
                <p className="pl-6">
                  <span className="text-indigo-400">data-public-key</span>=
                  <span className="text-emerald-400">{`"${publicKey || "pk_live_..."}"`}</span>
                </p>
                <p className="pl-6">
                  <span className="text-indigo-400">data-api-url</span>=
                  <span className="text-emerald-400">{`"${apiUrl}"`}</span>
                </p>
                <p className="pl-6">
                  <span className="text-indigo-400">data-bot-name</span>=
                  <span className="text-emerald-400">{`"${formData.name}"`}</span>
                </p>
                <p className="pl-6">
                  <span className="text-indigo-400">data-color</span>=
                  <span className="text-emerald-400">{`"${formData.widget_color}"`}</span>
                </p>
                <p className="pl-6">
                  <span className="text-indigo-400">data-placeholder</span>=
                  <span className="text-emerald-400">{`"${formData.widget_placeholder}"`}</span>
                </p>
                <p className="pl-6">
                  <span className="text-indigo-400">data-position</span>=
                  <span className="text-emerald-400">{`"${formData.position}"`}</span>
                </p>
                <p>
                  <span className="text-pink-400">&gt;&lt;/script&gt;</span>
                </p>
              </div>

              <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-slate-900 to-transparent pointer-events-none"></div>
            </div>
          </div>

          <div className="bg-indigo-50/50 rounded-[1.5rem] p-5 border border-indigo-100 flex items-start gap-4">
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-indigo-600">
                tips_and_updates
              </span>
            </div>
            <div>
              <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
                Vị trí cài đặt tối ưu
              </p>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                Sao chép và dán đoạn mã này vào phía trước thẻ đóng{" "}
                <code className="text-indigo-600 font-bold">
                  &lt;/head&gt;
                </code>{" "}
                của trang web. Chatbot sẽ tự động được khởi tạo với màu sắc và
                cấu hình AI bạn đã thiết lập ở trên.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
