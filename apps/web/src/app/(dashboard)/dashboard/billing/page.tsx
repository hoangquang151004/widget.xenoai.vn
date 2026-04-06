"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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
    ai_messages: {
      current: number;
      limit: number;
      window?: "month" | "day" | null;
    };
    rag_storage: {
      bytes: number;
      limit_bytes: number;
      document_count: number;
      document_limit?: number | null;
    };
    sql_connections: { current: number; limit: number };
  };
  payment_methods: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
};

const FALLBACK_BILLING: BillingSummary = {
  tenant: { id: "", name: "", email: "", plan: "starter" },
  usage: {
    ai_messages: { current: 0, limit: 50, window: "month" },
    rag_storage: {
      bytes: 0,
      limit_bytes: 15 * 1024 * 1024,
      document_count: 0,
      document_limit: 2,
    },
    sql_connections: { current: 0, limit: 0 },
  },
  payment_methods: [],
  invoices: [],
};

/** Slug gói hiển thị — xem tasks/task_billing_plans.md */
type BillingPlanId = "free" | "basic" | "enterprise" | "enterprise_pro";

const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_SALES_EMAIL ||
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
  "support@example.com";

function billingMailto(subject: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

function tenantPlanToBillingPlan(plan: string): BillingPlanId {
  const p = plan.toLowerCase();
  if (p === "enterprise_pro") return "enterprise_pro";
  if (p === "enterprise") return "enterprise";
  if (p === "pro") return "basic";
  return "free";
}

type PlanDef = {
  id: BillingPlanId;
  title: string;
  blurb: string;
  priceLabel: string;
  priceHint?: string;
  featured: boolean;
  features: string[];
  /** Gói nâng cấp (hiển thị badge / CTA) */
  isUpgrade?: boolean;
};

const PLAN_FREE_BASIC: PlanDef[] = [
  {
    id: "free",
    title: "Miễn phí",
    blurb: "Bắt đầu nhanh với RAG từ tài liệu tải lên.",
    priceLabel: "0đ",
    priceHint: "/tháng",
    featured: false,
    features: [
      "Tư vấn từ tài liệu tải lên",
      "Tối đa 2 tài liệu (khoảng 20 trang, trong giới hạn token)",
      "Tối đa 50 yêu cầu / tháng",
    ],
  },
  {
    id: "basic",
    title: "Cơ bản",
    blurb: "Widget + RAG + tư vấn dữ liệu sản phẩm trong database.",
    priceLabel: "Liên hệ",
    priceHint: "báo giá",
    featured: false,
    features: [
      "Dung lượng tài liệu tính theo 100MB",
      "Tùy chỉnh giao diện widget",
      "Tư vấn từ tài liệu tải lên",
      "Tư vấn thông tin sản phẩm trong database (Text-to-SQL)",
      "Tối đa 400 yêu cầu / ngày",
    ],
  },
];

const PLAN_ENTERPRISE: PlanDef = {
  id: "enterprise",
  title: "Doanh nghiệp",
  blurb: "Nền tảng đầy đủ: nhiều widget, bán hàng trên chatbot và trải nghiệm nâng cao.",
  priceLabel: "Liên hệ",
  priceHint: "theo nhu cầu",
  featured: true,
  features: [
    "2 widget: cửa hàng và admin",
    "Upload tài liệu (phạm vi liên hệ)",
    "Hỗ trợ câu hỏi phức tạp (đa câu hỏi)",
    "Làm sạch dữ liệu trước khi tải lên",
    "Dung lượng tài liệu tính theo 500MB",
    "Tính năng bán hàng trên chatbot",
    "Hỗ trợ tùy chỉnh theo yêu cầu",
    "Text-to-speech (giọng đọc kiểu chat)",
    "Lưu đoạn chat phía client (khách)",
  ],
};

/** Nâng cấp từ gói Doanh nghiệp — giữ toàn bộ tính năng gói 3, bổ sung thêm các hạng mục sau. */
const PLAN_ENTERPRISE_PRO: PlanDef = {
  id: "enterprise_pro",
  title: "Doanh nghiệp Pro",
  blurb:
    "Bản nâng cấp của gói Doanh nghiệp: giữ nguyên mọi tính năng gói 3, thêm dung lượng lớn hơn, lưu hội thoại tập trung và phân tích hành vi.",
  priceLabel: "Liên hệ",
  priceHint: "nâng cấp từ Doanh nghiệp",
  featured: false,
  isUpgrade: true,
  features: [
    "Kế thừa toàn bộ tính năng gói Doanh nghiệp (xem cột bên trái)",
    "Giảm 5% khi mua gói chatbot orchestration nâng cao hàng tháng (theo hợp đồng)",
    "Dung lượng tài liệu tính theo 2GB",
    "Lưu đoạn chat vào database",
    "Phân tích xu hướng mua hàng dựa trên các đoạn chat được lưu",
  ],
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

const PAYMENT_DISABLED_HINT =
  "Tính năng thanh toán tự động đang phát triển — vui lòng liên hệ để đăng ký gói.";

export default function BillingPage() {
  const api = useApi();
  const { accessToken } = useAuth();
  const [data, setData] = useState<BillingSummary>(FALLBACK_BILLING);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payosEnabled, setPayosEnabled] = useState(false);
  const [payosLoading, setPayosLoading] = useState(false);
  const [payosReturn, setPayosReturn] = useState<string | null>(null);

  const handlePayosCheckout = useCallback(
    async (targetPlan: "pro" | "enterprise" | "enterprise_pro") => {
      setPayosLoading(true);
      setError(null);
      try {
        const r = (await api.post("/api/v1/admin/billing/payos/checkout", {
          target_plan: targetPlan,
        })) as { checkout_url?: string };
        if (r.checkout_url) {
          window.location.href = r.checkout_url;
        }
      } catch (err) {
        setError((err as Error).message || "Không tạo được link thanh toán.");
      } finally {
        setPayosLoading(false);
      }
    },
    [api],
  );

  const mailtoPlans = billingMailto("[Widget Chatbot] Tư vấn gói dịch vụ");
  const mailtoCustom = billingMailto(
    "[Widget Chatbot] Cần gói tùy chỉnh / không có gói phù hợp",
  );

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPayosReturn(new URLSearchParams(window.location.search).get("payos"));
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const cfg = (await api.get("/api/v1/admin/billing/payos/config")) as {
          payos_enabled?: boolean;
        };
        if (!cancelled) setPayosEnabled(!!cfg.payos_enabled);
      } catch {
        if (!cancelled) setPayosEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, api]);

  const usageStats = useMemo(() => {
    const aiCurrent = data.usage.ai_messages.current;
    const aiLimit = data.usage.ai_messages.limit;
    const aiWindow = data.usage.ai_messages.window;

    const ragCurrent = data.usage.rag_storage.bytes;
    const ragLimit = data.usage.rag_storage.limit_bytes;
    const docCount = data.usage.rag_storage.document_count;
    const docLimit = data.usage.rag_storage.document_limit;

    const sqlCurrent = data.usage.sql_connections.current;
    const sqlLimit = data.usage.sql_connections.limit;

    const aiPeriod =
      aiLimit > 0
        ? aiWindow === "month"
          ? " / tháng"
          : aiWindow === "day"
            ? " / ngày"
            : ""
        : "";

    const ragDocHint =
      docLimit != null && docLimit > 0
        ? ` · ${formatNumber(docCount)} / ${formatNumber(docLimit)} tài liệu`
        : "";

    return [
      {
        label: "Tin nhắn AI",
        currentText: formatNumber(aiCurrent),
        maxText:
          aiLimit > 0
            ? `${formatNumber(aiLimit)}${aiPeriod}`
            : "Không giới hạn",
        percent: formatPercent(aiCurrent, aiLimit),
        icon: "chat_bubble",
        tone: "primary" as const,
      },
      {
        label: "Lưu trữ RAG",
        currentText: formatMB(ragCurrent),
        maxText:
          (ragLimit > 0 ? formatMB(ragLimit) : "Không giới hạn") + ragDocHint,
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

  const activeBillingPlan = tenantPlanToBillingPlan(data.tenant.plan);
  const invoiceRows = data.invoices;

  const renderPricingCard = (def: PlanDef) => {
    const isCurrent = activeBillingPlan === def.id;
    const showMailtoCta =
      !isCurrent && def.id !== "free" && def.id !== "enterprise_pro";
    const showProMailto = !isCurrent && def.id === "enterprise_pro";
    const showFreeNonCurrent = !isCurrent && def.id === "free";
    const payosTarget =
      def.id === "basic"
        ? ("pro" as const)
        : def.id === "enterprise"
          ? ("enterprise" as const)
          : def.id === "enterprise_pro"
            ? ("enterprise_pro" as const)
            : null;
    const proCtaLabel =
      activeBillingPlan === "enterprise"
        ? "Liên hệ nâng cấp lên Pro"
        : "Liên hệ — Doanh nghiệp Pro";

    const inner = (
      <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-[22px] h-full flex flex-col relative">
        {def.isUpgrade ? (
          <span className="absolute top-4 right-4 px-2 py-0.5 rounded-md bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wide">
            Nâng cấp
          </span>
        ) : null}
        <div className="mb-6">
          <h3 className="text-xl font-bold text-on-surface mb-2 pr-16">
            {def.title}
          </h3>
          <p className="text-on-surface-variant text-sm min-h-[2.75rem] leading-relaxed">
            {def.blurb}
          </p>
          <div className="mt-4 flex items-baseline gap-1 flex-wrap">
            <span
              className={`text-3xl sm:text-4xl font-extrabold ${
                def.featured ? "text-primary" : "text-on-surface"
              }`}
            >
              {def.priceLabel}
            </span>
            {def.priceHint ? (
              <span className="text-on-surface-variant text-sm">
                {def.priceHint}
              </span>
            ) : null}
          </div>
        </div>
        <ul className="text-sm text-on-surface-variant space-y-2.5 mb-8 flex-1 list-none pl-0">
          {def.features.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="material-symbols-outlined text-primary text-[18px] shrink-0">
                check_circle
              </span>
              <span className="leading-snug">{line}</span>
            </li>
          ))}
        </ul>
        {isCurrent ? (
          <button
            type="button"
            disabled
            className="mt-auto w-full py-3 px-6 rounded-full border-2 border-primary/40 text-primary font-semibold opacity-90 cursor-default"
          >
            Gói hiện tại
          </button>
        ) : payosEnabled && payosTarget ? (
          <button
            type="button"
            disabled={payosLoading}
            onClick={() => handlePayosCheckout(payosTarget)}
            className="mt-auto w-full py-3 px-6 rounded-full text-center bg-primary text-on-primary font-bold shadow-lg shadow-primary/30 hover:opacity-90 disabled:opacity-60"
          >
            {payosLoading ? "Đang tạo link…" : `Thanh toán PayOS — ${def.title}`}
          </button>
        ) : def.id === "enterprise" ? (
          <a
            href={mailtoPlans}
            className="mt-auto w-full py-3 px-6 rounded-full text-center bg-primary text-on-primary font-bold shadow-lg shadow-primary/30 hover:opacity-90"
          >
            Liên hệ — Doanh nghiệp
          </a>
        ) : showMailtoCta ? (
          <a
            href={mailtoPlans}
            className="mt-auto w-full py-3 px-6 rounded-full text-center border-2 border-primary text-primary font-semibold hover:bg-primary/5"
          >
            Liên hệ — {def.title}
          </a>
        ) : showProMailto ? (
          <a
            href={mailtoPlans}
            className="mt-auto w-full py-3 px-6 rounded-full text-center border-2 border-primary/40 text-primary font-semibold hover:bg-primary/10"
          >
            {proCtaLabel}
          </a>
        ) : showFreeNonCurrent ? (
          <button
            type="button"
            disabled
            title={PAYMENT_DISABLED_HINT}
            className="mt-auto w-full py-3 px-6 rounded-full border-2 border-outline-variant text-on-surface font-semibold opacity-50 cursor-not-allowed"
          >
            Chọn Miễn phí
          </button>
        ) : null}
      </div>
    );

    if (def.featured) {
      return (
        <div
          key={def.id}
          className={`p-[2px] rounded-2xl shadow-xl relative h-full flex flex-col ${
            isCurrent
              ? "bg-primary shadow-primary/25"
              : "bg-outline-variant/35 shadow-black/10"
          }`}
        >
          {inner}
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-tertiary text-on-tertiary text-[10px] font-bold uppercase tracking-wide z-10">
            Phổ biến
          </span>
        </div>
      );
    }

    return (
      <div
        key={def.id}
        className={`rounded-2xl border flex flex-col transition-all hover:translate-y-[-2px] h-full ${
          def.isUpgrade
            ? "border-primary/25 bg-primary/5"
            : isCurrent
              ? "border-primary/50 shadow-md"
              : "border-outline-variant/10"
        }`}
      >
        {inner}
      </div>
    );
  };

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

        {payosReturn === "success" && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-on-surface">
            Thanh toán đã ghi nhận (hoặc đang xử lý). Nếu gói chưa đổi ngay, vui lòng tải lại
            trang sau vài giây.
          </div>
        )}

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
            Chọn gói phù hợp
          </h2>
          <p className="text-on-surface-variant">
            {payosEnabled
              ? "Bạn có thể thanh toán nâng cấp qua PayOS khi thấy nút tương ứng. Gói sẽ được cập nhật sau khi giao dịch thành công."
              : "So sánh tính năng theo nhu cầu. Khi cổng PayOS được bật trên server, nút thanh toán sẽ xuất hiện; hiện tại vui lòng liên hệ để đăng ký hoặc nâng cấp gói."}
          </p>
        </div>

        {!payosEnabled ? (
          <p className="text-center text-xs text-on-surface-variant max-w-xl mx-auto mb-8">
            {PAYMENT_DISABLED_HINT}
          </p>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
          {PLAN_FREE_BASIC.map((def) => renderPricingCard(def))}

          <div className="md:col-span-2 xl:col-span-2 rounded-2xl border border-outline-variant/15 bg-surface-container-low/40 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 mb-4 text-center">
              <span className="material-symbols-outlined text-primary hidden sm:inline text-[22px]">
                trending_up
              </span>
              <p className="text-sm font-semibold text-on-surface leading-snug">
                <span className="text-primary">Doanh nghiệp Pro</span> là bản{" "}
                <span className="font-bold">nâng cấp</span> của{" "}
                <span className="font-bold">Doanh nghiệp</span> — không thay thế
                gói 3; bạn giữ toàn bộ tính năng gói Doanh nghiệp và bổ sung thêm
                các hạng mục trong cột Pro.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
              {renderPricingCard(PLAN_ENTERPRISE)}
              {renderPricingCard(PLAN_ENTERPRISE_PRO)}
            </div>
          </div>
        </div>

        <div className="mt-12 max-w-xl mx-auto text-center">
          <p className="text-sm text-on-surface-variant mb-4">
            Không thấy gói phù hợp? Chúng tôi có thể thiết kế gói tùy chỉnh theo
            quy mô và tích hợp của bạn.
          </p>
          <a
            href={mailtoCustom}
            className="inline-flex items-center gap-2 bg-surface-container-high text-on-surface px-6 py-3 rounded-full font-bold text-sm border border-outline-variant/20 hover:border-primary/30"
          >
            <span className="material-symbols-outlined text-[20px]">mail</span>
            Liên hệ tư vấn
          </a>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-16">
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-on-surface">
              Phương thức thanh toán
            </h2>
            <button
              type="button"
              disabled
              title={PAYMENT_DISABLED_HINT}
              className="text-primary font-semibold text-sm opacity-50 cursor-not-allowed"
            >
              Thêm thẻ mới
            </button>
          </div>
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 shadow-sm">
            <p className="text-sm text-on-surface-variant">
              Chưa có dữ liệu phương thức thanh toán. {PAYMENT_DISABLED_HINT}
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
                {invoiceRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-10 text-sm text-on-surface-variant text-center"
                    >
                      Chưa có hóa đơn từ backend. Lịch sử giao dịch sẽ hiển thị
                      khi đã tích hợp cổng thanh toán.
                    </td>
                  </tr>
                ) : (
                  invoiceRows.map((inv, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-surface-container-low/30 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-on-surface">
                        {String(inv.id ?? "N/A")}
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">
                        {String(inv.date ?? "N/A")}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-on-surface">
                        {String(inv.amount ?? "—")}
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">
                        {String(inv.status ?? "N/A")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
