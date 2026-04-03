"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";

type WidgetForm = {
  bot_name: string;
  primary_color: string;
  logo_url: string;
  greeting: string;
  placeholder: string;
  position: "bottom-right" | "bottom-left";
  show_sources: boolean;
  font_size: string;
};

type AiForm = {
  system_prompt: string;
  is_rag_enabled: boolean;
  is_sql_enabled: boolean;
  temperature: number;
  max_tokens: number;
};

type MeResponse = {
  public_key: string | null;
  widget: WidgetForm;
  ai_settings: AiForm;
};

const DEFAULT_WIDGET: WidgetForm = {
  bot_name: "Tro ly AI",
  primary_color: "#2563eb",
  logo_url: "",
  greeting: "Xin chao! Toi co the giup gi cho ban?",
  placeholder: "Nhap cau hoi...",
  position: "bottom-right",
  show_sources: true,
  font_size: "14px",
};

const DEFAULT_AI: AiForm = {
  system_prompt: "Ban la mot tro ly AI chuyen nghiep va than thien.",
  is_rag_enabled: true,
  is_sql_enabled: false,
  temperature: 0.7,
  max_tokens: 2048,
};

export default function SettingsPage() {
  const api = useApi();

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingWidget, setIsSavingWidget] = useState(false);
  const [isSavingAi, setIsSavingAi] = useState(false);

  const [publicKey, setPublicKey] = useState<string>("");
  const [widgetForm, setWidgetForm] = useState<WidgetForm>(DEFAULT_WIDGET);
  const [aiForm, setAiForm] = useState<AiForm>(DEFAULT_AI);

  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = (await api.get("/api/v1/admin/me")) as MeResponse;
        setPublicKey(data.public_key || "");
        setWidgetForm({
          ...DEFAULT_WIDGET,
          ...data.widget,
          logo_url: data.widget?.logo_url || "",
        });
        setAiForm({ ...DEFAULT_AI, ...data.ai_settings });
      } catch (err: any) {
        setError(err.message || "Không thể tải cấu hình.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [api]);

  const saveWidget = async () => {
    setError("");
    setMessage("");
    setIsSavingWidget(true);
    try {
      await api.patch("/api/v1/admin/widget", {
        ...widgetForm,
        logo_url: widgetForm.logo_url || null,
      });
      setMessage("Đã lưu cấu hình widget.");
    } catch (err: any) {
      setError(err.message || "Lưu cấu hình widget thất bại.");
    } finally {
      setIsSavingWidget(false);
    }
  };

  const saveAiSettings = async () => {
    setError("");
    setMessage("");
    setIsSavingAi(true);
    try {
      await api.patch("/api/v1/admin/ai-settings", aiForm);
      setMessage("Đã lưu AI settings.");
    } catch (err: any) {
      setError(err.message || "Lưu AI settings thất bại.");
    } finally {
      setIsSavingAi(false);
    }
  };

  const copyPublicKey = async () => {
    if (!publicKey) {
      return;
    }
    try {
      await navigator.clipboard.writeText(publicKey);
      setMessage("Đã sao chép Public Key.");
    } catch {
      setError("Không thể sao chép key trên trình duyệt này.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-on-surface">
            Cấu hình Widget & AI
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Thiết lập giao diện chatbot và hành vi mô hình AI.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl bg-emerald-50 text-emerald-700 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <div className="grid grid-cols-12 gap-8">
        <section className="col-span-12 lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-indigo-600">
                Public Key
              </h3>
              <button
                className="px-4 py-2 text-xs font-bold rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                onClick={copyPublicKey}
                type="button"
              >
                Sao chép
              </button>
            </div>
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-700"
              value={publicKey || "Chưa có public key"}
              readOnly
            />
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-indigo-600">
                Widget Config
              </h3>
              <button
                onClick={saveWidget}
                disabled={isSavingWidget}
                className="bg-indigo-600 text-white px-5 py-2 rounded-full text-xs font-bold disabled:opacity-60"
                type="button"
              >
                {isSavingWidget ? "Đang lưu..." : "Lưu Widget"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                placeholder="Tên bot"
                value={widgetForm.bot_name}
                onChange={(e) =>
                  setWidgetForm((prev) => ({
                    ...prev,
                    bot_name: e.target.value,
                  }))
                }
              />
              <input
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                placeholder="Logo URL (optional)"
                value={widgetForm.logo_url}
                onChange={(e) =>
                  setWidgetForm((prev) => ({
                    ...prev,
                    logo_url: e.target.value,
                  }))
                }
              />
              <input
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm md:col-span-2"
                placeholder="Lời chào"
                value={widgetForm.greeting}
                onChange={(e) =>
                  setWidgetForm((prev) => ({
                    ...prev,
                    greeting: e.target.value,
                  }))
                }
              />
              <input
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm md:col-span-2"
                placeholder="Placeholder"
                value={widgetForm.placeholder}
                onChange={(e) =>
                  setWidgetForm((prev) => ({
                    ...prev,
                    placeholder: e.target.value,
                  }))
                }
              />
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={widgetForm.primary_color}
                  onChange={(e) =>
                    setWidgetForm((prev) => ({
                      ...prev,
                      primary_color: e.target.value,
                    }))
                  }
                  className="w-12 h-12 rounded-lg p-0 border-0"
                />
                <input
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm flex-1"
                  value={widgetForm.primary_color}
                  onChange={(e) =>
                    setWidgetForm((prev) => ({
                      ...prev,
                      primary_color: e.target.value,
                    }))
                  }
                />
              </div>
              <input
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                placeholder="Font size, ví dụ 14px"
                value={widgetForm.font_size}
                onChange={(e) =>
                  setWidgetForm((prev) => ({
                    ...prev,
                    font_size: e.target.value,
                  }))
                }
              />
              <select
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                value={widgetForm.position}
                onChange={(e) =>
                  setWidgetForm((prev) => ({
                    ...prev,
                    position: e.target.value as "bottom-right" | "bottom-left",
                  }))
                }
              >
                <option value="bottom-right">bottom-right</option>
                <option value="bottom-left">bottom-left</option>
              </select>
              <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={widgetForm.show_sources}
                  onChange={(e) =>
                    setWidgetForm((prev) => ({
                      ...prev,
                      show_sources: e.target.checked,
                    }))
                  }
                />
                Hiển thị nguồn trả lời (show_sources)
              </label>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-indigo-600">
                AI Settings
              </h3>
              <button
                onClick={saveAiSettings}
                disabled={isSavingAi}
                className="bg-indigo-600 text-white px-5 py-2 rounded-full text-xs font-bold disabled:opacity-60"
                type="button"
              >
                {isSavingAi ? "Đang lưu..." : "Lưu AI"}
              </button>
            </div>

            <textarea
              className="w-full min-h-[160px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
              value={aiForm.system_prompt}
              onChange={(e) =>
                setAiForm((prev) => ({
                  ...prev,
                  system_prompt: e.target.value,
                }))
              }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={aiForm.is_rag_enabled}
                  onChange={(e) =>
                    setAiForm((prev) => ({
                      ...prev,
                      is_rag_enabled: e.target.checked,
                    }))
                  }
                />
                Bật RAG
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={aiForm.is_sql_enabled}
                  onChange={(e) =>
                    setAiForm((prev) => ({
                      ...prev,
                      is_sql_enabled: e.target.checked,
                    }))
                  }
                />
                Bật SQL
              </label>
              <div>
                <label className="text-xs text-slate-500">
                  Temperature: {aiForm.temperature.toFixed(2)}
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={aiForm.temperature}
                  onChange={(e) =>
                    setAiForm((prev) => ({
                      ...prev,
                      temperature: Number(e.target.value),
                    }))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Max tokens</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                  type="number"
                  min={1}
                  value={aiForm.max_tokens}
                  onChange={(e) =>
                    setAiForm((prev) => ({
                      ...prev,
                      max_tokens: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </section>

        <aside className="col-span-12 lg:col-span-5">
          <div className="sticky top-24 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-black uppercase tracking-wider text-indigo-600 mb-4">
              Live Preview
            </h3>
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div
                className="p-4 text-white"
                style={{ backgroundColor: widgetForm.primary_color }}
              >
                <p className="font-bold">{widgetForm.bot_name}</p>
                <p className="text-xs opacity-90">Online</p>
              </div>
              <div className="p-4 bg-slate-50 min-h-[220px] space-y-3">
                <div className="bg-white rounded-xl p-3 text-sm border border-slate-200">
                  {widgetForm.greeting}
                </div>
                <div className="bg-white rounded-xl p-3 text-xs border border-slate-200 text-slate-500">
                  Vị trí: {widgetForm.position}
                </div>
                <div className="bg-white rounded-xl p-3 text-xs border border-slate-200 text-slate-500">
                  show_sources: {widgetForm.show_sources ? "true" : "false"}
                </div>
              </div>
              <div className="p-3 border-t border-slate-200 bg-white text-xs text-slate-400">
                {widgetForm.placeholder}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
