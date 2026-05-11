"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";

type OrderDetail = {
  id: string;
  chat_session_id: string | null;
  source_mode: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  items: unknown;
  subtotal: number | null;
  external_order_id: string | null;
  external_order_url: string | null;
  payment_method: string | null;
  payment_status: string;
  notes: string | null;
  created_at: string;
};

const STATUS_OPTIONS = [
  "pending",
  "confirmed",
  "processing",
  "completed",
  "cancelled",
];

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

export default function OrderDetailPage() {
  const params = useParams();
  const id = String(params.id || "");
  const api = useApi();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError("");
    try {
      const data = (await api.get(
        `/api/v1/admin/sales/orders/${id}`,
      )) as OrderDetail;
      setOrder(data);
      setStatus(data.status);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không tải được đơn.");
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  }, [api, id]);

  useEffect(() => {
    load();
  }, [load]);

  const saveStatus = async () => {
    if (!order || status === order.status) return;
    setIsSaving(true);
    setError("");
    try {
      await api.patch(`/api/v1/admin/sales/orders/${id}/status`, { status });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Cập nhật thất bại.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !order) {
    return (
      <div className="flex justify-center items-center min-h-[320px]">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/orders"
          className="text-indigo-600 text-sm font-semibold hover:underline"
        >
          ← Danh sách đơn
        </Link>
        <p className="text-red-600">{error || "Không tìm thấy đơn."}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8 pb-16">
      <div>
        <Link
          href="/dashboard/orders"
          className="text-indigo-600 text-sm font-semibold hover:underline inline-flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Danh sách đơn
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Chi tiết đơn
        </h1>
        <p className="text-slate-500 text-sm mt-1 font-mono">{order.id}</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm border border-red-100">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Trạng thái xử lý
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={saveStatus}
            disabled={isSaving || status === order.status}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-indigo-600 disabled:opacity-40"
          >
            {isSaving ? "Đang lưu…" : "Lưu trạng thái"}
          </button>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500 font-medium">Tạo lúc</dt>
            <dd className="font-semibold text-slate-900">
              {formatDateTime(order.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 font-medium">Nguồn</dt>
            <dd className="font-semibold text-slate-900">{order.source_mode}</dd>
          </div>
          <div>
            <dt className="text-slate-500 font-medium">Phiên chat</dt>
            <dd className="font-mono text-xs break-all">
              {order.chat_session_id || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 font-medium">Thanh toán</dt>
            <dd className="font-semibold text-slate-900">
              {order.payment_status}
              {order.payment_method ? ` · ${order.payment_method}` : ""}
            </dd>
          </div>
        </dl>

        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 mb-3">
            Khách hàng
          </h3>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Tên</dt>
              <dd className="font-medium">{order.customer_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Điện thoại</dt>
              <dd className="font-medium">{order.customer_phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium">{order.customer_email || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Địa chỉ</dt>
              <dd className="whitespace-pre-wrap">
                {order.customer_address || "—"}
              </dd>
            </div>
          </dl>
        </div>

        {(order.external_order_id || order.external_order_url) && (
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 mb-3">
              Đơn nền tảng
            </h3>
            <p className="text-sm font-mono break-all">
              ID: {order.external_order_id || "—"}
            </p>
            {order.external_order_url && (
              <a
                href={order.external_order_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 text-sm font-semibold mt-2 inline-block hover:underline"
              >
                Mở trên cửa hàng →
              </a>
            )}
          </div>
        )}

        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 mb-3">
            Dòng hàng (JSON)
          </h3>
          <pre className="text-xs bg-slate-50 rounded-xl p-4 overflow-x-auto border border-slate-100">
            {JSON.stringify(order.items, null, 2)}
          </pre>
        </div>

        {order.notes && (
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 mb-2">
              Ghi chú
            </h3>
            <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
