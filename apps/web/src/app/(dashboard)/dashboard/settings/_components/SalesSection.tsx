"use client";

import {
  DEFAULT_BANK_INFO,
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

function ToggleItem({
  label,
  desc,
  active,
  onClick,
}: {
  label: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-4 p-5 rounded-[1.8rem] border transition-all duration-300 text-left ${
        active
          ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200"
          : "bg-slate-50 border-slate-100 text-slate-700 hover:border-slate-300"
      }`}
    >
      <div className="flex-1">
        <p className={`text-sm font-black ${active ? "text-white" : "text-slate-800"}`}>
          {label}
        </p>
        <p className={`text-[10px] font-medium mt-0.5 ${active ? "text-white/60" : "text-slate-400"}`}>
          {desc}
        </p>
      </div>
      <div
        className={`w-10 h-6 rounded-full relative transition-colors duration-500 ${active ? "bg-indigo-500" : "bg-slate-200"}`}
      >
        <div
          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${active ? "left-5" : "left-1"}`}
        />
      </div>
    </button>
  );
}

export default function SalesSection({ formData, setFormData }: SectionProps) {
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

  const togglePaymentMethod = (key: "cod" | "bank_transfer" | "momo" | "vnpay") => {
    setFormData((prev) => ({
      ...prev,
      payment_methods: {
        ...prev.payment_methods,
        [key]: !prev.payment_methods[key],
      },
      bank_info:
        key === "bank_transfer" && !prev.payment_methods.bank_transfer
          ? prev.bank_info || { ...DEFAULT_BANK_INFO }
          : prev.bank_info,
    }));
  };

  const salesFields = formData.form_fields.length > 0 ? formData.form_fields : DEFAULT_FORM_FIELDS;

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/80">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-5">
          Hiển thị sản phẩm
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {(["card", "list"] as const).map((layout) => (
            <button
              key={layout}
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, product_layout: layout }))}
              className={`px-4 py-3 rounded-2xl text-sm font-bold border transition-all ${
                formData.product_layout === layout
                  ? "bg-slate-900 text-white border-slate-900 shadow"
                  : "bg-slate-50 text-slate-600 border-slate-100 hover:border-slate-300"
              }`}
            >
              {layout === "card" ? "Dạng thẻ" : "Dạng danh sách"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ToggleItem
            label="Hiển thị tồn kho"
            desc="Cho phép bot hiện số lượng còn lại."
            active={formData.show_stock}
            onClick={() => setFormData((prev) => ({ ...prev, show_stock: !prev.show_stock }))}
          />
          <ToggleItem
            label="Hiển thị đánh giá"
            desc="Hiển thị sao đánh giá sản phẩm."
            active={formData.show_rating}
            onClick={() => setFormData((prev) => ({ ...prev, show_rating: !prev.show_rating }))}
          />
        </div>
      </section>

      <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/80">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-2">
          Hành động CTA
        </h3>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Hệ thống tự động chọn <span className="font-bold text-slate-700">direct</span> khi connector ở
          trang <span className="font-bold text-slate-700">Cấu hình bán hàng</span> đã có endpoint
          <code className="mx-1 px-1.5 py-0.5 bg-slate-100 rounded text-[11px] font-mono">create_order</code>
          hợp lệ — đơn sẽ được tạo trên web shop. Chọn <span className="font-bold text-slate-700">link</span>
          {" "}để ưu tiên cart link, chọn <span className="font-bold text-slate-700">lead</span> để bỏ qua
          tự động và lưu lead trên dashboard.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { key: "lead", label: "Thu lead", hint: "Mặc định khi chưa có API. Lưu lead trên dashboard." },
            { key: "link", label: "Đi đến sản phẩm", hint: "Mở cart link / link sản phẩm bên ngoài." },
            { key: "direct", label: "Đặt trực tiếp", hint: "Tự động khi đã cấu hình API tạo đơn. Tạo đơn thật trên web shop." },
          ].map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  action_mode: action.key as "lead" | "link" | "direct",
                }))
              }
              className={`p-4 rounded-2xl text-left border transition-all ${
                formData.action_mode === action.key
                  ? "bg-indigo-600 text-white border-indigo-600 shadow"
                  : "bg-slate-50 text-slate-600 border-slate-100 hover:border-slate-300"
              }`}
            >
              <div className="text-sm font-black">{action.label}</div>
              <div className={`text-[11px] mt-1 ${formData.action_mode === action.key ? "text-white/80" : "text-slate-400"}`}>
                {action.hint}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/80">
        <div className="flex items-center justify-between mb-5 gap-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
            Form thu lead
          </h3>
          <button
            type="button"
            onClick={addField}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-indigo-600"
          >
            + Thêm trường
          </button>
        </div>
        <div className="space-y-3">
          {salesFields.map((field, index) => {
            const duplicateKey = salesFields.some(
              (other, otherIndex) => otherIndex !== index && other.key === field.key,
            );
            return (
              <div
                key={`${field.key}-${index}`}
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
                  <div className="md:col-span-3">
                    <label className="text-[10px] font-bold uppercase text-slate-500">
                      Label
                    </label>
                    <input
                      value={field.label}
                      onChange={(e) => upsertField(index, { label: e.target.value })}
                      className="w-full mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="md:col-span-2">
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
                  <div className="md:col-span-3 flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        upsertField(index, { required: !field.required })
                      }
                      className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                        field.required
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-600 border-slate-200"
                      }`}
                    >
                      Required
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        upsertField(index, { enabled: !field.enabled })
                      }
                      className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                        field.enabled
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-slate-600 border-slate-200"
                      }`}
                    >
                      {field.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                  <div className="md:col-span-1 flex items-end">
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
      </section>

      <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/80">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-5">
          Thanh toán
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { key: "cod", label: "COD" },
            { key: "bank_transfer", label: "Chuyển khoản" },
            { key: "momo", label: "MoMo" },
            { key: "vnpay", label: "VNPAY" },
          ].map((item) => {
            const itemKey = item.key as "cod" | "bank_transfer" | "momo" | "vnpay";
            const active = formData.payment_methods[itemKey];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => togglePaymentMethod(itemKey)}
                className={`px-3 py-3 rounded-2xl border text-sm font-bold transition-all ${
                  active
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-slate-50 text-slate-600 border-slate-100 hover:border-slate-300"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {formData.payment_methods.bank_transfer && (
          <div className="rounded-2xl border border-slate-100 p-4 bg-slate-50/70 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">
                Tên ngân hàng
              </label>
              <input
                value={formData.bank_info?.bank_name ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    bank_info: {
                      ...(prev.bank_info || { ...DEFAULT_BANK_INFO }),
                      bank_name: e.target.value,
                    },
                  }))
                }
                className="w-full mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">
                Chủ tài khoản
              </label>
              <input
                value={formData.bank_info?.account_name ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    bank_info: {
                      ...(prev.bank_info || { ...DEFAULT_BANK_INFO }),
                      account_name: e.target.value,
                    },
                  }))
                }
                className="w-full mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">
                Số tài khoản
              </label>
              <input
                value={formData.bank_info?.account_number ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    bank_info: {
                      ...(prev.bank_info || { ...DEFAULT_BANK_INFO }),
                      account_number: e.target.value,
                    },
                  }))
                }
                className="w-full mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">
                QR URL (tùy chọn)
              </label>
              <input
                value={formData.bank_info?.qr_url ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    bank_info: {
                      ...(prev.bank_info || { ...DEFAULT_BANK_INFO }),
                      qr_url: e.target.value,
                    },
                  }))
                }
                className="w-full mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
