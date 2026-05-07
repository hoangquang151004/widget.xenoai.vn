"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";

type OrderRow = {
  id: string;
  source_mode: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number | null;
  payment_status: string;
  created_at: string;
};

type ListResponse = {
  items: OrderRow[];
  page: number;
  per_page: number;
};

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatMoney(v: number | null): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("vi-VN").format(v) + " đ";
}

export default function OrdersPage() {
  const api = useApi();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<OrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [sourceMode, setSourceMode] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("per_page", "20");
      if (status) q.set("status", status);
      if (sourceMode) q.set("source_mode", sourceMode);
      const data = (await api.get(
        `/api/v1/admin/sales/orders?${q.toString()}`,
      )) as ListResponse;
      setItems(data.items || []);
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Không tải được đơn hàng.";
      setError(m);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [api, page, status, sourceMode]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="mb-10">
        <h2 className="text-3xl font-extrabold text-on-surface tracking-tight mb-2">
          Đơn hàng &amp; Lead
        </h2>
        <p className="text-on-surface-variant text-lg leading-relaxed max-w-2xl">
          Theo dõi đơn từ widget (lead, giỏ link, hoặc tạo trực tiếp) và cập nhật
          trạng thái xử lý.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm border border-red-100">
          {error}
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Trạng thái
            </label>
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
            >
              <option value="">Tất cả</option>
              <option value="pending">pending</option>
              <option value="confirmed">confirmed</option>
              <option value="processing">processing</option>
              <option value="completed">completed</option>
              <option value="cancelled">cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Nguồn
            </label>
            <select
              value={sourceMode}
              onChange={(e) => {
                setPage(1);
                setSourceMode(e.target.value);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
            >
              <option value="">Tất cả</option>
              <option value="lead">lead</option>
              <option value="link">link</option>
              <option value="direct">direct</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={isLoading}
            className="ml-auto px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-indigo-600 disabled:opacity-50"
          >
            Làm mới
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Đang tải…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            Chưa có đơn nào khớp bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Khách</th>
                  <th className="px-4 py-3">Nguồn</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Thanh toán</th>
                  <th className="px-4 py-3 text-right">Tạm tính</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                      {formatDateTime(o.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {o.customer_name || "—"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {o.customer_phone || ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-semibold">
                        {o.source_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{o.status}</td>
                    <td className="px-4 py-3 text-xs">{o.payment_status}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(o.subtotal)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/orders/${o.id}`}
                        className="text-indigo-600 font-semibold hover:underline"
                      >
                        Chi tiết
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-slate-100 flex justify-center gap-4">
          <button
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[20px]">
              chevron_left
            </span>
          </button>
          <span className="flex items-center text-sm text-slate-600">
            Trang {page}
          </span>
          <button
            type="button"
            disabled={items.length < 20 || isLoading}
            onClick={() => setPage((p) => p + 1)}
            className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[20px]">
              chevron_right
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
