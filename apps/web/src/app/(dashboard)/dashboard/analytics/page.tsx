"use client";

import { useEffect, useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { completionRate, periodToDays, SalesPeriod, statusEntries } from "@/lib/sales-utils";

type AnalyticsPayload = {
  orders_total?: number;
  products_count?: number;
  by_status?: Record<string, number>;
};

export default function SalesAnalyticsPage() {
  const api = useApi();
  const [period, setPeriod] = useState<SalesPeriod>("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<AnalyticsPayload>({});

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const days = periodToDays(period);
        const d = (await api.get(`/api/v1/admin/sales/analytics?days=${days}`)) as AnalyticsPayload;
        setData(d || {});
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Không tải được analytics.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [api, period]);

  const byStatusRows = useMemo(
    () => statusEntries(data.by_status).map(([status, total]) => ({ status, total })),
    [data.by_status],
  );
  const completePct = completionRate(data.by_status);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold text-on-surface tracking-tight mb-2">Sales Analytics</h2>
        <p className="text-on-surface-variant text-lg max-w-2xl">
          Theo dõi trạng thái đơn hàng và hiệu năng vận hành sales.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPeriod("7d")}
          className={`px-3 py-1.5 text-sm rounded-lg border ${period === "7d" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200"}`}
        >
          7 ngày
        </button>
        <button
          type="button"
          onClick={() => setPeriod("30d")}
          className={`px-3 py-1.5 text-sm rounded-lg border ${period === "30d" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200"}`}
        >
          30 ngày
        </button>
        <button
          type="button"
          onClick={() => setPeriod("90d")}
          className={`px-3 py-1.5 text-sm rounded-lg border ${period === "90d" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200"}`}
        >
          90 ngày
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-sm text-slate-500">Đang tải...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5">
            <div className="text-sm text-slate-500">Tổng đơn</div>
            <div className="mt-2 text-3xl font-bold">{data.orders_total ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5">
            <div className="text-sm text-slate-500">Sản phẩm đã sync</div>
            <div className="mt-2 text-3xl font-bold">{data.products_count ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5">
            <div className="text-sm text-slate-500">Tỷ lệ xử lý tốt</div>
            <div className="mt-2 text-3xl font-bold">{completePct}%</div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Phân bố theo trạng thái</h3>
          {byStatusRows.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có dữ liệu cho giai đoạn này.</p>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byStatusRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="status" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
