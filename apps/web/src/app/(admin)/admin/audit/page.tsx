export default function AdminAuditPage() {
  const auditLogs = [
    { id: 1, tenant: "Antigravity", action: "File Upload", target: "hop-dong-lao-dong.pdf", time: "2m ago", risk: "Low" },
    { id: 2, tenant: "Global Tech", action: "Chat Session", target: "Session #4421", time: "15m ago", risk: "Medium" },
    { id: 3, tenant: "StartupX", action: "File Upload", target: "secret_plan.docx", time: "1h ago", risk: "High" },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Kiểm duyệt & Audit</h1>
        <p className="text-sm text-slate-500">Giám sát nội dung dữ liệu và hoạt động hội thoại toàn hệ thống.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-wider">Tổng tài liệu</p>
            <h4 className="text-2xl font-black text-slate-800">1,452</h4>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-wider">Dung lượng Vector</p>
            <h4 className="text-2xl font-black text-slate-800">12.4 GB</h4>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-red-500 uppercase mb-1 tracking-wider">Cảnh báo rủi ro</p>
            <h4 className="text-2xl font-black text-red-600">03</h4>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-emerald-500 uppercase mb-1 tracking-wider">Độ chính xác AI</p>
            <h4 className="text-2xl font-black text-emerald-600">96.5%</h4>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Nhật ký hoạt động (Audit Logs)</h3>
            <div className="flex gap-2">
                <button className="text-xs font-bold px-3 py-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Export CSV</button>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Khách hàng</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Hành động</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Đối tượng</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Thời gian</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Mức độ rủi ro</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Chi tiết</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{log.tenant}</td>
                            <td className="px-6 py-4">
                                <span className="text-xs bg-slate-100 px-2 py-1 rounded font-medium">{log.action}</span>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500 font-mono">{log.target}</td>
                            <td className="px-6 py-4 text-[11px] text-slate-400 font-bold uppercase">{log.time}</td>
                            <td className="px-6 py-4">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    log.risk === 'High' ? 'bg-red-100 text-red-700' : 
                                    log.risk === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                    {log.risk}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <button className="material-symbols-outlined text-slate-300 hover:text-indigo-500 transition-colors">visibility</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
