"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";

// --- Types ---
type ConnectorRow = {
  id: string;
  platform: string;
  is_active: boolean;
  config: Record<string, unknown>;
  credentials_preview: Record<string, string>;
  sync_status: string;
  sync_error: string | null;
  last_synced_at: string | null;
};

type Analytics = {
  orders_total: number;
  by_status: Record<string, number>;
  products_count: number | null;
};

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type GenericEndpoint = {
  code: string;
  label: string;
  method: HttpMethod;
  path: string;
  path_template: string;
  query_template: string;
  body_template: string;
  enabled: boolean;
};

type ParameterItem = {
  key: string;
  value: string;
};

type EndpointTestState = {
  status: "idle" | "running" | "pass" | "fail";
  message?: string;
  details?: string;
  latencyMs?: number;
  at?: string;
};

// --- Constants ---
const REQUIRED_GENERIC_CODES = ["products", "create_order", "order_history"] as const;
const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const DEFAULT_GENERIC_ENDPOINTS: GenericEndpoint[] = [
  {
    code: "products",
    label: "Products API",
    method: "GET",
    path: "/products",
    path_template: "/products",
    query_template: '{"page":"{page}","limit":"{limit}","q":"{q}"}',
    body_template: "",
    enabled: false,
  },
  {
    code: "create_order",
    label: "Create Order API",
    method: "POST",
    path: "/orders",
    path_template: "/orders",
    query_template: "{}",
    body_template:
      '{"payload":{"customer_name":"{customer_name}","customer_phone":"{customer_phone}","customer_address":"{customer_address}","customer_email":"{customer_email}","items":"{items}","note":"{note}","payment_method":"{payment_method}"}}',
    enabled: false,
  },
  {
    code: "order_history",
    label: "Order History API",
    method: "GET",
    path: "/orders",
    path_template: "/orders",
    query_template: '{"phone":"{customer_phone}","order_id":"{external_order_id}"}',
    body_template: "",
    enabled: false,
  },
];

// --- Components ---

const Badge = ({ children, color = "blue" }: { children: React.ReactNode; color?: string }) => {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    orange: "bg-orange-50 text-orange-700 border-orange-100",
    red: "bg-red-50 text-red-700 border-red-100",
    purple: "bg-purple-50 text-purple-700 border-purple-100",
    slate: "bg-slate-50 text-slate-700 border-slate-100",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${colors[color] || colors.blue}`}>
      {children}
    </span>
  );
};

const Switch = ({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
      checked ? "bg-indigo-600" : "bg-slate-200"
    } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    <span
      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

const Card = ({ title, children, extra, subtitle }: { title: string; children: React.ReactNode; extra?: React.ReactNode; subtitle?: string }) => (
  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
      <div>
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {extra}
    </div>
    <div className="p-6">{children}</div>
  </section>
);

export default function WidgetSalesPage() {
  const api = useApi();
  const { tenant, refreshTenant } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

  // --- State ---
  const [salesEnabled, setSalesEnabled] = useState(false);
  const [platform, setPlatform] = useState<"woocommerce" | "shopify" | "generic">("woocommerce");
  const [connectors, setConnectors] = useState<ConnectorRow[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [didAutoSelectPlatform, setDidAutoSelectPlatform] = useState(false);

  // Connectors config
  const [wcSite, setWcSite] = useState("");
  const [wcKey, setWcKey] = useState("");
  const [wcSecret, setWcSecret] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [shopToken, setShopToken] = useState("");
  const [genBase, setGenBase] = useState("");
  const [genToken, setGenToken] = useState("");
  const [genAuthType, setGenAuthType] = useState<"bearer" | "api_key">("bearer");
  const [genericEndpoints, setGenericEndpoints] = useState<GenericEndpoint[]>(DEFAULT_GENERIC_ENDPOINTS);

  // UI State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [tempEndpoint, setTempEndpoint] = useState<GenericEndpoint | null>(null);
  const [tempParams, setTempParams] = useState<ParameterItem[]>([]);
  const [endpointTests, setEndpointTests] = useState<Record<string, EndpointTestState>>({});

  // --- Helpers ---
  const jsonToParams = (jsonStr: string): ParameterItem[] => {
    try {
      const obj = JSON.parse(jsonStr || "{}");
      return Object.entries(obj).map(([key, value]) => ({ key, value: String(value) }));
    } catch {
      return [];
    }
  };

  const paramsToJson = (params: ParameterItem[]): string => {
    const obj: Record<string, string> = {};
    params.forEach((p) => {
      if (p.key.trim()) obj[p.key.trim()] = p.value;
    });
    return JSON.stringify(obj);
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET": return "green";
      case "POST": return "blue";
      case "PUT": return "orange";
      case "DELETE": return "red";
      default: return "slate";
    }
  };

  // --- Logic ---
  const refresh = useCallback(async () => {
    setError("");
    try {
      const [conn, stat] = await Promise.all([
        api.get("/api/v1/admin/sales/connector") as Promise<ConnectorRow[]>,
        api.get("/api/v1/admin/sales/analytics?days=30") as Promise<Analytics>,
      ]);
      setConnectors(Array.isArray(conn) ? conn : []);
      setAnalytics(stat);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu bán hàng.");
    }
  }, [api]);

  useEffect(() => {
    setSalesEnabled(!!tenant?.sales_enabled);
  }, [tenant?.sales_enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setEndpointTests({});
    const selected = connectors.find((c) => c.platform === platform);
    if (!selected) {
      if (platform === "generic") {
        setGenBase("");
        setGenToken("");
        setGenAuthType("bearer");
        setGenericEndpoints(DEFAULT_GENERIC_ENDPOINTS);
      }
      return;
    }
    if (platform === "woocommerce") {
      const preview = selected.credentials_preview || {};
      setWcSite(String(preview.site_url || ""));
      return;
    }
    if (platform === "shopify") {
      const preview = selected.credentials_preview || {};
      setShopDomain(String(preview.shop_domain || ""));
      return;
    }
    const preview = selected.credentials_preview || {};
    const cfg = (selected.config || {}) as Record<string, unknown>;
    setGenBase(String(preview.base_url || ""));
    setGenAuthType(String(cfg.auth_type || "bearer") === "api_key" ? "api_key" : "bearer");
    const rawEndpoints = cfg.endpoints;
    if (!Array.isArray(rawEndpoints)) {
      setGenericEndpoints(DEFAULT_GENERIC_ENDPOINTS);
      return;
    }
    const mapped = rawEndpoints
      .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
      .map((row) => {
        const method = String(row.method || "GET").toUpperCase();
        return {
          code: String(row.code || "").trim().toLowerCase(),
          label: String(row.label || "").trim(),
          method: HTTP_METHODS.includes(method as HttpMethod) ? (method as HttpMethod) : "GET",
          path: String(row.path || "").trim(),
          path_template: String(row.path_template || row.path || "").trim(),
          query_template: JSON.stringify(
            row.query_template && typeof row.query_template === "object" ? row.query_template : {},
          ),
          body_template: row.body_template ? JSON.stringify(row.body_template) : "",
          enabled: row.enabled !== false,
        } satisfies GenericEndpoint;
      })
      .filter((row) => !!row.code);
    setGenericEndpoints(mapped.length ? mapped : DEFAULT_GENERIC_ENDPOINTS);
  }, [platform, connectors]);

  useEffect(() => {
    if (didAutoSelectPlatform) return;
    if (connectors.length === 0) return;
    const ranked = [...connectors]
      .filter((c) => c.is_active)
      .sort((a, b) => {
        const ta = a.last_synced_at ? Date.parse(a.last_synced_at) : 0;
        const tb = b.last_synced_at ? Date.parse(b.last_synced_at) : 0;
        return tb - ta;
      });
    const target = ranked[0] ?? connectors[0];
    if (
      target &&
      (target.platform === "woocommerce" ||
        target.platform === "shopify" ||
        target.platform === "generic")
    ) {
      setPlatform(target.platform);
    }
    setDidAutoSelectPlatform(true);
  }, [connectors, didAutoSelectPlatform]);

  const persistSalesToggle = async (next: boolean) => {
    setBusy("toggle");
    setMessage("");
    setError("");
    try {
      await api.patch("/api/v1/admin/me", { sales_enabled: next });
      setSalesEnabled(next);
      await refreshTenant();
      setMessage(next ? "Đã bật chế độ bán hàng." : "Đã tắt chế độ bán hàng.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không lưu được.");
    } finally {
      setBusy("");
    }
  };

  const buildCredentials = () => {
    if (platform === "woocommerce") {
      return { site_url: wcSite.trim(), consumer_key: wcKey.trim(), consumer_secret: wcSecret.trim() };
    }
    if (platform === "shopify") {
      return { shop_domain: shopDomain.trim(), access_token: shopToken.trim() };
    }
    const token = genToken.trim();
    const safeToken = token === "********" ? "" : token;
    return { base_url: genBase.trim(), auth_value: safeToken, auth_type: genAuthType };
  };

  const buildConfig = () => {
    if (platform === "generic") {
      const endpoints = genericEndpoints.map((ep) => ({
        code: ep.code.trim().toLowerCase(),
        label: ep.label.trim() || ep.code.trim().toLowerCase(),
        method: ep.method,
        path: ep.path.trim(),
        path_template: ep.path_template.trim() || ep.path.trim(),
        query_template: ep.query_template.trim() ? JSON.parse(ep.query_template) : {},
        body_template: ep.body_template.trim() ? JSON.parse(ep.body_template) : null,
        enabled: ep.enabled,
      }));
      const products = endpoints.find((ep) => ep.code === "products");
      const createOrder = endpoints.find((ep) => ep.code === "create_order");
      const orderHistory = endpoints.find((ep) => ep.code === "order_history");
      return {
        auth_type: genAuthType,
        endpoints,
        products_endpoint: products?.path || "/products",
        order_endpoint: createOrder?.path || "",
        order_history_endpoint: orderHistory?.path || "",
      };
    }
    return {};
  };

  const validateGenericConfig = (): string | null => {
    if (platform !== "generic") return null;
    if (!genBase.trim()) return "Base URL API là bắt buộc.";
    const seen = new Set<string>();
    for (const endpoint of genericEndpoints) {
      const code = endpoint.code.trim().toLowerCase();
      if (!code) return "Mỗi endpoint phải có code.";
      if (seen.has(code)) return `Code endpoint bị trùng: ${code}`;
      seen.add(code);
      if (!HTTP_METHODS.includes(endpoint.method)) return `Method không hợp lệ cho endpoint ${code}.`;
      const path = endpoint.path.trim();
      if (!path.startsWith("/")) return `Path của endpoint ${code} phải bắt đầu bằng '/'.`;
      if (endpoint.enabled && code === "create_order" && !endpoint.body_template.trim()) {
        return "Endpoint create_order đang bật nhưng thiếu body_template.";
      }
    }
    return null;
  };

  const handleEditEndpoint = (idx: number) => {
    setEditingIdx(idx);
    const ep = genericEndpoints[idx];
    setTempEndpoint({ ...ep });
    setTempParams(jsonToParams(ep.query_template));
    setDrawerOpen(true);
  };

  const handleAddEndpoint = () => {
    setEditingIdx(null);
    setTempEndpoint({
      code: "",
      label: "",
      method: "GET",
      path: "/",
      path_template: "/",
      query_template: "{}",
      body_template: "",
      enabled: false,
    });
    setTempParams([]);
    setDrawerOpen(true);
  };

  const saveTempEndpoint = () => {
    if (!tempEndpoint) return;
    const finalEp = {
      ...tempEndpoint,
      query_template: paramsToJson(tempParams),
    };

    if (editingIdx !== null) {
      setGenericEndpoints((prev) => prev.map((row, idx) => (idx === editingIdx ? finalEp : row)));
    } else {
      setGenericEndpoints((prev) => [...prev, finalEp]);
    }
    setDrawerOpen(false);
  };

  const removeEndpoint = (idx: number) => {
    const target = genericEndpoints[idx];
    if (REQUIRED_GENERIC_CODES.includes(target.code as any)) return;
    setGenericEndpoints((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleEndpoint = (idx: number, enabled: boolean) => {
    setGenericEndpoints((prev) => prev.map((row, i) => (i === idx ? { ...row, enabled } : row)));
  };

  const saveConnector = async () => {
    setBusy("save");
    setMessage("");
    setError("");
    try {
      const validationError = validateGenericConfig();
      if (validationError) {
        setError(validationError);
        return;
      }
      await api.post("/api/v1/admin/sales/connector", {
        platform,
        credentials: buildCredentials(),
        config: buildConfig(),
        is_active: true,
      });
      setMessage("Đã lưu connector.");
      setEndpointTests({});
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lưu thất bại.");
    } finally {
      setBusy("");
    }
  };

  const testConnector = async () => {
    setBusy("test");
    setMessage("");
    setError("");
    try {
      const validationError = validateGenericConfig();
      if (validationError) {
        setError(validationError);
        return;
      }
      await api.post("/api/v1/admin/sales/connector/test", {
        platform,
        credentials: buildCredentials(),
        config: buildConfig(),
      });
      setMessage("Kết nối thử thành công.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Test thất bại.");
    } finally {
      setBusy("");
    }
  };

  const testSingleEndpoint = async (idx: number) => {
    const ep = genericEndpoints[idx];
    if (!ep) return;
    const code = ep.code.trim().toLowerCase();
    if (!code) return;
    if (platform !== "generic") return;
    if (!genBase.trim()) {
      setEndpointTests((prev) => ({
        ...prev,
        [code]: { status: "fail", message: "Thiếu Base URL API.", at: new Date().toISOString() },
      }));
      return;
    }
    try {
      if (ep.query_template.trim()) JSON.parse(ep.query_template);
      if (ep.body_template.trim()) JSON.parse(ep.body_template);
    } catch {
      setEndpointTests((prev) => ({
        ...prev,
        [code]: {
          status: "fail",
          message: "query_template / body_template không phải JSON hợp lệ.",
          at: new Date().toISOString(),
        },
      }));
      return;
    }

    setEndpointTests((prev) => ({ ...prev, [code]: { status: "running" } }));
    try {
      const res = (await api.post("/api/v1/admin/sales/connector/test-endpoint", {
        platform,
        credentials: buildCredentials(),
        config: buildConfig(),
        code,
      })) as {
        ok: boolean;
        message?: string;
        details?: unknown;
        latency_ms?: number;
      };
      setEndpointTests((prev) => ({
        ...prev,
        [code]: {
          status: res.ok ? "pass" : "fail",
          message: res.message || (res.ok ? "Pass" : "Fail"),
          details: res.details ? JSON.stringify(res.details) : undefined,
          latencyMs: res.latency_ms,
          at: new Date().toISOString(),
        },
      }));
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "Test thất bại.";
      setEndpointTests((prev) => ({
        ...prev,
        [code]: {
          status: "fail",
          message: errMsg,
          at: new Date().toISOString(),
        },
      }));
    }
  };

  const lastSyncInfo = useMemo(() => {
    const c = connectors.find((c) => c.platform === platform);
    if (!c) return null;
    return { status: c.sync_status, time: c.last_synced_at };
  }, [connectors, platform]);

  const wcWebhookUrl = tenant?.id ? `${API_URL}/api/v1/webhooks/woocommerce/${tenant.id}` : "";

  return (
    <div className="min-h-screen bg-gray-50/50 -m-8 p-8">
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Cấu hình Bán hàng
            </h1>
            <p className="text-slate-500 text-sm mt-1">Quản lý kết nối API và thiết lập widget bán hàng.</p>
          </div>
          <div className="flex items-center gap-3 bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm">
             <div className="px-3 py-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase block leading-none mb-1">Trạng thái Widget</span>
                <span className={`text-xs font-bold ${salesEnabled ? "text-emerald-600" : "text-slate-400"}`}>
                  {salesEnabled ? "● Đang bật" : "○ Đang tắt"}
                </span>
             </div>
             <Switch checked={salesEnabled} onChange={persistSalesToggle} disabled={!!busy} />
          </div>
        </div>

        {/* Alerts */}
        {(message || error) && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${message ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-red-50 border-red-100 text-red-800"}`}>
            <div className="mt-0.5">
              {message ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              )}
            </div>
            <p className="text-sm font-medium">{message || error}</p>
            <button onClick={() => {setMessage(""); setError("");}} className="ml-auto text-current opacity-50 hover:opacity-100"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        )}

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Đơn hàng</span>
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">{analytics?.orders_total ?? 0}</div>
            <div className="mt-1 text-[10px] text-slate-500 font-mono overflow-hidden text-ellipsis whitespace-nowrap">
               {analytics && Object.entries(analytics.by_status).map(([k,v]) => `${k}: ${v}`).join(" | ")}
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sản phẩm (DB)</span>
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">{analytics?.products_count ?? "—"}</div>
            <div className="mt-1 text-xs text-slate-400">Đã đồng bộ vào hệ thống</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Đồng bộ cuối</span>
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <div className="text-lg font-bold text-slate-900 truncate">{lastSyncInfo?.time ? new Date(lastSyncInfo.time).toLocaleString("vi-VN") : "Chưa có"}</div>
            <div className="mt-1 flex items-center gap-1.5">
               <span className={`w-2 h-2 rounded-full ${lastSyncInfo?.status === "ok" ? "bg-emerald-500" : lastSyncInfo?.status === "syncing" ? "bg-blue-500 animate-pulse" : "bg-slate-300"}`}></span>
               <span className="text-xs text-slate-500 capitalize">{lastSyncInfo?.status || "n/a"}</span>
            </div>
          </div>
        </div>

        {/* Global Settings Card */}
        <Card title="Cấu hình chung" subtitle="Thông tin cơ bản về nền tảng và endpoint API">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Nền tảng</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              >
                <option value="woocommerce">WooCommerce</option>
                <option value="shopify">Shopify</option>
                <option value="generic">REST Generic</option>
              </select>
            </div>

            {platform === "generic" ? (
              <>
                <div className="space-y-1.5 lg:col-span-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Base URL API</label>
                  <input
                    type="text"
                    value={genBase}
                    onChange={(e) => setGenBase(e.target.value)}
                    placeholder="https://api.yourshop.com/v1"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Loại Auth</label>
                  <select
                    value={genAuthType}
                    onChange={(e) => setGenAuthType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  >
                    <option value="bearer">Bearer Token</option>
                    <option value="api_key">API Key Header</option>
                  </select>
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Token / API Key</label>
                  <input
                    type="password"
                    value={genToken}
                    onChange={(e) => setGenToken(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  />
                </div>
              </>
            ) : platform === "woocommerce" ? (
              <>
                <div className="space-y-1.5 lg:col-span-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Site URL</label>
                  <input
                    type="text"
                    value={wcSite}
                    onChange={(e) => setWcSite(e.target.value)}
                    placeholder="https://shop.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Consumer Key</label>
                  <input
                    type="text"
                    value={wcKey}
                    onChange={(e) => setWcKey(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Consumer Secret</label>
                  <input
                    type="password"
                    value={wcSecret}
                    onChange={(e) => setWcSecret(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5 lg:col-span-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Shop Domain</label>
                  <input
                    type="text"
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                    placeholder="myshop.myshopify.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5 lg:col-span-3">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Admin API Access Token</label>
                  <input
                    type="password"
                    value={shopToken}
                    onChange={(e) => setShopToken(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  />
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Endpoints Table Card (Only for Generic) */}
        {platform === "generic" && (
          <Card
            title="Danh sách API Endpoints"
            subtitle="Cần cấu hình các code: products, create_order, order_history"
            extra={
              <button
                onClick={handleAddEndpoint}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Thêm API
              </button>
            }
          >
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mã API</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tên API</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Method</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Endpoint</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Trạng thái</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {genericEndpoints.map((ep, idx) => {
                    const codeKey = ep.code.trim().toLowerCase();
                    const testInfo = endpointTests[codeKey];
                    const tooltip = testInfo
                      ? `${testInfo.message || ""}${
                          testInfo.details ? `\n${testInfo.details}` : ""
                        }${testInfo.latencyMs != null ? `\n${testInfo.latencyMs} ms` : ""}`
                      : "";
                    return (
                      <tr key={ep.code + idx} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <code className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {ep.code}
                          </code>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-700">{ep.label}</td>
                        <td className="px-6 py-4">
                          <Badge color={getMethodColor(ep.method)}>{ep.method}</Badge>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-500 truncate max-w-[150px]">{ep.path}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-center gap-1.5">
                            <Switch checked={ep.enabled} onChange={(v) => toggleEndpoint(idx, v)} />
                            {testInfo && testInfo.status !== "idle" && (
                              <div title={tooltip} className="leading-none">
                                {testInfo.status === "running" && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <circle cx="12" cy="12" r="10" strokeWidth="3" className="opacity-25" />
                                      <path strokeLinecap="round" strokeWidth="3" d="M22 12a10 10 0 00-10-10" className="opacity-75" />
                                    </svg>
                                    Đang test
                                  </span>
                                )}
                                {testInfo.status === "pass" && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.704 5.296a1 1 0 010 1.408l-8 8a1 1 0 01-1.408 0l-4-4a1 1 0 011.408-1.408L8 12.584l7.296-7.288a1 1 0 011.408 0z" clipRule="evenodd" /></svg>
                                    Pass{testInfo.latencyMs != null ? ` · ${testInfo.latencyMs}ms` : ""}
                                  </span>
                                )}
                                {testInfo.status === "fail" && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded max-w-[180px] truncate">
                                    <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                    <span className="truncate">Fail</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => testSingleEndpoint(idx)}
                              disabled={testInfo?.status === "running"}
                              className="p-1.5 hover:bg-indigo-100 rounded-lg text-indigo-600 transition-colors disabled:opacity-50"
                              title="Test endpoint này"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </button>
                            <button onClick={() => handleEditEndpoint(idx)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors" title="Chỉnh sửa">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            {!REQUIRED_GENERIC_CODES.includes(ep.code as any) && (
                              <button onClick={() => removeEndpoint(idx)} className="p-1.5 hover:bg-red-100 rounded-lg text-red-600 transition-colors" title="Xóa">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Footer Actions */}
        <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white/80 backdrop-blur-md border-t border-slate-200 px-8 py-4 z-10">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div className="hidden md:block">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Connector Status</span>
               <p className="text-xs text-slate-600">
                  {platform} • sync: <span className="font-bold uppercase">{lastSyncInfo?.status || "n/a"}</span>
               </p>
             </div>
             <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={!!busy}
                  onClick={testConnector}
                  className="px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all"
                >
                  {busy === "test" ? "Đang test..." : "Test kết nối"}
                </button>
                <button
                  disabled={!!busy}
                  onClick={saveConnector}
                  className="px-4 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-black rounded-lg transition-all shadow-md shadow-slate-900/10"
                >
                  {busy === "save" ? "Đang lưu..." : "Lưu connector"}
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* Modal for Endpoint Detail */}
      {drawerOpen && tempEndpoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{editingIdx !== null ? "Chỉnh sửa API" : "Thêm API mới"}</h3>
                <p className="text-xs text-slate-500">Cấu hình chi tiết cho endpoint của bạn</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Mã API (Code)</label>
                  <input
                    type="text"
                    disabled={REQUIRED_GENERIC_CODES.includes(tempEndpoint.code as any)}
                    value={tempEndpoint.code}
                    onChange={(e) => setTempEndpoint({ ...tempEndpoint, code: e.target.value.toLowerCase().trim() })}
                    placeholder="vd: products"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm disabled:opacity-50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Tên hiển thị</label>
                  <input
                    type="text"
                    value={tempEndpoint.label}
                    onChange={(e) => setTempEndpoint({ ...tempEndpoint, label: e.target.value })}
                    placeholder="vd: Danh sách sản phẩm"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Method</label>
                  <select
                    value={tempEndpoint.method}
                    onChange={(e) => setTempEndpoint({ ...tempEndpoint, method: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  >
                    {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Endpoint Path</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-sm">/</span>
                    <input
                      type="text"
                      value={tempEndpoint.path.startsWith("/") ? tempEndpoint.path.substring(1) : tempEndpoint.path}
                      onChange={(e) => setTempEndpoint({ ...tempEndpoint, path: "/" + e.target.value.replace(/^\//, "") })}
                      placeholder="products"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-2">
                    Tham số (Query Params)
                    <Badge color="slate">Optional</Badge>
                  </label>
                  <button
                    onClick={() => setTempParams([...tempParams, { key: "", value: "" }])}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Thêm tham số
                  </button>
                </div>
                <div className="space-y-2">
                  {tempParams.map((p, pIdx) => (
                    <div key={pIdx} className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={p.key}
                          onChange={(e) => setTempParams(tempParams.map((item, i) => i === pIdx ? { ...item, key: e.target.value } : item))}
                          placeholder="Key (vd: limit)"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={p.value}
                          onChange={(e) => setTempParams(tempParams.map((item, i) => i === pIdx ? { ...item, value: e.target.value } : item))}
                          placeholder="Value (vd: {limit})"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <button
                        onClick={() => setTempParams(tempParams.filter((_, i) => i !== pIdx))}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))}
                  {tempParams.length === 0 && (
                    <div className="text-xs text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-xl bg-white/50">
                      Chưa có tham số nào được thiết lập.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Body Template (JSON)</label>
                <textarea
                  value={tempEndpoint.body_template}
                  onChange={(e) => setTempEndpoint({ ...tempEndpoint, body_template: e.target.value })}
                  placeholder='{"payload": {"customer_name": "{customer_name}"}}'
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 text-sm font-mono min-h-[140px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 sticky bottom-0 z-10">
              <button 
                onClick={() => setDrawerOpen(false)} 
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={saveTempEndpoint} 
                className="px-8 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-md shadow-indigo-600/20 active:scale-95"
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
