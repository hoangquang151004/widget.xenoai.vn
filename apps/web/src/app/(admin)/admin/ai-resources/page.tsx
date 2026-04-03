export default function AdminAIResourcesPage() {
  const models = [
    { name: "GPT-4o", provider: "OpenAI", status: "Primary", latency: "1.2s", costPer1k: "$0.01" },
    { name: "GPT-4o-mini", provider: "OpenAI", status: "Active", latency: "0.5s", costPer1k: "$0.00015" },
    { name: "Gemini 1.5 Pro", provider: "Google", status: "Backup", latency: "1.8s", costPer1k: "$0.0035" },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Quản lý Tài nguyên AI</h1>
        <p className="text-sm text-slate-500">Giám sát mức độ tiêu thụ Token và cấu hình phân bổ Model AI.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
          <div className="flex justify-between items-start mb-4">
            <span className="material-symbols-outlined text-3xl opacity-80">toll</span>
            <span className="bg-white/20 px-2 py-1 rounded text-[10px] font-bold uppercase">Tháng này</span>
          </div>
          <p className="text-indigo-100 text-sm font-medium">Tổng Token tiêu thụ</p>
          <h3 className="text-3xl font-black mt-1">45.2M</h3>
          <p className="text-xs text-indigo-200 mt-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">trending_up</span>
            +12.5% so với tháng trước
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <span className="material-symbols-outlined text-3xl text-emerald-500">payments</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Chi phí AI dự kiến</p>
          <h3 className="text-3xl font-black text-slate-800 mt-1">$1,240.50</h3>
          <div className="h-1.5 w-full bg-slate-100 rounded-full mt-4 overflow-hidden">
             <div className="h-full bg-emerald-500 rounded-full w-3/4"></div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tighter">Budget: $2,000 / Tháng</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <span className="material-symbols-outlined text-3xl text-amber-500">speed</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Độ trễ trung bình</p>
          <h3 className="text-3xl font-black text-slate-800 mt-1">0.85s</h3>
          <p className="text-xs text-emerald-600 mt-2 font-bold uppercase tracking-tighter">Tối ưu hơn 15%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
             <span className="material-symbols-outlined text-indigo-500">model_training</span>
             Cấu hình Model AI
          </h3>
          <div className="space-y-4">
            {models.map(m => (
              <div key={m.name} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    m.status === 'Primary' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    <span className="material-symbols-outlined">smart_toy</span>
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">{m.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{m.provider}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-xs font-bold text-slate-700">{m.latency}</div>
                        <div className="text-[10px] text-slate-400 font-medium">Latency</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                        m.status === 'Primary' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'
                    }`}>
                        {m.status}
                    </span>
                    <button className="material-symbols-outlined text-slate-300 hover:text-indigo-500 transition-colors">settings</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
           <h3 className="font-bold text-slate-800 mb-6">Tiêu thụ Token theo Tenant (Top 5)</h3>
           <div className="space-y-6">
              {[
                { name: 'Antigravity', usage: '12.4M', percentage: 75 },
                { name: 'X-Tech', usage: '5.1M', percentage: 45 },
                { name: 'VinaGroup', usage: '2.8M', percentage: 30 },
                { name: 'Global Solution', usage: '1.2M', percentage: 15 },
                { name: 'Tech Startup', usage: '0.5M', percentage: 8 },
              ].map(t => (
                <div key={t.name}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-slate-700">{t.name}</span>
                        <span className="text-xs font-mono text-indigo-600">{t.usage}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${t.percentage}%` }}></div>
                    </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}
