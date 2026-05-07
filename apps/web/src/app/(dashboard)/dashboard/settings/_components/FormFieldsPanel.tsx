"use client";

import {
  DEFAULT_FORM_FIELDS,
  FormFieldDef,
  FormFieldType,
  SectionProps,
} from "./types";

const FIELD_TYPES: FormFieldType[] = ["text", "tel", "email", "textarea"];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export default function FormFieldsPanel({ formData, setFormData }: SectionProps) {
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
        const duplicate = nextFields.some((field, idx) => idx !== index && field.key === key);
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

  const removeField = (index: number) => {
    setFormData((prev) => {
      const source = prev.form_fields.length > 0 ? prev.form_fields : DEFAULT_FORM_FIELDS;
      const nextFields = source
        .filter((_, idx) => idx !== index)
        .map((field, idx) => ({ ...field, order: idx + 1 }));
      return { ...prev, form_fields: nextFields };
    });
  };

  const salesFields = formData.form_fields.length > 0 ? formData.form_fields : DEFAULT_FORM_FIELDS;

  return (
    <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/80 hover:border-indigo-100 transition-colors duration-500 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50/30 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-amber-100/50 transition-colors"></div>

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

        {/* Toggle fields list — compact style like v2 */}
        <div className="space-y-0 mb-6">
          {salesFields.map((field, index) => {
            const duplicateKey = salesFields.some(
              (other, otherIndex) => otherIndex !== index && other.key === field.key,
            );
            return (
              <div
                key={`${field.key}-${index}`}
                className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-b-0"
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

                {/* Field label */}
                <span className="text-[12px] text-slate-800 flex-1 min-w-0 truncate">
                  {field.label}
                  {!DEFAULT_FORM_FIELDS.some((df) => df.key === field.key) && (
                    <span className="text-[9px] text-slate-400 ml-1">(tùy chỉnh)</span>
                  )}
                </span>

                {/* Required toggle or label */}
                {field.required && DEFAULT_FORM_FIELDS.some((df) => df.key === field.key && df.required) ? (
                  <span className="text-[10px] text-red-500 shrink-0">Bắt buộc</span>
                ) : (
                  <>
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
                    <span className="text-[10px] text-slate-400 shrink-0">Bắt buộc</span>
                  </>
                )}

                {/* Remove button for custom fields */}
                {!DEFAULT_FORM_FIELDS.some((df) => df.key === field.key) && (
                  <button
                    type="button"
                    onClick={() => removeField(index)}
                    className="text-[10px] text-red-400 hover:text-red-600 shrink-0"
                    title="Xóa trường"
                  >
                    ✕
                  </button>
                )}

                {duplicateKey && (
                  <span className="text-[9px] text-red-500 shrink-0">Trùng key</span>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addField}
          className="w-full py-3 rounded-xl border border-dashed border-slate-300 text-[11px] text-slate-500 hover:text-slate-700 hover:border-slate-400 bg-transparent cursor-pointer transition-colors"
        >
          + Thêm trường tùy chỉnh
        </button>

        {/* Advanced field editor — expandable for editing key/type */}
        <details className="mt-6">
          <summary className="text-[10px] font-bold uppercase tracking-widest text-slate-400 cursor-pointer hover:text-slate-600 transition-colors">
            Cấu hình nâng cao (Key & Kiểu dữ liệu)
          </summary>
          <div className="mt-3 space-y-3">
            {salesFields.map((field, index) => {
              const duplicateKey = salesFields.some(
                (other, otherIndex) => otherIndex !== index && other.key === field.key,
              );
              return (
                <div
                  key={`adv-${field.key}-${index}`}
                  className="rounded-2xl border border-slate-100 p-4 bg-slate-50/70"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-3">
                      <label className="text-[10px] font-bold uppercase text-slate-500">
                        Key
                      </label>
                      <input
                        value={field.key}
                        onChange={(e) =>
                          upsertField(index, { key: slugify(e.target.value) }, true)
                        }
                        className={`w-full mt-1 rounded-xl border px-3 py-2 text-xs ${
                          duplicateKey
                            ? "border-red-300 bg-red-50"
                            : "border-slate-200 bg-white"
                        }`}
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="text-[10px] font-bold uppercase text-slate-500">
                        Label
                      </label>
                      <input
                        value={field.label}
                        onChange={(e) => upsertField(index, { label: e.target.value })}
                        className="w-full mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-[10px] font-bold uppercase text-slate-500">
                        Kiểu
                      </label>
                      <select
                        value={field.type}
                        onChange={(e) =>
                          upsertField(index, { type: e.target.value as FormFieldType })
                        }
                        className="w-full mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                      >
                        {FIELD_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <button
                        type="button"
                        onClick={() => removeField(index)}
                        className="w-full px-2 py-2 rounded-xl text-xs font-bold border border-red-200 text-red-600 bg-white hover:bg-red-50"
                      >
                        X
                      </button>
                    </div>
                  </div>
                  {duplicateKey && (
                    <p className="text-[11px] text-red-600 mt-2">
                      Key bị trùng. Mỗi trường cần một key duy nhất.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      </div>
    </section>
  );
}
