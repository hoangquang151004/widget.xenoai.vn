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
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatBytes(bytes: number): string {
  if (!bytes) {
    return "0 MB";
  }
  const mb = bytes / (1024 * 1024);
  if (mb > 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

function formatPercent(current: number, max: number): string {
  if (!max || max <= 0) {
    return current > 0 ? "100%" : "0%";
  }
  return `${Math.min(100, Math.round((current / max) * 100))}%`;
}

export default function OverviewPage() {
  const api = useApi();
  const { accessToken } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<BillingSummary | null>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const data = (await api.get(
          "/api/v1/admin/billing/summary",
        )) as BillingSummary;
        setSummary(data);
      } catch (err: any) {
        setError(err.message || "Không thể tải dữ liệu tổng quan.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [accessToken]);

  const stats = useMemo(() => {
    if (!summary) {
      return [
        { label: "Tin nhắn AI", value: "0", sub: "0%" },
        { label: "Tài liệu RAG", value: "0", sub: "0 MB" },
        { label: "Lưu trữ RAG", value: "0 MB", sub: "0%" },
        { label: "Kết nối SQL", value: "0", sub: "0%" },
      ];
    }

    return [
      {
        label: "Tin nhắn AI",
        value: formatNumber(summary.usage.ai_messages.current),
        sub: formatPercent(
          summary.usage.ai_messages.current,
          summary.usage.ai_messages.limit,
        ),
      },
      {
        label: "Tài liệu RAG",
        value: formatNumber(summary.usage.rag_storage.document_count),
        sub: "documents",
      },
      {
        label: "Lưu trữ RAG",
        value: formatBytes(summary.usage.rag_storage.bytes),
        sub: formatPercent(
          summary.usage.rag_storage.bytes,
          summary.usage.rag_storage.limit_bytes,
        ),
      },
      {
        label: "Kết nối SQL",
        value: formatNumber(summary.usage.sql_connections.current),
        sub: formatPercent(
          summary.usage.sql_connections.current,
          summary.usage.sql_connections.limit,
        ),
      },
    ];
  }, [summary]);

  return (
    <>
      <div className="mb-10">
        <h2 className="text-3xl font-extrabold text-on-surface tracking-tight mb-2">
          Tổng quan hệ thống
        </h2>
        <p className="text-on-surface-variant max-w-2xl">
          Theo dõi nhanh usage hiện tại của tenant từ dữ liệu thật backend.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="bg-surface-container-lowest p-6 rounded-2xl border border-slate-100 shadow-sm"
          >
            <p className="text-sm font-medium text-on-surface-variant mb-1">
              {stat.label}
            </p>
            <h3 className="text-2xl font-black text-on-surface">
              {isLoading ? "..." : stat.value}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {isLoading ? "Đang tải" : stat.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-slate-100 shadow-sm h-[320px] flex flex-col">
            <h3 className="text-lg font-bold mb-6">Usage trạng thái</h3>
            <div className="space-y-4">
              {summary && (
                <>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>AI messages</span>
                      <span>
                        {formatNumber(summary.usage.ai_messages.current)} /{" "}
                        {formatNumber(summary.usage.ai_messages.limit)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500"
                        style={{
                          width: formatPercent(
                            summary.usage.ai_messages.current,
                            summary.usage.ai_messages.limit,
                          ),
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>RAG storage</span>
                      <span>
                        {formatBytes(summary.usage.rag_storage.bytes)} /{" "}
                        {formatBytes(summary.usage.rag_storage.limit_bytes)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{
                          width: formatPercent(
                            summary.usage.rag_storage.bytes,
                            summary.usage.rag_storage.limit_bytes,
                          ),
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>SQL connections</span>
                      <span>
                        {summary.usage.sql_connections.current} /{" "}
                        {summary.usage.sql_connections.limit}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500"
                        style={{
                          width: formatPercent(
                            summary.usage.sql_connections.current,
                            summary.usage.sql_connections.limit,
                          ),
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-slate-100 shadow-sm h-[320px] flex flex-col gap-4">
            <h3 className="text-lg font-bold">Thông tin tenant</h3>
            <div className="text-sm">
              <div className="text-slate-500">Tên</div>
              <div className="font-bold text-slate-800">
                {summary?.tenant.name || "..."}
              </div>
            </div>
            <div className="text-sm">
              <div className="text-slate-500">Email</div>
              <div className="font-bold text-slate-800">
                {summary?.tenant.email || "..."}
              </div>
            </div>
            <div className="text-sm">
              <div className="text-slate-500">Plan</div>
              <div className="font-bold uppercase text-indigo-700">
                {summary?.tenant.plan || "starter"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
