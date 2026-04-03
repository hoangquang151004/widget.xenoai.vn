export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Cấu hình Hệ thống</h1>
        <p className="text-sm text-slate-500">Thiết lập các tham số toàn cục và tùy chỉnh thương hiệu nền tảng.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-500">settings_applications</span>
                    Tham số Toàn cục (Global Settings)
                </h3>
                <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">OpenAI API Key (Fallback)</label>
                            <input type="password" placeholder="sk-••••••••••••••••" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Google Gemini Key</label>
                            <input type="password" placeholder="AIza••••••••••••••••" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Rate Limit (Requests/min)</label>
                            <input type="number" defaultValue={60} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Max File Size (MB)</label>
                            <input type="number" defaultValue={10} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100">
                        <button className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all">Lưu cấu hình hệ thống</button>
                    </div>
                </form>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-500">branding_watermark</span>
                    Tùy chỉnh Thương hiệu (Whitelabel)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Tên Nền tảng</label>
                            <input type="text" defaultValue="XenoAI Ecosystem" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Primary Color</label>
                            <div className="flex gap-2">
                                <input type="color" defaultValue="#4f46e5" className="h-10 w-10 border-0 p-0 rounded-lg cursor-pointer" />
                                <input type="text" defaultValue="#4f46e5" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 text-sm outline-none" />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center mb-3">
                            <span className="material-symbols-outlined text-indigo-600 text-3xl">add_photo_alternate</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Tải lên Logo (PNG/SVG)</p>
                    </div>
                </div>
            </div>
        </div>

        <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl">
                <h4 className="text-amber-900 font-bold mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-600">warning</span>
                    Chế độ Bảo trì
                </h4>
                <p className="text-amber-700 text-xs leading-relaxed mb-4">Kích hoạt chế độ bảo trì sẽ chặn mọi request từ người dùng và widget bên ngoài.</p>
                <button className="w-full py-2.5 bg-amber-600 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-600/20">Kích hoạt Bảo trì</button>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-slate-800 mb-4">System Info</h4>
                <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Version</span>
                        <span className="font-mono font-bold text-indigo-600">v0.2.0-beta</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Node Engine</span>
                        <span className="font-mono font-bold text-slate-700">v20.11.0</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Environment</span>
                        <span className="font-black text-emerald-600 uppercase tracking-tighter">Production</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
