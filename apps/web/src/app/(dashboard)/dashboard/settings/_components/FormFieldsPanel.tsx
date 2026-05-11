"use client";

import { useState } from "react";
import {
  DEFAULT_FORM_FIELDS,
  FormFieldDef,
  FormFieldType,
  SectionProps,
} from "./types";

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Văn bản" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Điện thoại" },
  { value: "textarea", label: "Văn bản dài" },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

type EditingField = {
  key: string;
  label: string;
  type: FormFieldType;
};

export default function FormFieldsPanel({ formData, setFormData }: SectionProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditingField | null>(null);

  const fields = formData.form_fields.length > 0 ? formData.form_fields : DEFAULT_FORM_FIELDS;

  const upsertField = (
    index: number,
    patch: Partial<FormFieldDef>,
    ensureUniqueKey = false,
  ) => {
    setFormData((prev) => {
      const nextFields = [...prev.form_fields];
      const current = nextFields[index];
      if (!current) return prev;
      const merged = { ...current, ...patch };
      if (ensureUniqueKey && patch.key) {
        const key = patch.key.trim();
        const duplicate = nextFields.some((f, idx) => idx !== index && f.key === key);
        if (duplicate) return prev;
        merged.key = key;
      }
      nextFields[index] = merged;
      return { ...prev, form_fields: nextFields };
    });
  };

  const addField = () => {
    setFormData((prev) => {
      const existing = prev.form_fields.length > 0 ? prev.form_fields : DEFAULT_FORM_FIELDS;
      const order = existing.length + 1;
      const key = `custom_${order}`;
      return {
        ...prev,
        form_fields: [
          ...existing,
          {
            key,
            label: `Trường ${order}`,
            type: "text",
            required: false,
            enabled: true,
            order,
          },
        ],
      };
    });
  };

  const removeField = (key: string) => {
    setFormData((prev) => {
      const nextFields = prev.form_fields
        .filter((f) => f.key !== key)
        .map((f, idx) => ({ ...f, order: idx + 1 }));
      return { ...prev, form_fields: nextFields };
    });
  };

  const startEdit = (field: FormFieldDef) => {
    setEditingKey(field.key);
    setEditDraft({ key: field.key, label: field.label, type: field.type });
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditDraft(null);
  };

  const saveEdit = (originalKey: string) => {
    if (!editDraft) return;
    const trimmedKey = slugify(editDraft.label);
    const newKey = trimmedKey || editDraft.key;

    setFormData((prev) => {
      const nextFields = prev.form_fields.map((f) => {
        if (f.key !== originalKey) return f;
        const updated: FormFieldDef = {
          ...f,
          key: newKey,
          label: editDraft!.label,
          type: editDraft!.type,
        };
        return updated;
      });
      return { ...prev, form_fields: nextFields };
    });

    setEditingKey(null);
    setEditDraft(null);
  };

  const hasDuplicate = (key: string) =>
    fields.filter((f) => f.key === key).length > 1;

  return (
    <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/80 hover:border-indigo-100 transition-colors duration-500 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50/30 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-amber-100/50 transition-colors" />

      <div className="relative">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">list_alt</span>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
              Form đặt hàng
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Cấu hình các trường thu thập thông tin khách hàng
            </p>
          </div>
        </div>

        {/* Fields list */}
        <div className="space-y-2 mb-6">
          {fields.map((field, index) => {
            const isDefault = DEFAULT_FORM_FIELDS.some((df) => df.key === field.key);
            const isEditing = editingKey === field.key;
            const duplicate = hasDuplicate(field.key);

            if (isEditing && editDraft) {
              return (
                <div
                  key={`edit-${field.key}`}
                  className="rounded-2xl border border-indigo-200 p-4 bg-indigo-50/40"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-4">
                      <label className="text-[10px] font-bold uppercase text-slate-500">
                        Tên trường
                      </label>
                      <input
                        value={editDraft.label}
                        onChange={(e) =>
                          setEditDraft((d) => (d ? { ...d, label: e.target.value } : null))
                        }
                        className="w-full mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        autoFocus
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="text-[10px] font-bold uppercase text-slate-500">
                        Kiểu dữ liệu
                      </label>
                      <select
                        value={editDraft.type}
                        onChange={(e) =>
                          setEditDraft((d) =>
                            d ? { ...d, type: e.target.value as FormFieldType } : null,
                          )
                        }
                        className="w-full mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-4 flex items-end gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(field.key)}
                        className="flex-1 px-3 py-2 rounded-xl text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-600 transition-colors"
                      >
                        Lưu
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-500 bg-white hover:bg-slate-50 transition-colors"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={`${field.key}-${index}`}
                className="flex items-center gap-3 py-3 px-4 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-colors bg-white"
              >
                {/* Toggle enable/disable */}
                <label className="relative w-[28px] h-[16px] shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.enabled}
                    onChange={() => upsertField(index, { enabled: !field.enabled })}
                    className="opacity-0 w-0 h-0 absolute"
                  />
                  <div
                    className="absolute inset-0 rounded-full transition-colors duration-200"
                    style={{ background: field.enabled ? formData.widget_color : "#cbd5e1" }}
                  >
                    <div
                      className="absolute top-[2px] w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-200"
                      style={{ left: field.enabled ? "14px" : "2px" }}
                    />
                  </div>
                </label>

                {/* Field info */}
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] text-slate-800 font-medium truncate block">
                    {field.label}
                    {!isDefault && (
                      <span className="text-[9px] text-indigo-400 ml-1 font-normal">(tùy chỉnh)</span>
                    )}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    {FIELD_TYPES.find((t) => t.value === field.type)?.label ?? field.type}
                    {field.required && " · Bắt buộc"}
                  </span>
                </div>

                {/* Required toggle — always for custom fields */}
                {!isDefault && (
                  <label className="relative w-[28px] h-[16px] shrink-0 cursor-pointer" title="Bắt buộc">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={() => upsertField(index, { required: !field.required })}
                      className="opacity-0 w-0 h-0 absolute"
                    />
                    <div
                      className="absolute inset-0 rounded-full transition-colors duration-200"
                      style={{ background: field.required ? formData.widget_color : "#cbd5e1" }}
                    >
                      <div
                        className="absolute top-[2px] w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-200"
                        style={{ left: field.required ? "14px" : "2px" }}
                      />
                    </div>
                  </label>
                )}

                {/* Required badge for locked default fields */}
                {isDefault && field.required && (
                  <span className="text-[10px] text-red-500 shrink-0 px-2 py-0.5 bg-red-50 rounded-full">
                    Bắt buộc
                  </span>
                )}

                {/* Duplicate warning */}
                {duplicate && (
                  <span className="text-[9px] text-red-500 shrink-0">Trùng key</span>
                )}

                {/* Edit button - custom fields only */}
                {!isDefault && (
                  <button
                    type="button"
                    onClick={() => startEdit(field)}
                    className="shrink-0 w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Sửa trường"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                )}

                {/* Delete button - custom fields only */}
                {!isDefault && (
                  <button
                    type="button"
                    onClick={() => removeField(field.key)}
                    className="shrink-0 w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Xóa trường"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Add field button */}
        <button
          type="button"
          onClick={addField}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 text-[11px] text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/30 bg-transparent cursor-pointer transition-colors font-medium flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Thêm trường mới
        </button>
      </div>
    </section>
  );
}