"use client";

import { useCallback, useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";

type TenantRow = {
  id: string;
  name: string;
  email: string;
  plan: string;
  is_active: boolean;
  created_at: string | null;
};

type ListResponse = {
  total: number;
  items: TenantRow[];
};

function formatPlan(plan: string): string {
  const m: Record<string, string> = {
    starter: "Starter",
    pro: "Pro",
    enterprise: "Enterprise",
    enterprise_pro: "Enterprise Pro",
  };
  return m[plan] || plan;
}

export default function AdminTenantsPage() {
  const api = useApi();
  const { accessToken } = useAuth();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const qs = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const res = (await api.get(
        `/api/v1/platform-admin/tenants${qs}`,
      )) as ListResponse;
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không tải được danh sách.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, search]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (row: TenantRow) => {
    setBusyId(row.id);
    setError("");
    try {
      await api.patch(`/api/v1/platform-admin/tenants/${row.id}`, {
        is_active: !row.is_active,
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Cập nhật thất bại.");
    } finally {
      setBusyId(null);
    }
  };

  const impersonate = async (row: TenantRow) => {
    if (!row.is_active) {
      setError("Không thể đăng nhập hộ tenant đang bị khóa.");
      return;
    }
    if (!confirm(`Đăng nhập dashboard với tư cách "${row.name}"?`)) return;
    setBusyId(row.id);
    setError("");
    try {
      const res = (await api.post("/api/v1/platform-admin/impersonate", {
        tenant_id: row.id,
      })) as { access_token: string };
      localStorage.setItem("access_token", res.access_token);
      window.location.href = "/dashboard";
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Impersonate thất bại.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Khách hàng (Tenants)</h1>
          <p className="text-sm text-slate-500">
            Dữ liệu từ API — kích hoạt / khóa và đăng nhập hộ (impersonate).
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      )}

      <div className="flex gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-xl">
            search
          </span>
          <input
            className="w-full bg-slate-50 border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Tìm theo tên hoặc email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(q)}
          />
        </div>
        <button
          type="button"
          onClick={() => setSearch(q)}
          className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-semibold text-sm hover:bg-indigo-700"
        >
          Tìm
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 text-xs text-slate-500">
          {loading ? "Đang tải…" : `Tổng ${data?.total ?? 0} tenant`}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Tenant &amp; gói</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Email</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Trạng thái</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(data?.items ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{t.name}</div>
                    <div className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">
                      {formatPlan(t.plan)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{t.email}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        t.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      <span
                        className={`w-1 h-1 rounded-full ${t.is_active ? "bg-emerald-500" : "bg-red-500"}`}
                      />
                      {t.is_active ? "Active" : "Locked"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        title="Đăng nhập với tư cách tenant"
                        disabled={busyId === t.id}
                        onClick={() => impersonate(t)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[20px]">login</span>
                      </button>
                      <button
                        type="button"
                        title={t.is_active ? "Khóa tài khoản" : "Kích hoạt"}
                        disabled={busyId === t.id}
                        onClick={() => toggleActive(t)}
                        className={`p-2 rounded-lg disabled:opacity-50 ${
                          t.is_active
                            ? "text-red-400 hover:bg-red-50"
                            : "text-emerald-600 hover:bg-emerald-50"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {t.is_active ? "block" : "check_circle"}
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && (data?.items?.length ?? 0) === 0 && (
          <div className="p-12 text-center text-slate-500 text-sm">Không có tenant nào.</div>
        )}
      </div>
    </div>
  );
}
