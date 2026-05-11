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

type OrderDetail = {
  id: string;
  source_mode: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  items: unknown;
  subtotal: number | null;
  payment_status: string;
  payment_method: string | null;
  created_at: string;
  notes: string | null;
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
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const filteredItems = items.filter((o) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (o.customer_name || "").toLowerCase().includes(q) ||
      (o.customer_phone || "").toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q)
    );
  });

  const exportCsv = useCallback(() => {
    const rows = [
      ["id", "created_at", "customer_name", "customer_phone", "source_mode", "status", "payment_status", "subtotal"],
      ...filteredItems.map((o) => [
        o.id,
        o.created_at,
        o.customer_name || "",
        o.customer_phone || "",
        o.source_mode,
        o.status,
        o.payment_status,
        String(o.subtotal ?? ""),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders_page_${page}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [filteredItems, page]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("per_page", "20");
      if (status) q.set("status", status);
      if (sourceMode) q.set("source_mode", sourceMode);
      if (dateFrom) q.set("date_from", new Date(`${dateFrom}T00:00:00`).toISOString());
      if (dateTo) q.set("date_to", new Date(`${dateTo}T23:59:59`).toISOString());
      if (search.trim()) q.set("q", search.trim());
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
  }, [api, dateFrom, dateTo, page, search, sourceMode, status]);

  const openDetail = useCallback(
    async (orderId: string) => {
      setDetailLoading(true);
      try {
        const data = (await api.get(`/api/v1/admin/sales/orders/${orderId}`)) as OrderDetail;
        setDetail(data);
      } finally {
        setDetailLoading(false);
      }
    },
    [api],
  );

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
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Tìm theo tên/SĐT/mã đơn"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white min-w-56"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setPage(1);
              setDateFrom(e.target.value);
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setPage(1);
              setDateTo(e.target.value);
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
          />
          <button
            type="button"
            onClick={exportCsv}
            disabled={isLoading || filteredItems.length === 0}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Đang tải…</p>
          </div>
        ) : filteredItems.length === 0 ? (
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
                {filteredItems.map((o) => (
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
                      <button
                        type="button"
                        onClick={() => openDetail(o.id)}
                        className="text-indigo-600 font-semibold hover:underline"
                      >
                        Xem nhanh
                      </button>
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

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 md:p-8" onClick={() => setDetail(null)}>
          <div
            className="mx-auto max-w-2xl rounded-2xl bg-white shadow-xl border border-slate-200 p-6 max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-xl font-bold text-slate-900">Chi tiết đơn</h3>
              <button type="button" onClick={() => setDetail(null)} className="text-slate-500 hover:text-slate-800">
                Đóng
              </button>
            </div>
            {detailLoading ? (
              <p className="text-sm text-slate-500">Đang tải...</p>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="font-mono text-xs break-all">{detail.id}</p>
                <p>Khách: <strong>{detail.customer_name || "—"}</strong> · {detail.customer_phone || "—"}</p>
                <p>Nguồn: <strong>{detail.source_mode}</strong> · Trạng thái: <strong>{detail.status}</strong></p>
                <p>Thanh toán: <strong>{detail.payment_status}</strong>{detail.payment_method ? ` · ${detail.payment_method}` : ""}</p>
                <p>Tạo lúc: {formatDateTime(detail.created_at)}</p>
                <pre className="bg-slate-50 border border-slate-100 rounded-lg p-3 overflow-x-auto text-xs">{JSON.stringify(detail.items, null, 2)}</pre>
                {detail.notes && <p className="whitespace-pre-wrap">Ghi chú: {detail.notes}</p>}
                <div>
                  <Link href={`/dashboard/orders/${detail.id}`} className="text-indigo-600 font-semibold hover:underline">
                    Mở trang chi tiết đầy đủ →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
