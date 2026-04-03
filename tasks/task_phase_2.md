# Task Phase 2 — Alembic Migration (Schema Stabilization)

> **Mục tiêu:** Ổn định schema theo runtime PostgreSQL + Qdrant.
> **Chiến lược:** Migration tối thiểu, tránh reset toàn bộ data trừ khi bắt buộc.
> **Yêu cầu:** Phase 1 phải hoàn thành trước.

---

## Checklist

### 2.1 — Cập nhật Alembic env.py

- [x] Mở `apps/api/db/alembic/env.py`
- [x] Đảm bảo `target_metadata` import từ `models.__init__` (không phải `models.tenant`)
- [x] Kiểm tra DATABASE_URL được đọc từ settings

**Đoạn cần sửa trong env.py:**

```python
# ĐÃ CŨ:
from models.tenant import Base

# MỚI:
from models import Base
```

---

### 2.2 — Tạo migration: Điều chỉnh schema tối thiểu

- [x] Chạy lệnh tạo migration điều chỉnh nhỏ:

```bash
cd apps/api
.venv/Scripts/alembic revision -m "v2_schema_stabilization"
```

- [x] Trong hàm `upgrade()` của migration file, chỉ chỉnh các điểm lệch schema thực tế:

```python
def upgrade():
    # Ví dụ: add/drop column nhỏ để khớp model-runtime
    # Không drop hàng loạt bảng trong đợt rollback Qdrant
```

- [x] Trong hàm `downgrade()`:

```python
def downgrade():
    pass  # Không hỗ trợ rollback về schema cũ
```

---

### 2.3 — Tạo migration: Đồng bộ schema với models hiện tại (autogenerate)

- [x] Sau khi đã viết đủ models ở Phase 1, chạy:

```bash
cd apps/api
.venv/Scripts/alembic revision --autogenerate -m "v2_create_new_schema"
```

- [x] Review migration file được tạo ra — kiểm tra các bảng lõi vẫn đầy đủ:
  - `tenants`
  - `tenant_widget_configs`
  - `tenant_ai_settings`
  - `tenant_keys`
  - `tenant_allowed_origins`
  - `tenant_databases`
  - `tenant_documents`
  - `chat_sessions`
  - `chat_messages`
  - `chat_analytics`

- [x] Nếu có thay đổi document model thì kiểm tra mapping không gây lệch runtime

- [x] Kiểm tra CHECK constraints có được sinh ra không (nếu không, thêm tay)
- [x] Kiểm tra INDEX được tạo cho `tenant_keys.key_value`

### 2.3.1 — Extension vector (tùy chọn)

- [x] Chỉ bật extension `vector` nếu có quyết định quay lại pgvector:

```python
op.execute("CREATE EXTENSION IF NOT EXISTS vector")
```

- [x] Trong migration `downgrade()`, không drop extension nếu đang dùng chung DB với schema khác

### 2.3.2 — Index cho truy vấn tenant/document

- [x] Tạo index lọc tenant/document cho bảng tài liệu và bảng chat nếu cần
- [x] Không bắt buộc vector index trong đợt rollback Qdrant

---

### 2.4 — Chạy migration

- [x] Áp migration theo hướng không phá dữ liệu:

```bash
# Option khuyến nghị: upgrade head trực tiếp
cd apps/api
.venv/Scripts/alembic upgrade head
```

- [x] Verify migration thành công:

```bash
.venv/Scripts/alembic current
# Phải hiện revision mới nhất
```

---

### 2.5 — Kiểm tra schema trên PostgreSQL

- [x] Kết nối vào DB và kiểm tra:

```sql
-- Phải có tất cả bảng sau:
\dt

-- Kiểm tra schema bảng tenants (phải tinh gọn)
\d tenants

-- Kiểm tra bảng tenant_keys có index chưa
\d tenant_keys

-- (Tùy chọn) Kiểm tra extension vector nếu dự án bật lại pgvector
SELECT extname FROM pg_extension WHERE extname = 'vector';
```

---

### 2.6 — Cập nhật `db/schema.sql`

- [x] Cập nhật file `apps/api/db/schema.sql` cho phản ánh schema v2 chính xác
- [x] Đây là file documentation/reference, không chạy trực tiếp

---

## Ghi chú triển khai thực tế (2026-04-03)

- Đã tạo migration stabilization: `1ca289585fb8_v2_schema_stabilization.py`.
- Đã chạy autogenerate review: `e99a6b0ac34c_v2_create_new_schema.py`.
- Migration autogenerate được giữ ở dạng no-op để tránh thao tác phá dữ liệu trên bảng legacy trong giai đoạn chuyển tiếp.
- Đã verify bảng lõi tồn tại đầy đủ và index `tenant_keys.key_value` có mặt trong DB.

---

## Kiểm tra hoàn thành Phase 2

```bash
cd apps/api
# Test kết nối và schema
.venv/Scripts/python -c "
import asyncio
from db.session import async_session
from sqlalchemy import text

async def test():
    async with async_session() as s:
        result = await s.execute(text(\"SELECT table_name FROM information_schema.tables WHERE table_schema='public'\"))
        tables = [r[0] for r in result]
        print('Tables:', tables)
        expected = ['tenants','tenant_widget_configs','tenant_ai_settings','tenant_keys','tenant_allowed_origins','tenant_databases','tenant_documents','chat_sessions','chat_messages','chat_analytics']
        for t in expected:
            assert t in tables, f'MISSING: {t}'
        print('✅ All tables OK')

asyncio.run(test())
"
```

✅ Phase 2 hoàn thành khi migration chạy thành công và schema tương thích runtime PostgreSQL + Qdrant.
