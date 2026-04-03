# Task Phase 4 — Frontend Integration

> **Mục tiêu:** Kết nối Frontend với Backend API mới, xóa toàn bộ mock data.
> **Yêu cầu:** Phase 3 phải hoàn thành và server đang chạy ở port 8001.

---

## Checklist

### 4.1 — Cập nhật AuthContext

**File:** `apps/web/src/context/AuthContext.tsx`

- [x] Cập nhật type `Tenant` theo response mới từ `GET /me`:

```typescript
interface WidgetConfig {
  bot_name: string;
  primary_color: string;
  logo_url?: string;
  greeting: string;
  placeholder: string;
  position: "bottom-right" | "bottom-left";
  show_sources: boolean;
  font_size: string;
}

interface AiSettings {
  system_prompt: string;
  is_rag_enabled: boolean;
  is_sql_enabled: boolean;
  temperature: number;
  max_tokens: number;
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  plan: "starter" | "pro" | "enterprise";
  public_key: string;
  widget: WidgetConfig;
  ai_settings: AiSettings;
}
```

---

### 4.2 — Refactor Settings Page

**File:** `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`

- [x] Tách form thành 2 sections có save button riêng:
  - **Widget Config** → `PATCH /api/v1/admin/widget`
  - **AI Settings** → `PATCH /api/v1/admin/ai-settings`
- [x] Load data: `GET /api/v1/admin/me` → map `data.widget` và `data.ai_settings`
- [x] Thêm field `bot_name` (thay `name`)
- [x] Thêm field `show_sources` (toggle)
- [x] Thêm field `position` (select: bottom-right/bottom-left)
- [x] Thêm section AI: `temperature` slider, `max_tokens` input
- [x] Hiển thị công bố `public_key` (read-only, có nút copy)

**State mới:**

```typescript
const [widgetForm, setWidgetForm] = useState({
  bot_name: "",
  greeting: "",
  primary_color: "#2563eb",
  placeholder: "Nhập câu hỏi...",
  position: "bottom-right",
  show_sources: true,
  font_size: "14px",
});

const [aiForm, setAiForm] = useState({
  system_prompt: "",
  is_rag_enabled: true,
  is_sql_enabled: false,
  temperature: 0.7,
  max_tokens: 2048,
});
```

**Save handlers:**

```typescript
const saveWidget = async () => {
  await api.patch("/api/v1/admin/widget", widgetForm);
};

const saveAiSettings = async () => {
  await api.patch("/api/v1/admin/ai-settings", aiForm);
};
```

---

### 4.3 — Refactor Keys Page (QUAN TRỌNG)

**File:** `apps/web/src/app/(dashboard)/dashboard/keys/page.tsx`

#### 4.3.1 — Data Loading

- [x] Thêm `useState` + `useEffect` để load keys từ API
- [x] `GET /api/v1/admin/keys` → hiển thị danh sách thật

**Type:**

```typescript
interface ApiKey {
  id: string;
  key_type: "public" | "admin";
  key_value_masked: string; // "pk_live_xxxx...yyyy" (hiện 8 ký tự đầu + truncate)
  label: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}
```

#### 4.3.2 — Tạo Key Mới

- [x] Nút "Tạo Key mới" mở modal
- [x] Modal có: dropdown `key_type` (public/admin) + input `label`
- [x] Submit: `POST /api/v1/admin/keys`
- [x] Sau khi tạo: **hiện key value đầy đủ một lần duy nhất** trong modal với cảnh báo "Hãy sao chép ngay, không thể xem lại"
- [x] Nút Copy với feedback animation

#### 4.3.3 — Thu hồi Key

- [x] Icon delete → confirm dialog: "Bạn có chắc muốn thu hồi key này? Hành động không thể hoàn tác."
- [x] Sau confirm: `DELETE /api/v1/admin/keys/{id}`
- [x] Reload danh sách

#### 4.3.4 — UI Stats (Thật)

- [x] Tổng số Keys active: đếm từ API response
- [x] Xóa hardcode "08", "12,402", "75%"

**Skeleton Loading:**

```tsx
// Hiển thị skeleton khi đang load
{isLoading ? (
  <div className="space-y-4">
    {[1,2,3].map(i => (
      <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl" />
    ))}
  </div>
) : (
  // Bảng keys thật
)}
```

---

### 4.4 — Cập nhật Billing Page

**File:** `apps/web/src/app/(dashboard)/dashboard/billing/page.tsx`

- [x] Kiểm tra xem có load data từ API không → nếu hardcode thì kết nối `GET /api/v1/admin/billing/summary`
- [x] Hiển thị `plan` thật của tenant
- [x] Hiển thị số messages và storage thật

---

### 4.5 — Cập nhật Dashboard Overview

**File:** `apps/web/src/app/(dashboard)/dashboard/page.tsx`

- [x] Kết nối `GET /api/v1/admin/billing/summary` để lấy stats thật
- [x] Thay hardcode values bằng dynamic data
- [x] Xử lý loading state

---

### 4.6 — Toast Notifications (Optional Enhancement)

- [ ] Thay `alert()` bằng toast notification đẹp hơn
- [ ] Add `react-hot-toast` hoặc tự implement toast component

---

## Thứ tự thực hiện

1. AuthContext (4.1) — nền tảng cho tất cả
2. Settings Page (4.2) — critical
3. Keys Page (4.3) — critical, implement API thật
4. Billing Page (4.4) — nice to have
5. Dashboard Overview (4.5) — nice to have

---

## Kiểm tra hoàn thành Phase 4

### Manual Testing Checklist:

- [ ] **Settings:** Thay đổi màu widget → Save → Refresh → Vẫn hiển thị màu mới
- [ ] **Settings:** Toggle RAG on/off → Save → Reload → State được giữ
- [ ] **Keys:** Trang load → hiện skeleton → rồi hiện keys thật
- [ ] **Keys:** Click "Tạo Key mới" → điền form → Submit → Modal hiện key value → Copy → Dismiss → Key xuất hiện trong danh sách
- [ ] **Keys:** Click Delete → Confirm → Key biến mất hoặc hiện "Thu hồi"
- [ ] **Widget SDK:** Nhúng vào trang test với `public_key` → Widget load đúng màu/tên từ API

✅ Phase 4 hoàn thành khi tất cả manual tests pass.
