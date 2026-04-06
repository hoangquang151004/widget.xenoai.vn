"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";

export default function SettingsPage() {
  const api = useApi();
  const { tenant } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    widget_welcome_message: "",
    widget_color: "#4F46E5",
    logo_url: "",
    widget_placeholder: "Nhập câu hỏi...",
    system_prompt: "",
    is_sql_enabled: true,
    is_rag_enabled: true,
  });

  // Tải dữ liệu ban đầu
  useEffect(() => {
    async function fetchSettings() {
      try {
        const data = await api.get("/api/v1/admin/me");
        setFormData({
          name: data.name || "",
          widget_welcome_message: data.widget?.greeting || "Xin chào! Tôi có thể giúp gì cho bạn?",
          widget_color: data.widget?.primary_color || "#4F46E5",
          logo_url: data.widget?.logo_url || "",
          widget_placeholder: data.widget?.placeholder || "Nhập câu hỏi...",
          system_prompt: data.ai_settings?.system_prompt || "Bạn là một trợ lý AI chuyên nghiệp và thân thiện.",
          is_sql_enabled: data.ai_settings?.is_sql_enabled !== undefined ? data.ai_settings.is_sql_enabled : true,
          is_rag_enabled: data.ai_settings?.is_rag_enabled !== undefined ? data.ai_settings.is_rag_enabled : true,
        });
      } catch (error: any) {
        console.error("Lỗi khi tải cấu hình:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, [api]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        bot_name: formData.name, // Đồng bộ bot_name với name
        greeting: formData.widget_welcome_message,
        primary_color: formData.widget_color,
        logo_url: formData.logo_url,
        placeholder: formData.widget_placeholder,
        system_prompt: formData.system_prompt,
        is_sql_enabled: formData.is_sql_enabled,
        is_rag_enabled: formData.is_rag_enabled,
      };
      
      await api.patch("/api/v1/admin/me", payload);
      alert("Đã lưu tất cả thay đổi thành công!");
    } catch (error: any) {
      alert("Lỗi khi lưu cấu hình: " + (error.message || "Vui lòng kiểm tra lại kết nối."));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSwitch = (key: "is_sql_enabled" | "is_rag_enabled") => {
    setFormData((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-100 rounded-full"></div>
            <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Đang đồng bộ dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Cấu hình Chatbot</h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium">Tùy chỉnh cá nhân hóa và năng lực trí tuệ của chatbot.</p>
        </div>
        <div className="flex items-center gap-3">
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
                <span className="material-symbols-outlined text-[20px] group-hover:rotate-12 transition-transform">save</span>
                Lưu tất cả thay đổi
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Main Controls - Left Column */}
        <div className="col-span-12 lg:col-span-7 space-y-8">
          
          {/* Card 1: Embed Code - MOVED TO TOP */}
          <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/80 hover:border-indigo-100 transition-colors duration-500 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-100/50 transition-colors"></div>
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">integration_instructions</span>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Mã nhúng Website</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Tích hợp chatbot chuyên nghiệp vào website của bạn</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="relative group/code">
                  {/* Floating Copy Button */}
                  <div className="absolute top-4 right-4 z-10">
                    <button 
                      onClick={() => {
                        const code = `<script
  src="${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001"}/widget.js"
  data-public-key="${tenant?.public_key || "pk_live_..."}"
  data-api-url="${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001"}"
  data-bot-name="${formData.name}"
  data-color="${formData.widget_color}"
  data-placeholder="${formData.widget_placeholder}"
  data-position="bottom-right"
></script>`;
                        navigator.clipboard.writeText(code);
                        alert("Đã sao chép mã nhúng thành công!");
                      }}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-indigo-500/50 active:scale-95"
                    >
                      <span className="material-symbols-outlined text-sm">content_copy</span>
                      Sao chép mã
                    </button>
                  </div>

                  {/* Code Editor Mockup */}
                  <div className="bg-slate-900 rounded-[2rem] p-8 pt-12 border border-slate-800 shadow-2xl font-mono text-[12px] leading-relaxed text-slate-300 overflow-hidden relative">
                    {/* Browser Dots */}
                    <div className="absolute top-5 left-6 flex gap-1.5 opacity-40">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                    </div>

                    <div className="space-y-1">
                      <p><span className="text-pink-400">&lt;script</span></p>
                      <p className="pl-6">
                        <span className="text-indigo-400">src</span>=
                        <span className="text-emerald-400">{`"${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001"}/widget.js"`}</span>
                      </p>
                      <p className="pl-6">
                        <span className="text-indigo-400">data-public-key</span>=
                        <span className="text-emerald-400">{`"${tenant?.public_key || "pk_live_..."}"`}</span>
                      </p>
                      <p className="pl-6">
                        <span className="text-indigo-400">data-api-url</span>=
                        <span className="text-emerald-400">{`"${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001"}"`}</span>
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
                        <span className="text-emerald-400">{`"bottom-right"`}</span>
                      </p>
                      <p><span className="text-pink-400">&gt;&lt;/script&gt;</span></p>
                    </div>

                    {/* Gradient Fade for long lines */}
                    <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-slate-900 to-transparent pointer-events-none"></div>
                  </div>
                </div>

                {/* Integration Help */}
                <div className="bg-indigo-50/50 rounded-[1.5rem] p-5 border border-indigo-100 flex items-start gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-indigo-600">tips_and_updates</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Vị trí cài đặt tối ưu</p>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                      Sao chép và dán đoạn mã này vào phía trước thẻ đóng <code className="text-indigo-600 font-bold">&lt;/head&gt;</code> của trang web. Chatbot sẽ tự động được khởi tạo với màu sắc và cấu hình AI bạn đã thiết lập ở trên.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Card 2: Branding & Visuals */}
          <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/80 hover:border-indigo-100 transition-colors duration-500 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-100/50 transition-colors"></div>
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">palette</span>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Thương hiệu & Giao diện</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Định hình cách chatbot xuất hiện trước khách hàng</p>
                </div>
              </div>

              {/* Avatar Upload Placeholder UI */}
              <div className="mb-8 flex flex-col md:flex-row items-center gap-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                <div className="relative group/avatar">
                  <div className="w-24 h-24 rounded-[2rem] bg-white shadow-md border-2 border-white overflow-hidden flex items-center justify-center group-hover/avatar:border-indigo-400 transition-all">
                    {formData.logo_url ? (
                      <img src={formData.logo_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-4xl text-slate-200">smart_toy</span>
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-sm font-bold">link</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2 w-full">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1 block">URL Ảnh đại diện (Avatar URL)</label>
                  <input
                    id="logo_url"
                    value={formData.logo_url}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 outline-none transition-all placeholder:text-slate-300 shadow-sm"
                    placeholder="https://example.com/avatar.png"
                  />
                  <p className="text-[10px] text-slate-400 italic px-1">Gợi ý: Sử dụng ảnh vuông (1:1) để hiển thị đẹp nhất.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1 block">Tên hiển thị</label>
                  <input
                    id="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 outline-none transition-all placeholder:text-slate-300"
                    placeholder="VD: AI Support"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1 block">Màu sắc chủ đạo</label>
                  <div className="flex items-center gap-3">
                    <div className="relative group/color">
                      <input 
                        type="color" 
                        value={formData.widget_color}
                        onChange={(e) => setFormData({ ...formData, widget_color: e.target.value })}
                        className="w-14 h-[52px] rounded-2xl cursor-pointer border-0 p-0 overflow-hidden shadow-sm"
                      />
                      <div className="absolute inset-0 rounded-2xl ring-2 ring-inset ring-black/5 pointer-events-none"></div>
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-2xl px-4 py-4 flex items-center justify-between border border-slate-100">
                      <code className="text-xs font-bold text-slate-700 uppercase tracking-widest">{formData.widget_color}</code>
                      <span className="material-symbols-outlined text-slate-400 text-lg">colorize</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1 block">Lời chào mừng (Welcome)</label>
                  <input
                    id="widget_welcome_message"
                    value={formData.widget_welcome_message}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 outline-none transition-all"
                    placeholder="Xin chào! Tôi có thể giúp gì cho bạn?"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1 block">Ô nhập câu hỏi (Placeholder)</label>
                  <input
                    id="widget_placeholder"
                    value={formData.widget_placeholder}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 outline-none transition-all"
                    placeholder="Nhập câu hỏi của bạn..."
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Card 3: AI Capabilities */}
          <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/80">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">bolt</span>
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Năng lực AI (Agents)</h3>
                <p className="text-[11px] text-slate-400 font-medium">Bật/tắt các kỹ năng chuyên sâu của trợ lý</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { 
                  id: "is_rag_enabled", 
                  label: "Kiến thức RAG", 
                  desc: "Tra cứu tài liệu Knowledge Base",
                  icon: "menu_book",
                  color: "blue",
                  active: formData.is_rag_enabled 
                },
                { 
                  id: "is_sql_enabled", 
                  label: "Phân tích SQL", 
                  desc: "Truy vấn dữ liệu từ Database",
                  icon: "database",
                  color: "emerald",
                  active: formData.is_sql_enabled 
                },
              ].map((cap) => (
                <button 
                  key={cap.id} 
                  onClick={() => toggleSwitch(cap.id as any)}
                  className={`relative flex items-center gap-4 p-5 rounded-[1.8rem] border transition-all duration-300 text-left group
                    ${cap.active 
                      ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200" 
                      : "bg-slate-50 border-slate-100 text-slate-700 hover:border-slate-300"}`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors
                    ${cap.active ? "bg-white/10" : "bg-white shadow-sm"}`}>
                    <span className={`material-symbols-outlined text-xl ${cap.active ? "text-white" : "text-slate-500"}`}>
                      {cap.icon}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-black ${cap.active ? "text-white" : "text-slate-800"}`}>{cap.label}</p>
                    <p className={`text-[10px] font-medium leading-tight mt-0.5 ${cap.active ? "text-white/60" : "text-slate-400"}`}>
                      {cap.desc}
                    </p>
                  </div>
                  <div className={`w-10 h-6 rounded-full relative transition-colors duration-500 ${cap.active ? "bg-indigo-500" : "bg-slate-200"}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 
                      ${cap.active ? "left-5" : "left-1"}`}></div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Card 4: Personality */}
          <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/80">
             <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">psychology</span>
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Cốt lõi & Tính cách</h3>
                <p className="text-[11px] text-slate-400 font-medium">Quy định cách bot suy nghĩ và phản hồi (System Prompt)</p>
              </div>
            </div>

            <div className="relative group">
              <textarea
                id="system_prompt"
                value={formData.system_prompt}
                onChange={handleChange}
                rows={8}
                className="w-full bg-slate-50 border border-slate-100 rounded-[2rem] p-6 text-sm font-medium leading-relaxed focus:ring-4 focus:ring-purple-500/5 focus:border-purple-300 outline-none transition-all resize-none shadow-inner"
                placeholder="Hãy mô tả bot như một nhân viên chuyên nghiệp..."
              />
              <div className="absolute bottom-4 right-6 flex items-center gap-2">
                <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider
                  ${formData.system_prompt.length > 1800 ? "bg-red-50 text-red-500" : "bg-white text-slate-400 shadow-sm"}`}>
                  {formData.system_prompt.length} / 2000
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Live Preview - Right Column */}
        <div className="col-span-12 lg:col-span-5">
          <div className="sticky top-28 space-y-6">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Xem trước trực tiếp (Desktop)</h4>
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black uppercase tracking-tighter">Real-time Sync</span>
              </div>
            </div>

            {/* Desktop Browser Mockup */}
            <div className="relative w-full min-h-[650px] bg-white rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden flex flex-col">
              {/* Browser Header */}
              <div className="h-10 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-2 shrink-0">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                </div>
                <div className="flex-1 max-w-md mx-auto h-6 bg-white rounded-lg border border-slate-200 flex items-center px-3 gap-2">
                  <span className="material-symbols-outlined text-[10px] text-slate-300">lock</span>
                  <div className="w-24 h-1.5 bg-slate-100 rounded-full"></div>
                </div>
              </div>

              {/* Browser Content Area (Simulated Website) */}
              <div className="flex-1 bg-white p-6 relative overflow-hidden">
                {/* Mock Website Elements */}
                <div className="space-y-4">
                  <div className="w-2/3 h-6 bg-slate-50 rounded-xl"></div>
                  <div className="w-full h-32 bg-slate-50/50 rounded-3xl border border-dashed border-slate-100 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Nội dung website của bạn</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-20 bg-slate-50/50 rounded-2xl"></div>
                    <div className="h-20 bg-slate-50/50 rounded-2xl"></div>
                  </div>
                </div>

                {/* Floating Chatbot Widget Window */}
                <div className="absolute bottom-6 right-6 w-[320px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 duration-700">
                  {/* Widget Header */}
                  <div 
                    className="p-5 flex items-center gap-3 text-white transition-all duration-700 relative overflow-hidden shrink-0"
                    style={{ backgroundColor: formData.widget_color }}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 blur-2xl"></div>
                    
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 overflow-hidden shrink-0">
                      {formData.logo_url ? (
                        <img src={formData.logo_url} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-xl">smart_toy</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-[13px] font-black tracking-tight leading-none uppercase truncate">{formData.name || "AI Assistant"}</h5>
                      <div className="flex items-center gap-1.5 mt-1.5 opacity-80">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                        <span className="text-[9px] font-bold tracking-wider uppercase italic">Online</span>
                      </div>
                    </div>
                    <button className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center backdrop-blur-sm">
                      <span className="material-symbols-outlined text-lg">expand_more</span>
                    </button>
                  </div>

                  {/* Chat Content */}
                  <div className="h-[350px] bg-slate-50/50 p-5 space-y-5 overflow-y-auto">
                    {/* System Message */}
                    <div className="flex gap-2.5 items-start animate-in slide-in-from-left duration-500">
                      <div className="w-7 h-7 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                        {formData.logo_url ? (
                          <img src={formData.logo_url} alt="Bot" className="w-full h-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-xs text-indigo-500 font-bold">bolt</span>
                        )}
                      </div>
                      <div className="max-w-[85%] bg-white p-3.5 rounded-xl rounded-tl-none shadow-sm border border-slate-100">
                        <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                          {formData.widget_welcome_message}
                        </p>
                      </div>
                    </div>

                    {/* User Message */}
                    <div className="flex justify-end animate-in slide-in-from-right duration-700 delay-200">
                      <div 
                        className="max-w-[80%] p-3.5 rounded-xl rounded-tr-none shadow-lg text-white transition-all duration-700"
                        style={{ backgroundColor: formData.widget_color }}
                      >
                        <p className="text-[11px] font-bold leading-relaxed">
                          Chào bạn! Tôi cần hỗ trợ tra cứu thông tin.
                        </p>
                      </div>
                    </div>

                    {/* System Response (Simulated) */}
                    <div className="flex gap-2.5 items-start animate-in slide-in-from-left duration-500 delay-500">
                      <div className="w-7 h-7 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                        {formData.logo_url ? (
                          <img src={formData.logo_url} alt="Bot" className="w-full h-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-xs text-indigo-500 font-bold">bolt</span>
                        )}
                      </div>
                      <div className="max-w-[85%] bg-white p-3.5 rounded-xl rounded-tl-none shadow-sm border border-slate-100">
                        <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                          Vâng, tôi sẵn sàng giúp bạn. Bạn muốn tra cứu về tài liệu hay dữ liệu hệ thống?
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Input Mockup */}
                  <div className="p-4 bg-white border-t border-slate-100 flex items-center gap-3">
                    <div className="flex-1 bg-slate-100 rounded-xl px-4 py-3 flex items-center justify-between border border-transparent">
                      <span className="text-[11px] text-slate-400 font-bold italic truncate mr-2">
                        {formData.widget_placeholder}
                      </span>
                    </div>
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg transition-all duration-700 shrink-0"
                      style={{ backgroundColor: formData.widget_color }}
                    >
                      <span className="material-symbols-outlined text-lg">send</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-400 text-center font-bold uppercase tracking-widest max-w-[280px] mx-auto leading-relaxed">
              Widget sẽ xuất hiện ở góc dưới bên phải trang web của bạn với cấu hình đã chọn.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
