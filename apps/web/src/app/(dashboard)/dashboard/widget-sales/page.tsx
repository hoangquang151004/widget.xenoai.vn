"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";

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

type SyncLogItem = {
  at: string;
  platform: string;
  mode: "sync" | "sync-index";
  result: string;
};

export default function WidgetSalesPage() {
  const api = useApi();
  const { tenant, refreshTenant } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

  const [salesEnabled, setSalesEnabled] = useState(false);
  const [platform, setPlatform] = useState<"woocommerce" | "shopify" | "generic">(
    "woocommerce",
  );
  const [connectors, setConnectors] = useState<ConnectorRow[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [syncLogs, setSyncLogs] = useState<SyncLogItem[]>([]);

  const [wcSite, setWcSite] = useState("");
  const [wcKey, setWcKey] = useState("");
  const [wcSecret, setWcSecret] = useState("");

  const [shopDomain, setShopDomain] = useState("");
  const [shopToken, setShopToken] = useState("");

  const [genBase, setGenBase] = useState("");
  const [genToken, setGenToken] = useState("");
  const [genProductsPath, setGenProductsPath] = useState("/products");

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
    const hasSyncing = connectors.some((c) => c.sync_status === "syncing");
    if (!hasSyncing) return;
    const tid = setInterval(() => {
      void refresh();
    }, 5000);
    return () => clearInterval(tid);
  }, [connectors, refresh]);

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
      return {
        site_url: wcSite.trim(),
        consumer_key: wcKey.trim(),
        consumer_secret: wcSecret.trim(),
      };
    }
    if (platform === "shopify") {
      return {
        shop_domain: shopDomain.trim(),
        access_token: shopToken.trim(),
      };
    }
    return {
      base_url: genBase.trim(),
      auth_value: genToken.trim(),
    };
  };

  const buildConfig = () => {
    if (platform === "generic") {
      return { products_endpoint: genProductsPath.trim() || "/products" };
    }
    return {};
  };

  const saveConnector = async () => {
    setBusy("save");
    setMessage("");
    setError("");
    try {
      const credentials = buildCredentials();
      await api.post("/api/v1/admin/sales/connector", {
        platform,
        credentials,
        config: buildConfig(),
        is_active: true,
      });
      setMessage("Đã lưu connector.");
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

  const syncNow = async (withIndex: boolean) => {
    const mode: SyncLogItem["mode"] = withIndex ? "sync-index" : "sync";
    setBusy(withIndex ? "syncix" : "sync");
    setMessage("");
    setError("");
    try {
      const path = withIndex
        ? `/api/v1/admin/sales/connector/sync-index?platform=${platform}`
        : `/api/v1/admin/sales/connector/sync?platform=${platform}`;
      const res = (await api.post(path, {})) as { synced: number };
      setMessage(`Đồng bộ xong: ${res.synced ?? 0} sản phẩm.`);
      setSyncLogs((prev) => [
        {
          at: new Date().toISOString(),
          platform,
          mode,
          result: `ok (${res.synced ?? 0})`,
        },
        ...prev,
      ].slice(0, 5));
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Đồng bộ thất bại.");
      setSyncLogs((prev) => [
        {
          at: new Date().toISOString(),
          platform,
          mode,
          result: "failed",
        },
        ...prev,
      ].slice(0, 5));
    } finally {
      setBusy("");
    }
  };

  const wcWebhookUrl = tenant?.id
    ? `${API_URL}/api/v1/webhooks/woocommerce/${tenant.id}`
    : "";

  return (
    <div className="max-w-4xl space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 pb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Widget bán hàng
          </h1>
          <p className="text-slate-500 text-sm mt-2 max-w-xl leading-relaxed">
            Kết nối WooCommerce, Shopify hoặc API generic, đồng bộ sản phẩm và nhận
            lead trên chat. Chi tiết giao diện widget chỉnh tại{" "}
            <Link
              href="/dashboard/settings?tab=widget"
              className="text-indigo-600 font-semibold hover:underline"
            >
              tab Giao diện widget
            </Link>{" "}
            hoặc{" "}
            <Link
              href="/dashboard/settings?tab=sales"
              className="text-indigo-600 font-semibold hover:underline"
            >
              tab Giao diện bán hàng
            </Link>
            .
          </p>
        </div>
      </div>

      {message && (
        <div className="rounded-xl bg-emerald-50 text-emerald-800 px-4 py-3 text-sm border border-emerald-100">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm border border-red-100">
          {error}
        </div>
      )}

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">
          Tổng quan
        </h2>
        {analytics ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
              <div className="text-slate-500 text-xs font-bold uppercase">Đơn</div>
              <div className="text-2xl font-black text-slate-900">
                {analytics.orders_total}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
              <div className="text-slate-500 text-xs font-bold uppercase">
                Sản phẩm (DB)
              </div>
              <div className="text-2xl font-black text-slate-900">
                {analytics.products_count ?? "—"}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 col-span-2 md:col-span-1">
              <div className="text-slate-500 text-xs font-bold uppercase mb-1">
                Theo trạng thái
              </div>
              <div className="text-xs font-mono text-slate-700">
                {Object.entries(analytics.by_status || {})
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ") || "—"}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Đang tải thống kê…</p>
        )}

        <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-100">
          <div>
            <div className="text-sm font-bold text-slate-800">Bật bán hàng trên widget</div>
            <p className="text-xs text-slate-500 mt-0.5">
              Khi tắt, chat chỉ RAG/SQL như cũ.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={salesEnabled}
            disabled={!!busy}
            onClick={() => persistSalesToggle(!salesEnabled)}
            className={`relative w-14 h-8 rounded-full transition-colors ${
              salesEnabled ? "bg-indigo-600" : "bg-slate-300"
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                salesEnabled ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">
          Connector
        </h2>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
            Nền tảng
          </label>
          <select
            value={platform}
            onChange={(e) =>
              setPlatform(e.target.value as "woocommerce" | "shopify" | "generic")
            }
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-full max-w-md bg-white"
          >
            <option value="woocommerce">WooCommerce</option>
            <option value="shopify">Shopify</option>
            <option value="generic">REST generic</option>
          </select>
        </div>

        {platform === "woocommerce" && (
          <div className="space-y-3 max-w-lg">
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Lưu connector sẽ <strong>ghi đè</strong> toàn bộ khóa API. Hãy nhập đủ
              Consumer key/secret trước khi bấm Lưu.
            </p>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Site URL (https://shop.com)"
              value={wcSite}
              onChange={(e) => setWcSite(e.target.value)}
            />
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Consumer key"
              value={wcKey}
              onChange={(e) => setWcKey(e.target.value)}
            />
            <input
              type="password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Consumer secret"
              value={wcSecret}
              onChange={(e) => setWcSecret(e.target.value)}
            />
          </div>
        )}

        {platform === "shopify" && (
          <div className="space-y-3 max-w-lg">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Shop domain (vd: myshop.myshopify.com)"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
            />
            <input
              type="password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Admin API access token"
              value={shopToken}
              onChange={(e) => setShopToken(e.target.value)}
            />
          </div>
        )}

        {platform === "generic" && (
          <div className="space-y-3 max-w-lg">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Base URL API"
              value={genBase}
              onChange={(e) => setGenBase(e.target.value)}
            />
            <input
              type="password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Bearer / API key value"
              value={genToken}
              onChange={(e) => setGenToken(e.target.value)}
            />
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Products path (default /products)"
              value={genProductsPath}
              onChange={(e) => setGenProductsPath(e.target.value)}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={testConnector}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === "test" ? "Đang test…" : "Test kết nối"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={saveConnector}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-indigo-600 disabled:opacity-50"
          >
            {busy === "save" ? "Đang lưu…" : "Lưu connector"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => syncNow(false)}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy === "sync" ? "Đang sync…" : "Sync ngay"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => syncNow(true)}
            className="px-4 py-2 rounded-xl border-2 border-indigo-200 text-indigo-800 text-sm font-semibold hover:bg-indigo-50 disabled:opacity-50"
          >
            {busy === "syncix" ? "Đang sync…" : "Sync + Qdrant"}
          </button>
        </div>

        {connectors.length > 0 && (
          <div className="text-xs text-slate-600 border-t border-slate-100 pt-4 space-y-1">
            <div className="font-bold text-slate-700">Đã cấu hình:</div>
            {connectors.map((c) => (
              <div key={c.id} className="font-mono">
                {c.platform} · sync: {c.sync_status}
                {c.last_synced_at ? ` · ${c.last_synced_at}` : ""}
                {c.sync_error ? ` · lỗi: ${c.sync_error}` : ""}
              </div>
            ))}
          </div>
        )}

        {syncLogs.length > 0 && (
          <div className="text-xs text-slate-600 border-t border-slate-100 pt-4 space-y-2">
            <div className="font-bold text-slate-700">Sync log (5 lần gần nhất):</div>
            {syncLogs.map((log, idx) => (
              <div key={`${log.at}_${idx}`} className="font-mono">
                {new Date(log.at).toLocaleString("vi-VN")} · {log.platform} · {log.mode} ·{" "}
                {log.result}
              </div>
            ))}
          </div>
        )}
      </section>

      {platform === "woocommerce" && wcWebhookUrl && (
        <section className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-2">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">
            Webhook WooCommerce (tùy chọn)
          </h2>
          <p className="text-xs text-slate-600">
            Thêm URL sau vào WooCommerce → Settings → Advanced → Webhooks (order
            updated). Endpoint hiện có xác thực chữ ký HMAC khi đã cấu hình secret.
          </p>
          <div className="flex gap-2 items-center flex-wrap">
            <code className="text-[11px] bg-white px-2 py-1 rounded border border-slate-200 break-all max-w-full">
              {wcWebhookUrl}
            </code>
            <button
              type="button"
              className="text-xs font-bold text-indigo-600 hover:underline"
              onClick={() => {
                void navigator.clipboard.writeText(wcWebhookUrl);
                setMessage("Đã copy URL webhook.");
              }}
            >
              Copy
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
