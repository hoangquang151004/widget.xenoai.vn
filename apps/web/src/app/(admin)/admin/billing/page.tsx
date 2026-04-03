export default function AdminBillingPage() {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Doanh thu & Billing</h1>
        <p className="text-sm text-slate-500">Theo dõi doanh thu, dòng tiền và quản lý các gói dịch vụ (Subscription).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-48">
            <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Doanh thu (MRR)</p>
                <h4 className="text-4xl font-black text-slate-900">$12,450.00</h4>
            </div>
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                +8.5% so với tháng trước
            </div>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-48">
            <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Khách hàng mới (Tháng)</p>
                <h4 className="text-4xl font-black text-slate-900">24</h4>
            </div>
            <div className="flex items-center gap-2 text-indigo-600 text-sm font-bold">
                <span className="material-symbols-outlined text-sm">person_add</span>
                Tỷ lệ tăng trưởng: 15%
            </div>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-48">
            <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Tỷ lệ Churn</p>
                <h4 className="text-4xl font-black text-red-600">2.4%</h4>
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-sm font-medium italic">
                Rất thấp (Ngưỡng an toàn)
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-6">Phân bổ Gói dịch vụ</h3>
            <div className="space-y-6">
                {[
                    { name: 'Enterprise Plan ($999/m)', count: 5, revenue: '$4,995', color: 'bg-indigo-600' },
                    { name: 'Pro Plan ($199/m)', count: 28, revenue: '$5,572', color: 'bg-indigo-400' },
                    { name: 'Basic Plan ($49/m)', count: 38, revenue: '$1,862', color: 'bg-indigo-200' },
                    { name: 'Free Plan ($0/m)', count: 142, revenue: '$0', color: 'bg-slate-200' },
                ].map(p => (
                    <div key={p.name} className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${p.color}`}></div>
                        <div className="flex-1">
                            <div className="flex justify-between text-xs font-bold mb-1">
                                <span>{p.name}</span>
                                <span>{p.count} users</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                                <div className={`h-full ${p.color}`} style={{ width: `${(p.count / 213) * 100}%` }}></div>
                            </div>
                        </div>
                        <div className="text-right w-20">
                            <span className="text-xs font-bold text-slate-800">{p.revenue}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="font-bold text-slate-800 mb-6">Giao dịch gần đây</h3>
            <div className="flex-1 space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                <span className="material-symbols-outlined text-sm">add</span>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-800">Thanh toán #INV-{1000 + i}</p>
                                <p className="text-[10px] text-slate-400">Khách hàng: Tenant_ID_{i}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-black text-slate-900">$199.00</p>
                            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tighter">Success</p>
                        </div>
                    </div>
                ))}
            </div>
            <button className="w-full mt-6 py-3 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">Xem tất cả hóa đơn</button>
        </div>
      </div>
    </div>
  );
}
