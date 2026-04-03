"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";

type BillingSummary = {
  tenant: {
    id: string;
    name: string;
    email: string;
    plan: string;
  };
  usage: {
    ai_messages: { current: number; limit: number };
    rag_storage: { bytes: number; limit_bytes: number; document_count: number };
    sql_connections: { current: number; limit: number };
  };
  payment_methods: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
};

const FALLBACK_BILLING: BillingSummary = {
  tenant: { id: "", name: "", email: "", plan: "free" },
  usage: {
    ai_messages: { current: 0, limit: 1000 },
    rag_storage: { bytes: 0, limit_bytes: 10 * 1024 * 1024, document_count: 0 },
    sql_connections: { current: 0, limit: 0 },
  },
  payment_methods: [],
  invoices: [],
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatMB(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)}MB`;
}

function formatPercent(current: number, max: number): number {
  if (!max || max <= 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.min(100, Math.max(0, (current / max) * 100));
}

function normalizePlan(plan: string): "free" | "pro" | "enterprise" {
  if (plan === "enterprise") return "enterprise";
  if (plan === "pro") return "pro";
  return "free";
}

export default function BillingPage() {
  const api = useApi();
  const { accessToken } = useAuth();
  const [data, setData] = useState<BillingSummary>(FALLBACK_BILLING);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const loadBillingSummary = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const summary = (await api.get(
          "/api/v1/admin/billing/summary",
        )) as BillingSummary;
        setData(summary);
      } catch (err) {
        setError((err as Error).message || "Không thể kết nối backend.");
        setData(FALLBACK_BILLING);
      } finally {
        setIsLoading(false);
      }
    };

    loadBillingSummary();
  }, [accessToken]);

  const usageStats = useMemo(() => {
    const aiCurrent = data.usage.ai_messages.current;
    const aiLimit = data.usage.ai_messages.limit;

    const ragCurrent = data.usage.rag_storage.bytes;
    const ragLimit = data.usage.rag_storage.limit_bytes;

    const sqlCurrent = data.usage.sql_connections.current;
    const sqlLimit = data.usage.sql_connections.limit;

    return [
      {
        label: "Tin nhắn AI",
        currentText: formatNumber(aiCurrent),
        maxText: aiLimit > 0 ? formatNumber(aiLimit) : "Không giới hạn",
        percent: formatPercent(aiCurrent, aiLimit),
        icon: "chat_bubble",
        tone: "primary" as const,
      },
      {
        label: "Lưu trữ RAG",
        currentText: formatMB(ragCurrent),
        maxText: ragLimit > 0 ? formatMB(ragLimit) : "Không giới hạn",
        percent: formatPercent(ragCurrent, ragLimit),
        icon: "database",
        tone: "secondary" as const,
      },
      {
        label: "Kết nối SQL",
        currentText: formatNumber(sqlCurrent),
        maxText: sqlLimit > 0 ? formatNumber(sqlLimit) : "Không giới hạn",
        percent: formatPercent(sqlCurrent, sqlLimit),
        icon: "hub",
        tone: "tertiary" as const,
      },
    ];
  }, [data]);

  const activePlan = normalizePlan(data.tenant.plan);

  const invoiceRows = data.invoices.length
    ? data.invoices
    : [{ id: "INV-DEMO-001", date: "N/A", amount: "$0.00", status: "Chưa có" }];

  return (
    <>
      <section className="mb-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-on-surface">
              Tổng quan sử dụng
            </h2>
            <p className="text-on-surface-variant text-sm">
              Tenant: {data.tenant.name || "Đang tải..."}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-primary-container/10 text-primary text-xs font-bold border border-primary/20">
            {isLoading ? "Đang đồng bộ..." : "Đã đồng bộ từ backend"}
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-error/20 bg-error-container/40 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {usageStats.map((stat, i) => (
            <div
              key={i}
              className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm transition-all hover:border-primary/20"
            >
              <div className="flex justify-between items-start mb-4">
                <div
                  className={`p-2 rounded-lg ${
                    stat.tone === "primary"
                      ? "bg-primary/10 text-primary"
                      : stat.tone === "secondary"
                        ? "bg-secondary/10 text-secondary"
                        : "bg-tertiary/10 text-tertiary"
                  }`}
                >
                  <span className="material-symbols-outlined">{stat.icon}</span>
                </div>
                <span className="text-xs font-bold text-on-surface-variant">
                  {stat.percent.toFixed(1)}%
                </span>
              </div>
              <h3 className="text-on-surface font-semibold mb-1">
                {stat.label}
              </h3>
              <p className="text-2xl font-bold text-on-surface mb-4">
                {stat.currentText}{" "}
                <span className="text-sm font-normal text-on-surface-variant">
                  / {stat.maxText}
                </span>
              </p>
              <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    stat.tone === "primary"
                      ? "bg-primary"
                      : stat.tone === "secondary"
                        ? "bg-secondary"
                        : "bg-tertiary"
                  }`}
                  style={{ width: `${stat.percent}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-extrabold text-on-surface mb-3">
            Nâng tầm trải nghiệm AI của bạn
          </h2>
          <p className="text-on-surface-variant">
            Chọn gói dịch vụ phù hợp để mở khóa các tính năng nâng cao và tối ưu
            hóa quy trình làm việc.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          <div
            className={`bg-surface-container-lowest p-8 rounded-2xl border flex flex-col transition-all hover:translate-y-[-4px] ${
              activePlan === "free"
                ? "border-primary/40"
                : "border-outline-variant/10"
            }`}
          >
            <div className="mb-8">
              <h3 className="text-xl font-bold text-on-surface mb-2">Free</h3>
              <p className="text-on-surface-variant text-sm h-10">
                Dành cho cá nhân bắt đầu tìm hiểu về AI.
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-on-surface">
                  $0
                </span>
                <span className="text-on-surface-variant">/tháng</span>
              </div>
            </div>
            <button className="mt-auto w-full py-3 px-6 rounded-full border-2 border-outline-variant text-on-surface font-semibold hover:bg-surface-container transition-colors">
              {activePlan === "free" ? "Gói hiện tại" : "Chọn Free"}
            </button>
          </div>

          <div
            className={`p-[2px] rounded-2xl shadow-2xl relative ${
              activePlan === "pro"
                ? "bg-primary shadow-primary/20"
                : "bg-outline-variant/30 shadow-black/10"
            }`}
          >
            <div className="bg-surface-container-lowest p-8 rounded-[22px] h-full flex flex-col">
              <div className="mb-8">
                <h3 className="text-xl font-bold text-on-surface mb-2">Pro</h3>
                <p className="text-on-surface-variant text-sm h-10">
                  Giải pháp chuyên nghiệp cho doanh nghiệp vừa và nhỏ.
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-primary">
                    $49
                  </span>
                  <span className="text-on-surface-variant">/tháng</span>
                </div>
              </div>
              <button className="mt-auto w-full py-3 px-6 rounded-full bg-primary text-on-primary font-bold shadow-lg shadow-primary/30 hover:opacity-90 transition-all">
                {activePlan === "pro" ? "Gói hiện tại" : "Nâng cấp lên Pro"}
              </button>
            </div>
          </div>

          <div
            className={`bg-surface-container-lowest p-8 rounded-2xl border flex flex-col transition-all hover:translate-y-[-4px] ${
              activePlan === "enterprise"
                ? "border-primary/40"
                : "border-outline-variant/10"
            }`}
          >
            <div className="mb-8">
              <h3 className="text-xl font-bold text-on-surface mb-2">
                Enterprise
              </h3>
              <p className="text-on-surface-variant text-sm h-10">
                Quy mô lớn với yêu cầu bảo mật và hiệu suất tối đa.
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-on-surface">
                  Tùy chỉnh
                </span>
              </div>
            </div>
            <button className="mt-auto w-full py-3 px-6 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary/5 transition-colors">
              {activePlan === "enterprise"
                ? "Gói hiện tại"
                : "Liên hệ kinh doanh"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-16">
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-on-surface">
              Phương thức thanh toán
            </h2>
            <button className="text-primary font-semibold text-sm hover:underline">
              Thêm thẻ mới
            </button>
          </div>
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 shadow-sm">
            <p className="text-sm text-on-surface-variant">
              Chưa có dữ liệu phương thức thanh toán từ backend. Kết nối
              Stripe/Payment Provider để hiển thị thẻ thật.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-on-surface">
              Lịch sử giao dịch
            </h2>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/10">
                    ID Hóa đơn
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/10">
                    Ngày
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/10">
                    Số tiền
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/10">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {invoiceRows.map((inv, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-surface-container-low/30 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-semibold text-on-surface">
                      {String(inv.id || "N/A")}
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">
                      {String(inv.date || "N/A")}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-on-surface">
                      {String(inv.amount || "$0.00")}
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">
                      {String(inv.status || "N/A")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
