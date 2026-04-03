export default function AdminTenantsPage() {
  const tenants = [
    { 
        id: "1", 
        name: "Công ty Antigravity", 
        email: "admin@antigravity.vn", 
        slug: "antigravity-demo", 
        status: "Active", 
        plan: "Enterprise",
        usage: { docs: 45, docsLimit: 100, queries: 12400, queriesLimit: 50000 }
    },
    { 
        id: "2", 
        name: "X-Tech Solutions", 
        email: "contact@xtech.io", 
        slug: "xtech-solutions", 
        status: "Suspended", 
        plan: "Pro",
        usage: { docs: 12, docsLimit: 20, queries: 4800, queriesLimit: 5000 }
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Khách hàng (Tenants)</h1>
          <p className="text-sm text-slate-500">Quản lý tài khoản, hạn mức và trạng thái của các doanh nghiệp trên nền tảng.</p>
        </div>
        <button className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95">
          + Khởi tạo Tenant mới
        </button>
      </div>
      
      {/* Filter & Search */}
      <div className="flex gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-xl">search</span>
          <input className="w-full bg-slate-50 border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Tìm kiếm tên, email hoặc slug..." />
        </div>
        <select className="bg-slate-50 border-none rounded-lg px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none">
          <option>Tất cả gói dịch vụ</option>
          <option>Free</option>
          <option>Pro</option>
          <option>Enterprise</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Tenant & Plan</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Email & Slug</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Hạn mức (Documents)</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Hạn mức (Queries)</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Trạng thái</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {tenants.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{t.name}</div>
                    <div className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">{t.plan}</div>
                </td>
                <td className="px-6 py-4">
                    <div className="text-sm text-slate-600">{t.email}</div>
                    <code className="text-[10px] text-slate-400 font-mono">/{t.slug}</code>
                </td>
                <td className="px-6 py-4">
                    <div className="w-32">
                        <div className="flex justify-between text-[10px] font-bold mb-1">
                            <span>{t.usage.docs}/{t.usage.docsLimit}</span>
                            <span>{Math.round(t.usage.docs/t.usage.docsLimit*100)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full ${t.usage.docs/t.usage.docsLimit > 0.8 ? 'bg-red-500' : 'bg-indigo-500'}`} 
                                style={{ width: `${t.usage.docs/t.usage.docsLimit*100}%` }}
                            ></div>
                        </div>
                    </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                    <span className="font-bold text-slate-800">{t.usage.queries.toLocaleString()}</span>
                    <span className="text-slate-400"> / {t.usage.queriesLimit.toLocaleString()}</span>
                </td>
                <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        t.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                        <span className={`w-1 h-1 rounded-full ${t.status === 'Active' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                        {t.status}
                    </span>
                </td>
                <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button title="Đăng nhập với tư cách tenant" className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                            <span className="material-symbols-outlined text-[20px]">login</span>
                        </button>
                        <button title="Chỉnh sửa hạn mức" className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                            <span className="material-symbols-outlined text-[20px]">settings_suggest</span>
                        </button>
                        <button title="Khóa tài khoản" className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                            <span className="material-symbols-outlined text-[20px]">block</span>
                        </button>
                    </div>
                </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
