"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";

const STEPS = [
  "Thông tin shop",
  "Kết nối nền tảng",
  "Chế độ bán hàng",
  "Cấu hình widget",
  "Hoàn tất",
];

export default function OnboardingPage() {
  const api = useApi();
  const [step, setStep] = useState(0);
  const [shopName, setShopName] = useState("");
  const [platform, setPlatform] = useState("woocommerce");
  const [salesMode, setSalesMode] = useState("mode_c");
  const [botName, setBotName] = useState("Trợ lý bán hàng");
  const [themeColor, setThemeColor] = useState("#4f46e5");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const progress = useMemo(() => Math.round(((step + 1) / STEPS.length) * 100), [step]);

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const submitOnboarding = async () => {
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await api.post("/api/v1/admin/sales/onboarding/complete", {
        shop_name: shopName.trim(),
        platform,
        sales_mode: salesMode,
        widget: {
          bot_name: botName.trim(),
          theme_color: themeColor,
        },
      });
      setMessage("Hoàn tất onboarding. Bạn có thể bắt đầu sync sản phẩm ở trang Widget bán hàng.");
      setStep(4);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không hoàn tất onboarding được.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold text-on-surface tracking-tight mb-2">Onboarding V2</h2>
        <p className="text-on-surface-variant text-lg max-w-2xl">
          Wizard 5 bước để cấu hình nhanh sales mode cho widget.
        </p>
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

      <div className="rounded-2xl border border-slate-100 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-600">
            Bước {step + 1}/{STEPS.length}: {STEPS[step]}
          </span>
          <span className="text-sm font-semibold text-indigo-700">{progress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-indigo-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {step === 0 && (
          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 space-y-3">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
              placeholder="Tên shop / doanh nghiệp"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
            />
            <p className="text-xs text-slate-500">Tên này dùng để cá nhân hóa assistant và báo cáo.</p>
          </div>
        )}

        {step === 1 && (
          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 space-y-3">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
            >
              <option value="woocommerce">WooCommerce</option>
              <option value="shopify">Shopify</option>
              <option value="generic">REST Generic</option>
            </select>
            <p className="text-xs text-slate-500">Sau khi xong wizard, sang trang Widget bán hàng để nhập credentials.</p>
          </div>
        )}

        {step === 2 && (
          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 space-y-2">
            <label className="flex items-center gap-2">
              <input type="radio" checked={salesMode === "mode_c"} onChange={() => setSalesMode("mode_c")} />
              <span>Mode C (thu lead + chốt qua link/CSKH)</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={salesMode === "mode_b"} onChange={() => setSalesMode("mode_b")} />
              <span>Mode B (giỏ hàng, checkout link)</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={salesMode === "mode_a"} onChange={() => setSalesMode("mode_a")} />
              <span>Mode A (thông tin sản phẩm)</span>
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 space-y-3">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
              placeholder="Tên bot hiển thị"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-600">Màu chủ đạo</label>
              <input
                type="color"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="h-8 w-12 border border-slate-200 rounded"
              />
              <span className="text-xs font-mono">{themeColor}</span>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
            Cấu hình cơ bản đã sẵn sàng. Bước tiếp theo: lưu connector và chạy sync sản phẩm ở trang Widget bán hàng.
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={prev}
            disabled={step === 0}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Quay lại
          </button>
          {step < STEPS.length - 2 ? (
            <button
              type="button"
              onClick={next}
              disabled={(step === 0 && !shopName.trim()) || submitting}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Tiếp tục
            </button>
          ) : step === STEPS.length - 2 ? (
            <button
              type="button"
              onClick={submitOnboarding}
              disabled={!shopName.trim() || submitting}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {submitting ? "Đang hoàn tất…" : "Hoàn tất onboarding"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep(0)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Làm lại wizard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
