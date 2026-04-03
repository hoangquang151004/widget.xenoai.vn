"use client";

import { useEffect, useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";

type ApiKey = {
  id: string;
  key_type: "public" | "admin";
  key_value: string;
  label: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
};

type CreatedKey = {
  id: string;
  key_type: "public" | "admin";
  key_value: string;
  label: string;
  is_active: boolean;
  created_at: string;
};

export default function ApiKeysPage() {
  const api = useApi();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [newKeyType, setNewKeyType] = useState<"public" | "admin">("public");
  const [newKeyLabel, setNewKeyLabel] = useState("Default");
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);

  const loadKeys = async () => {
    setError("");
    try {
      const data = (await api.get("/api/v1/admin/keys")) as ApiKey[];
      setKeys(data || []);
    } catch (err: any) {
      setError(err.message || "Không thể tải danh sách keys.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const createKey = async () => {
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      const data = (await api.post("/api/v1/admin/keys", {
        key_type: newKeyType,
        label: newKeyLabel.trim() || "Default",
      })) as CreatedKey;
      setCreatedKey(data);
      setMessage("Tạo key thành công. Hãy sao chép ngay key vừa tạo.");
      await loadKeys();
    } catch (err: any) {
      setError(err.message || "Tạo key thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const revokeKey = async (key: ApiKey) => {
    if (
      !confirm(
        `Bạn có chắc muốn thu hồi key '${key.label}'? Hành động không thể hoàn tác.`,
      )
    ) {
      return;
    }

    setError("");
    setMessage("");
    try {
      await api.del(`/api/v1/admin/keys/${key.id}`);
      setMessage("Đã thu hồi key thành công.");
      await loadKeys();
    } catch (err: any) {
      setError(err.message || "Thu hồi key thất bại.");
    }
  };

  const copyCreatedKey = async () => {
    if (!createdKey?.key_value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(createdKey.key_value);
      setMessage("Đã sao chép key mới.");
    } catch {
      setError("Không thể sao chép key trên trình duyệt này.");
    }
  };

  const stats = useMemo(() => {
    const total = keys.length;
    const active = keys.filter((k) => k.is_active).length;
    const revoked = total - active;
    return { total, active, revoked };
  }, [keys]);

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-extrabold text-on-surface tracking-tight mb-2">
            Quản lý API Key
          </h2>
          <p className="text-on-surface-variant text-lg leading-relaxed">
            Tạo và thu hồi các key của tenant. Key đầy đủ chỉ hiển thị một lần
            khi vừa tạo.
          </p>
        </div>
        <button
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all duration-200"
          onClick={() => {
            setShowModal(true);
            setCreatedKey(null);
          }}
          type="button"
        >
          <span className="material-symbols-outlined">add</span>
          <span>Tạo Key mới</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-xl bg-emerald-50 text-emerald-700 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Tổng số Keys</p>
          <h4 className="text-2xl font-black text-slate-900">{stats.total}</h4>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">
            Keys đang hoạt động
          </p>
          <h4 className="text-2xl font-black text-emerald-700">
            {stats.active}
          </h4>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Keys đã thu hồi</p>
          <h4 className="text-2xl font-black text-slate-700">
            {stats.revoked}
          </h4>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Danh sách API Keys</h3>
          <div className="text-xs text-slate-500">
            Không chia sẻ admin key ở nơi công khai.
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-slate-100 animate-pulse rounded-xl"
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Label
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Loại key
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Key
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Last used
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {keys.map((key) => (
                  <tr
                    key={key.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {key.label || "Default"}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-700 uppercase font-bold">
                      {key.key_type}
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                        {key.key_value}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          key.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {key.is_active ? "Đang hoạt động" : "Đã thu hồi"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {key.last_used_at || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {key.is_active ? (
                        <button
                          className="text-slate-400 hover:text-error transition-colors"
                          onClick={() => revokeKey(key)}
                          type="button"
                        >
                          <span className="material-symbols-outlined">
                            delete
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Thu hồi</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-slate-900">
                Tạo API Key mới
              </h4>
              <button
                className="text-slate-400"
                onClick={() => setShowModal(false)}
                type="button"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                value={newKeyType}
                onChange={(e) =>
                  setNewKeyType(e.target.value as "public" | "admin")
                }
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
              >
                <option value="public">public</option>
                <option value="admin">admin</option>
              </select>
              <input
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                placeholder="Label"
              />
            </div>

            {!createdKey ? (
              <button
                className="w-full bg-indigo-600 text-white px-5 py-3 rounded-full text-sm font-bold disabled:opacity-60"
                onClick={createKey}
                disabled={isSubmitting}
                type="button"
              >
                {isSubmitting ? "Đang tạo..." : "Tạo key"}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-800">
                  Hãy sao chép key này ngay. Sau khi đóng modal, hệ thống không
                  hiển thị lại key đầy đủ.
                </div>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono"
                  value={createdKey.key_value}
                  readOnly
                />
                <button
                  className="w-full bg-indigo-600 text-white px-5 py-3 rounded-full text-sm font-bold"
                  onClick={copyCreatedKey}
                  type="button"
                >
                  Sao chép key
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
