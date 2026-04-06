"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";

type PlatformStats = {
  tenants_total: number;
  tenants_active: number;
  platform_admins: number;
  plan_distribution: Record<string, number>;
  payos: {
    completed_payments: number;
    revenue_vnd: number;
  };
};

function formatNum(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n);
}

export default function AdminOverviewPage() {
  const api = useApi();
  const { accessToken } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = (await api.get("/api/v1/platform-admin/stats")) as PlatformStats;
        if (!cancelled) setStats(data);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Không tải được thống kê.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Tổng quan hệ thống (Super Admin)</h1>
        <p className="text-sm text-slate-500 mt-1">Số liệu thật từ API platform-admin.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-semibold text-slate-500">Tenants (khách hàng)</p>
          <p className="text-3xl font-black text-slate-800 mt-2">
            {loading ? "…" : formatNum(stats?.tenants_total ?? 0)}
          </p>
          <p className="text-xs text-emerald-600 mt-1 font-medium">
            Đang hoạt động: {loading ? "…" : formatNum(stats?.tenants_active ?? 0)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-semibold text-slate-500">Platform Admin</p>
          <p className="text-3xl font-black text-indigo-600 mt-2">
            {loading ? "…" : formatNum(stats?.platform_admins ?? 0)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-semibold text-slate-500">Doanh thu PayOS (đã hoàn tất)</p>
          <p className="text-3xl font-black text-slate-800 mt-2">
            {loading ? "…" : `${formatNum(stats?.payos?.revenue_vnd ?? 0)} ₫`}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Giao dịch: {loading ? "…" : formatNum(stats?.payos?.completed_payments ?? 0)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-semibold text-slate-500">Phân bổ gói (tenant)</p>
          <div className="mt-2 text-xs text-slate-600 space-y-1 max-h-24 overflow-y-auto">
            {stats?.plan_distribution &&
              Object.entries(stats.plan_distribution).map(([plan, n]) => (
                <div key={plan} className="flex justify-between gap-2">
                  <span className="uppercase font-bold text-indigo-600">{plan}</span>
                  <span>{formatNum(n)}</span>
                </div>
              ))}
            {!loading && stats && Object.keys(stats.plan_distribution || {}).length === 0 && (
              <span className="text-slate-400">Chưa có dữ liệu</span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 min-h-[200px] flex items-center justify-center">
        <p className="text-slate-400 text-sm text-center max-w-md">
          Biểu đồ chi tiết có thể bổ sung sau. Hiện tại xem thêm tại{" "}
          <span className="font-semibold text-slate-600">Quản lý Tenants</span> và{" "}
          <span className="font-semibold text-slate-600">Doanh thu &amp; Billing</span>.
        </p>
      </div>
    </div>
  );
}
