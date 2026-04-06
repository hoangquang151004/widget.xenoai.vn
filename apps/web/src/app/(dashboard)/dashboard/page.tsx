"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

type AnalyticsStats = {
  total_user_messages: number;
  document_count: number;
  total_tokens_estimated: number;
  reply_breakdown: { rag: number; sql: number; general: number };
};

type HistoryPoint = { date: string; user_messages: number };

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

function shortDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "short" });
}

export default function OverviewPage() {
  const api = useApi();
  const { accessToken } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsStats | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const [bill, stat, hist] = await Promise.all([
          api.get("/api/v1/admin/billing/summary") as Promise<BillingSummary>,
          api.get("/api/v1/admin/analytics/stats") as Promise<AnalyticsStats>,
          api.get("/api/v1/admin/analytics/history?days=30") as Promise<{
            series: HistoryPoint[];
          }>,
        ]);
        setSummary(bill);
        setAnalytics(stat);
        setHistory(hist.series || []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Không thể tải dữ liệu tổng quan.";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [accessToken]);

  const chartData = useMemo(
    () =>
      history.map((h) => ({
        ...h,
        label: shortDate(h.date),
      })),
    [history],
  );

  const usageStats = useMemo(() => {
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

  const breakdown = analytics?.reply_breakdown;

  return (
    <>
      <div className="mb-10">
        <h2 className="text-3xl font-extrabold text-on-surface tracking-tight mb-2">
          Tổng quan hệ thống
        </h2>
        <p className="text-on-surface-variant max-w-2xl">
          Theo dõi hiệu suất chatbot: tin nhắn, tài liệu, token ước lượng và xu hướng theo
          thời gian (dữ liệu từ cơ sở dữ liệu).
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-sm font-medium text-on-surface-variant mb-1">Tổng tin nhắn</p>
          <h3 className="text-2xl font-black text-on-surface">
            {isLoading ? "..." : formatNumber(analytics?.total_user_messages ?? 0)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Tin từ khách (user) — mọi thời điểm</p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-sm font-medium text-on-surface-variant mb-1">Tài liệu đã upload</p>
          <h3 className="text-2xl font-black text-on-surface">
            {isLoading ? "..." : formatNumber(analytics?.document_count ?? 0)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">File trong kho kiến thức (RAG)</p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-sm font-medium text-on-surface-variant mb-1">Token (ước lượng)</p>
          <h3 className="text-2xl font-black text-on-surface">
            {isLoading ? "..." : formatNumber(analytics?.total_tokens_estimated ?? 0)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Tổng token ghi trên tin assistant</p>
        </div>
      </div>

      {breakdown && !isLoading && (
        <div className="mb-8 rounded-2xl border border-slate-100 bg-surface-container-lowest px-6 py-4 shadow-sm">
          <p className="text-sm font-semibold text-on-surface mb-3">Phản hồi theo kênh (assistant)</p>
          <div className="flex flex-wrap gap-6 text-sm">
            <span>
              <span className="text-emerald-600 font-medium">RAG</span>{" "}
              {formatNumber(breakdown.rag)}
            </span>
            <span>
              <span className="text-indigo-600 font-medium">SQL</span>{" "}
              {formatNumber(breakdown.sql)}
            </span>
            <span>
              <span className="text-slate-600 font-medium">General</span>{" "}
              {formatNumber(breakdown.general)}
            </span>
          </div>
        </div>
      )}

      <div className="mb-10 bg-surface-container-lowest p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-lg font-bold mb-4">Xu hướng tin nhắn (30 ngày gần nhất)</h3>
        <div className="h-[300px] w-full min-h-[280px]">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-slate-500 text-sm">
              Đang tải biểu đồ…
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500 text-sm">
              Chưa có dữ liệu tin nhắn trong khoảng thời gian này.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-slate-500" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                <Tooltip
                  contentStyle={{ borderRadius: 12 }}
                  formatter={(value) => [
                    formatNumber(Number(value ?? 0)),
                    "Tin nhắn",
                  ]}
                  labelFormatter={(_, items) => {
                    const row = items?.[0]?.payload as HistoryPoint | undefined;
                    return row?.date ? `Ngày ${row.date}` : "";
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="user_messages"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={false}
                  name="Tin user / ngày"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {usageStats.map((stat, i) => (
          <div
            key={i}
            className="bg-surface-container-lowest p-6 rounded-2xl border border-slate-100 shadow-sm"
          >
            <p className="text-sm font-medium text-on-surface-variant mb-1">{stat.label}</p>
            <h3 className="text-2xl font-black text-on-surface">
              {isLoading ? "..." : stat.value}
            </h3>
            <p className="text-xs text-slate-500 mt-1">{isLoading ? "Đang tải" : stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-slate-100 shadow-sm h-[320px] flex flex-col">
            <h3 className="text-lg font-bold mb-6">Usage trạng thái (theo gói)</h3>
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
              <div className="font-bold text-slate-800">{summary?.tenant.name || "..."}</div>
            </div>
            <div className="text-sm">
              <div className="text-slate-500">Email</div>
              <div className="font-bold text-slate-800">{summary?.tenant.email || "..."}</div>
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
