export default function AdminHealthPage() {
  const services = [
    { name: "PostgreSQL Database", status: "Healthy", uptime: "99.99%", latency: "12ms" },
    { name: "Redis Cache", status: "Healthy", uptime: "100%", latency: "2ms" },
    { name: "Qdrant Vector DB", status: "Healthy", uptime: "99.95%", latency: "45ms" },
    { name: "Celery Worker Cluster", status: "Degraded", uptime: "98.20%", latency: "N/A" },
    { name: "Storage Service (S3)", status: "Healthy", uptime: "100%", latency: "85ms" },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Sức khỏe Hệ thống</h1>
        <p className="text-sm text-slate-500">Giám sát trạng thái thời gian thực của hạ tầng và các dịch vụ nền.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Trạng thái Dịch vụ</h3>
                    <button className="text-xs font-bold text-indigo-600 hover:underline">Refresh Auto (5s)</button>
                </div>
                <div className="divide-y divide-slate-100">
                    {services.map(s => (
                        <div key={s.name} className="flex items-center justify-between p-6 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`w-3 h-3 rounded-full ${
                                    s.status === 'Healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                                }`}></div>
                                <div>
                                    <div className="text-sm font-bold text-slate-800">{s.name}</div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase">Uptime: {s.uptime}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-8">
                                <div className="text-right">
                                    <div className="text-xs font-mono text-slate-600">{s.latency}</div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Latency</div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                    s.status === 'Healthy' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                    {s.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="space-y-6">
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-400">terminal</span>
                    System Logs (Errors)
                </h3>
                <div className="space-y-3 font-mono text-[10px] opacity-80 overflow-y-auto max-h-[400px]">
                    <p className="text-red-400">[ERROR] 14:20:05 - Connection timeout to Qdrant cluster.</p>
                    <p className="text-slate-400">[INFO] 14:20:10 - Retrying connection...</p>
                    <p className="text-emerald-400">[SUCCESS] 14:20:12 - Connection restored.</p>
                    <p className="text-amber-400">[WARN] 14:21:00 - High memory usage on Worker #2.</p>
                    <p className="text-slate-400">[INFO] 14:22:15 - Background task "SyncEmbeddings" started.</p>
                    <p className="text-red-400">[ERROR] 14:25:30 - GPT-4o API rate limit reached for Tenant_ID: 4f46...</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4">Resource Usage</h3>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="font-bold">CPU Usage</span>
                            <span className="text-slate-500">45%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 w-[45%]"></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="font-bold">Memory</span>
                            <span className="text-slate-500">8.2GB / 16GB</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 w-[52%]"></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="font-bold">Disk (Vector Store)</span>
                            <span className="text-slate-500">120GB / 500GB</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 w-[24%]"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
