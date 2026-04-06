"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";

type BillingSummary = {
  revenue_vnd_total: number;
  payments_pending: number;
  payments_completed: number;
  recent: {
    id: string;
    tenant_id: string;
    order_code: number;
    target_plan: string;
    amount_vnd: number;
    status: string;
    created_at: string | null;
    completed_at: string | null;
  }[];
};

function fmt(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n);
}

export default function AdminBillingPage() {
  const api = useApi();
  const { accessToken } = useAuth();
  const [data, setData] = useState<BillingSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    let c = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = (await api.get(
          "/api/v1/platform-admin/billing/summary",
        )) as BillingSummary;
        if (!c) setData(res);
      } catch (e: unknown) {
        if (!c) setError(e instanceof Error ? e.message : "Không tải được billing.");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [accessToken]);

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Doanh thu &amp; Billing</h1>
        <p className="text-sm text-slate-500">
          Tổng hợp từ bảng PayOS (giao dịch hoàn tất / chờ xử lý).
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[160px]">
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
              Tổng doanh thu (VND)
            </p>
            <h4 className="text-3xl font-black text-slate-900">
              {loading ? "…" : `${fmt(data?.revenue_vnd_total ?? 0)} ₫`}
            </h4>
          </div>
          <p className="text-xs text-slate-500">Các giao dịch PayOS trạng thái hoàn tất</p>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
            Đã hoàn tất
          </p>
          <h4 className="text-3xl font-black text-emerald-700">
            {loading ? "…" : fmt(data?.payments_completed ?? 0)}
          </h4>
          <p className="text-sm text-slate-500 mt-2">Số giao dịch</p>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
            Đang chờ
          </p>
          <h4 className="text-3xl font-black text-amber-600">
            {loading ? "…" : fmt(data?.payments_pending ?? 0)}
          </h4>
          <p className="text-sm text-slate-500 mt-2">Pending</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-6">Giao dịch gần đây</h3>
        <div className="space-y-3 max-h-[480px] overflow-y-auto">
          {(data?.recent ?? []).length === 0 && !loading && (
            <p className="text-sm text-slate-500">Chưa có giao dịch.</p>
          )}
          {(data?.recent ?? []).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0"
            >
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Order #{p.order_code} → {p.target_plan}
                </p>
                <p className="text-[10px] text-slate-400 font-mono truncate max-w-[240px]">
                  tenant {p.tenant_id}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-slate-900">{fmt(p.amount_vnd)} ₫</p>
                <p
                  className={`text-[10px] font-bold uppercase ${
                    p.status === "completed" ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {p.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
