"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

type DocumentInfo = {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  uploaded_at: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const STORAGE_LIMIT_BYTES = 50 * 1024 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatusMeta(status: string): { label: string; className: string } {
  const normalized = status.toLowerCase();
  if (normalized === "done") {
    return { label: "Thành công", className: "bg-green-100 text-green-700" };
  }
  if (normalized === "processing" || normalized === "pending") {
    return { label: "Đang xử lý", className: "bg-amber-100 text-amber-700" };
  }
  if (normalized === "error") {
    return { label: "Lỗi", className: "bg-red-100 text-red-700" };
  }
  return { label: status, className: "bg-slate-100 text-slate-600" };
}

export default function KnowledgeBasePage() {
  const { accessToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingName, setUploadingName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadDocuments = async (showLoading = false) => {
    if (!accessToken) return;
    if (showLoading) setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/v1/files/list`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Không thể tải danh sách tài liệu.");
      }

      const data: DocumentInfo[] = await response.json();
      setDocuments(data);
    } catch (err) {
      setError((err as Error).message || "Lỗi kết nối backend.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    const hasRunningJobs = documents.some((doc) => {
      const status = doc.status.toLowerCase();
      return status === "pending" || status === "processing";
    });

    if (!hasRunningJobs || !accessToken) return;

    const timer = setInterval(() => {
      loadDocuments(false);
    }, 5000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, accessToken]);

  const handleUpload = async (file: File) => {
    if (!accessToken) return;

    setError(null);
    setSuccess(null);
    setIsUploading(true);
    setUploadingName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/api/v1/files/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.detail || "Upload thất bại.");
      }

      setSuccess("Tải lên thành công. Hệ thống đang xử lý tài liệu.");
      await loadDocuments(false);
    } catch (err) {
      setError((err as Error).message || "Upload thất bại.");
    } finally {
      setIsUploading(false);
      setUploadingName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (doc: DocumentInfo) => {
    if (!accessToken) return;

    const accepted = window.confirm(`Xóa tài liệu ${doc.filename}?`);
    if (!accepted) return;

    setDeletingId(doc.id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/files/${doc.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.detail || "Không thể xóa tài liệu.");
      }

      setSuccess(`Đã xóa ${doc.filename}.`);
      await loadDocuments(false);
    } catch (err) {
      setError((err as Error).message || "Không thể xóa tài liệu.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDocuments = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return documents;
    return documents.filter((doc) =>
      doc.filename.toLowerCase().includes(keyword),
    );
  }, [documents, searchTerm]);

  const storageUsedBytes = useMemo(
    () => documents.reduce((sum, doc) => sum + Number(doc.file_size || 0), 0),
    [documents],
  );

  const storagePercent = Math.min(
    100,
    (storageUsedBytes / STORAGE_LIMIT_BYTES) * 100,
  );

  return (
    <>
      <div className="mb-10">
        <h2 className="text-3xl font-extrabold text-on-surface tracking-tight mb-2">
          Cơ sở kiến thức (RAG)
        </h2>
        <p className="text-on-surface-variant max-w-2xl">
          Quản lý và huấn luyện mô hình AI của bạn bằng cách tải lên các tài
          liệu nghiệp vụ. Hệ thống sẽ tự động phân tách và lập chỉ mục dữ liệu.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12 xl:col-span-8">
          <div className="bg-surface-container-lowest rounded-xl p-8 shadow-sm border border-slate-100 h-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  cloud_upload
                </span>
                Tải lên tài liệu mới
              </h3>
              <span className="text-xs font-medium text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full">
                Hỗ trợ mọi định dạng phổ biến
              </span>
            </div>

            <label className="border-2 border-dashed border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center text-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-primary text-3xl">
                  upload_file
                </span>
              </div>
              <p className="text-lg font-semibold mb-1">
                Click để chọn tệp tải lên
              </p>
              <p className="text-on-surface-variant text-sm">
                API sẽ tự xử lý và indexing vào RAG
              </p>
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    handleUpload(file);
                  }
                }}
                disabled={isUploading}
              />
            </label>

            {isUploading && (
              <div className="mt-8 bg-surface-container-low rounded-xl p-4 border border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-indigo-500 animate-pulse">
                        description
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{uploadingName}</p>
                      <p className="text-[11px] text-on-surface-variant">
                        Đang tải lên backend...
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-primary">
                    Uploading
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-12 xl:col-span-4 space-y-6">
          <div className="bg-primary text-white rounded-xl p-6 shadow-xl shadow-primary/20 relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="font-bold mb-1 opacity-90">Tổng dung lượng</h4>
              <div className="text-3xl font-black mb-4">
                {formatFileSize(storageUsedBytes)} / 50 GB
              </div>
              <div className="w-full bg-white/20 h-2 rounded-full mb-4">
                <div
                  className="bg-white h-full rounded-full"
                  style={{ width: `${storagePercent}%` }}
                ></div>
              </div>
              <p className="text-xs opacity-80 leading-relaxed">
                {documents.length} tài liệu. Đang xử lý:{" "}
                {documents.filter((doc) => doc.status !== "done").length}.
              </p>
            </div>
            <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-white/10 text-9xl">
              storage
            </span>
          </div>

          <div className="bg-surface-container-lowest border border-slate-100 rounded-xl p-6">
            <h4 className="font-bold text-sm mb-4 uppercase tracking-wider text-slate-400">
              Hướng dẫn nhanh
            </h4>
            <ul className="space-y-4">
              {[
                "Tải lên PDF, DOCX, TXT hoặc tài liệu nghiệp vụ của bạn.",
                "Theo dõi trạng thái pending/processing ngay trên bảng.",
                "Khi trạng thái là Thành công, dữ liệu đã sẵn sàng cho RAG.",
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {step}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-12">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-lg font-bold">Danh sách tài liệu</h3>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                    search
                  </span>
                  <input
                    className="pl-10 pr-4 py-2 bg-surface-container rounded-lg border-none text-sm w-full md:w-64 focus:ring-2 focus:ring-primary/20"
                    placeholder="Tìm kiếm tài liệu..."
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
                <button
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                  onClick={() => loadDocuments(true)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    refresh
                  </span>
                  <span>Làm mới</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant uppercase text-[11px] font-bold tracking-widest">
                    <th className="px-6 py-4">Tên file</th>
                    <th className="px-6 py-4">Loại file</th>
                    <th className="px-6 py-4">Kích thước</th>
                    <th className="px-6 py-4">Ngày tải lên</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!isLoading && filteredDocuments.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-sm text-on-surface-variant"
                      >
                        Chưa có tài liệu nào.
                      </td>
                    </tr>
                  )}

                  {filteredDocuments.map((doc) => {
                    const statusMeta = getStatusMeta(doc.status);
                    return (
                      <tr
                        key={doc.id}
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                              <span className="material-symbols-outlined text-slate-500 text-[20px]">
                                description
                              </span>
                            </div>
                            <span className="text-sm font-semibold">
                              {doc.filename}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">
                          {doc.file_type}
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">
                          {formatFileSize(doc.file_size)}
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">
                          {formatDate(doc.uploaded_at)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            onClick={() => handleDelete(doc)}
                            disabled={deletingId === doc.id}
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {deletingId === doc.id
                                ? "hourglass_top"
                                : "delete"}
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 bg-surface-container-lowest border-t border-slate-100 flex items-center justify-between">
              <p className="text-[13px] text-on-surface-variant">
                {isLoading
                  ? "Đang tải dữ liệu..."
                  : `Hiển thị ${filteredDocuments.length} / ${documents.length} tài liệu`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
