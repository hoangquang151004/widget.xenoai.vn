"use client";

import { SectionProps } from "./types";

export default function AiSection({ formData, setFormData }: SectionProps) {
  const toggleSwitch = (key: "is_sql_enabled" | "is_rag_enabled") => {
    setFormData((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/80">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">bolt</span>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
              Năng lực AI (Agents)
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Bật/tắt các kỹ năng chuyên sâu của trợ lý
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              id: "is_rag_enabled" as const,
              label: "Kiến thức RAG",
              desc: "Tra cứu tài liệu Knowledge Base",
              icon: "menu_book",
              active: formData.is_rag_enabled,
            },
            {
              id: "is_sql_enabled" as const,
              label: "Phân tích SQL",
              desc: "Truy vấn dữ liệu từ Database",
              icon: "database",
              active: formData.is_sql_enabled,
            },
          ].map((cap) => (
            <button
              key={cap.id}
              type="button"
              onClick={() => toggleSwitch(cap.id)}
              className={`relative flex items-center gap-4 p-5 rounded-[1.8rem] border transition-all duration-300 text-left group
                ${
                  cap.active
                    ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200"
                    : "bg-slate-50 border-slate-100 text-slate-700 hover:border-slate-300"
                }`}
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors
                ${cap.active ? "bg-white/10" : "bg-white shadow-sm"}`}
              >
                <span
                  className={`material-symbols-outlined text-xl ${cap.active ? "text-white" : "text-slate-500"}`}
                >
                  {cap.icon}
                </span>
              </div>
              <div className="flex-1">
                <p
                  className={`text-sm font-black ${cap.active ? "text-white" : "text-slate-800"}`}
                >
                  {cap.label}
                </p>
                <p
                  className={`text-[10px] font-medium leading-tight mt-0.5 ${cap.active ? "text-white/60" : "text-slate-400"}`}
                >
                  {cap.desc}
                </p>
              </div>
              <div
                className={`w-10 h-6 rounded-full relative transition-colors duration-500 ${cap.active ? "bg-indigo-500" : "bg-slate-200"}`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 
                  ${cap.active ? "left-5" : "left-1"}`}
                ></div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/80">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">psychology</span>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
              Cốt lõi & Tính cách
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Quy định cách bot suy nghĩ và phản hồi (System Prompt)
            </p>
          </div>
        </div>

        <div className="relative group">
          <textarea
            id="system_prompt"
            value={formData.system_prompt}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, system_prompt: e.target.value }))
            }
            rows={8}
            className="w-full bg-slate-50 border border-slate-100 rounded-[2rem] p-6 text-sm font-medium leading-relaxed focus:ring-4 focus:ring-purple-500/5 focus:border-purple-300 outline-none transition-all resize-none shadow-inner"
            placeholder="Hãy mô tả bot như một nhân viên chuyên nghiệp..."
          />
          <div className="absolute bottom-4 right-6 flex items-center gap-2">
            <span
              className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider
              ${formData.system_prompt.length > 1800 ? "bg-red-50 text-red-500" : "bg-white text-slate-400 shadow-sm"}`}
            >
              {formData.system_prompt.length} / 2000
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
