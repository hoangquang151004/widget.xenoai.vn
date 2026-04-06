"use client";

import { useCallback, useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";

type ServiceStatus = { status: string; detail?: string; workers?: number };

type SystemPayload = {
  overall: string;
  services: Record<string, ServiceStatus>;
};

const LABELS: Record<string, string> = {
  postgresql: "PostgreSQL",
  redis: "Redis",
  qdrant: "Qdrant",
  celery: "Celery workers",
};

export default function AdminHealthPage() {
  const api = useApi();
  const { accessToken } = useAuth();
  const [data, setData] = useState<SystemPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const res = (await api.get("/api/v1/platform-admin/system/status")) as SystemPayload;
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không tải được trạng thái.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const entries = Object.entries(data?.services ?? {});

  return (
    <div className="space-y-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sức khỏe Hệ thống</h1>
          <p className="text-sm text-slate-500">
            Kiểm tra PostgreSQL, Redis, Qdrant và Celery (Bearer Platform Admin).
          </p>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          disabled={loading}
          className="text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 disabled:opacity-50"
        >
          {loading ? "Đang kiểm tra…" : "Làm mới"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <span className="font-bold text-slate-700">Tổng thể: </span>
        <span
          className={
            data?.overall === "ok" ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"
          }
        >
          {loading ? "…" : data?.overall ?? "—"}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Trạng thái dịch vụ</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {entries.map(([key, svc]) => {
            const ok = svc.status === "ok";
            return (
              <div
                key={key}
                className="flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-3 h-3 rounded-full ${ok ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}
                  />
                  <div>
                    <div className="text-sm font-bold text-slate-800">
                      {LABELS[key] || key}
                    </div>
                    {svc.detail && (
                      <div className="text-[10px] text-slate-500 font-mono max-w-md truncate">
                        {svc.detail}
                      </div>
                    )}
                    {typeof svc.workers === "number" && (
                      <div className="text-[10px] text-slate-400">Workers: {svc.workers}</div>
                    )}
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                    ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {ok ? "OK" : "Lỗi / degraded"}
                </span>
              </div>
            );
          })}
          {!loading && entries.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">Không có dữ liệu.</div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Log chi tiết và metric host (CPU/RAM) nên xem trên server hoặc stack observability.
      </p>
    </div>
  );
}
