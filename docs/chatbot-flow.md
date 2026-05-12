# Luồng Hoạt động của Chatbot

> Tài liệu mô tả kiến trúc và luồng xử lý tin nhắn chatbot trong hệ thống Widget Chatbot.

---

## Tổng quan Kiến trúc

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LUỒNG CHATBOT WIDGET CHATBOT                         │
└─────────────────────────────────────────────────────────────────────────────┘

  [Widget]  ──── X-Widget-Key + Origin ────▶ [FastAPI Backend]
                                                  │
                                                  ▼
                                        ┌─────────────────┐
                                        │ SecurityMiddleware│
                                        │ (Auth + Origin)  │
                                        └────────┬────────┘
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    │                            ▼                            │
                    │                   ┌────────────────┐                     │
                    │                   │  Chat Endpoint │                     │
                    │                   │  POST /api/v1  │                     │
                    │                   │     /chat      │                     │
                    │                   └───────┬────────┘                     │
                    │                           │                              │
                    │         ┌─────────────────┼─────────────────┐           │
                    │         │                 │                 │           │
                    │         ▼                 ▼                 ▼           │
                    │   ┌───────────┐    ┌─────────────┐    ┌──────────────┐  │
                    │   │ Sales Chat│    │ Orchestrator│    │  Streaming   │  │
                    │   │ (action)  │    │  (LangGraph) │    │  (SSE/POST)  │  │
                    │   └─────┬─────┘    └──────┬───────┘    └──────────────┘  │
                    │         │                 │                              │
                    └─────────┼─────────────────┼──────────────────────────────┘
                              │                 │
                    ┌─────────┴─────────────────┴──────────────┐
                    │                                        │
                    ▼                                        ▼
          ┌──────────────────┐                   ┌────────────────────┐
          │   Sales Flow      │                   │   AI Orchestrator   │
          │  (WooCommerce,    │                   │   (LangGraph)       │
          │   Shopify, etc.)  │                   │                    │
          └────────┬─────────┘                   │  ┌─────┐  ┌─────┐ │
                   │                              │  │Loader│─▶│Sett.│ │
                   │                              │  └──┬──┘  └──┬──┘ │
                   │                              │     │        │      │
                   │                              │     ▼        ▼      │
                   │                              │ ┌────────┐ ┌────────┐│
                   │                              │ │Classify│ │RAG/SQL/││
                   │                              │ │ Node  │─▶│GENERAL ││
                   │                              │ └───┬──┘ └────┬───┘│
                   │                              │     │        │      │
                   │                              │     └────────┴──────│
                   │                              │           │          │
                   │                              │           ▼          │
                   │                              │     ┌──────────┐   │
                   │                              │     │ Saver    │   │
                   │                              │     └──────────┘   │
                   └──────────────────────────────┴────────────────────┘
```

---

## Chi tiết từng bước

### Bước 1: Xác thực (Security Middleware)

**File:** `apps/api/api/middleware.py`

Middleware kiểm tra mọi request từ widget:

1. **X-Widget-Key Header**: Xác thực tenant qua bảng `tenant_keys`
2. **Origin Header**: Đối chiếu với whitelist domain trong `tenant_allowed_origins`
3. **Set State**: Gán `request.state.tenant_id` để dùng trong các endpoint

```python
# Ví dụ logic
- Kiểm tra api_key có trong bảng tenant_keys không
- Kiểm tra origin có trong allowed_origins không (hoặc wildcard *)
- Set request.state.tenant_id
```

---

### Bước 2: Chat Endpoint (`POST /api/v1/chat`)

**File:** `apps/api/api/v1/chat.py` (dòng 289-376)

```
1. Kiểm tra plan có cho phép chat (ensure_widget_chat_allowed)
        │
        ▼
2. Kiểm tra có action không?
   ├── Có → chuyển sang Sales Flow
   └── Không → Kiểm tra query có liên quan sales không?
                ├── Có → chuyển sang Sales Flow
                └── Không → chuyển sang Orchestrator (LangGraph)
```

#### Request Schema

```python
class ChatRequest(BaseModel):
    query: str = ""              # Câu hỏi của user
    session_id: Optional[str]     # ID phiên chat (default: "default")
    action: Optional[dict]       # Action payload cho sales (VD: add_to_cart)
```

#### Response Schema

```python
{
    "text": "Câu trả lời...",
    "ui_components": [...],      # Component UI (product_grid, chart, etc.)
    "slots": {...},              # Slot data cho sales flow
    "metadata": {...},           # Intent, sql_query, etc.
    "citations": [...],          # Trích dẫn tài liệu (RAG)
    "component": {...}           # Component type + data
}
```

---

### Bước 3: AI Orchestrator (LangGraph)

**File:** `apps/api/ai/orchestrator.py`

Orchestrator là workflow LangGraph điều phối các agent AI:

```
┌─────────────────────────────────────────────────────────────────┐
│                      LANGGRAPH WORKFLOW                          │
└─────────────────────────────────────────────────────────────────┘

[Entry] ──▶ [loader] ──▶ [settings_loader] ──▶ [classifier]
                                               │
                                               ▼
                                     ┌─────────┼─────────┐
                                     │         │         │
                                     ▼         ▼         ▼
                               ┌─────────┐ ┌─────────┐ ┌───────────┐
                               │  RAG    │ │   SQL   │ │  GENERAL  │
                               │  Node   │ │  Node   │ │   Node    │
                               └────┬────┘ └────┬────┘ └─────┬─────┘
                                    │          │            │
                                    └──────────┼────────────┘
                                               │
                                               ▼
                                         [saver] ──▶ [END]
```

#### Chi tiết từng Node

| Node | File | Mục đích | Đầu ra |
|------|------|---------|--------|
| **loader** | `orchestrator.py` | Load lịch sử chat từ Redis | `history: List[Dict]` |
| **settings_loader** | `orchestrator.py` | Load tenant AI settings từ DB | `is_rag_enabled`, `is_sql_enabled`, `system_prompt` |
| **classifier** | `orchestrator.py` | Phân loại intent bằng LLM (Gemini) | `intent: RAG \| SQL \| GENERAL` |
| **rag_node** | `rag_agent.py` | RAG Agent - truy vấn vector store | `AgentResponse` |
| **sql_node** | `sql_agent.py` | SQL Agent - Text-to-SQL pipeline | `AgentResponse` |
| **general_node** | `orchestrator.py` | Chat thường - dùng system prompt | `AgentResponse` |
| **saver** | `orchestrator.py` | Lưu lịch sử vào Redis | `{}` |

#### Intent Classifier Prompt

```python
prompt = """
Bạn là một AI router chuyên nghiệp cho hệ thống đa khách hàng (SaaS).
Hãy phân loại câu hỏi của người dùng vào một trong 3 nhóm sau:
1. RAG: Câu hỏi liên quan đến tìm kiếm thông tin trong tài liệu (PDF, Word, Kiến thức nội bộ).
2. SQL: Câu hỏi liên quan đến truy vấn dữ liệu có cấu trúc, báo cáo, con số (Doanh thu, số lượng nhân viên, danh sách khách hàng).
3. GENERAL: Câu chào hỏi, tán gẫu, hoặc các câu hỏi không thuộc 2 nhóm trên.

Trả về kết quả DUY NHẤT dưới dạng JSON: {"intent": "RAG" | "SQL" | "GENERAL"}
"""
```

---

### Bước 4: RAG Agent (RAG Node)

**File:** `apps/api/ai/rag_agent.py`

Xử lý câu hỏi liên quan đến tài liệu đã upload:

```
┌─────────────────────────────────────────────────────────────────┐
│                         RAG AGENT FLOW                           │
└─────────────────────────────────────────────────────────────────┘

Query ──▶ [Query Reformulation] ──▶ [Vector Search (Qdrant)]
                                          │
                                          ▼
                                   [Top-K Documents]
                                          │
                                          ▼
                              [Build Context + System Prompt]
                                          │
                                          ▼
                              [Call Gemini LLM]
                                          │
                                          ▼
                               [Return AgentResponse]
```

#### Chi tiết xử lý

1. **Query Reformulation**: Nếu query ambiguous, dùng LLM để cải thiện query
2. **Vector Search**: Tìm top-5 documents liên quan trong Qdrant collection của tenant
3. **Context Building**: Ghép nội dung documents vào system prompt
4. **LLM Generation**: Gọi Gemini với prompt đã build, yêu cầu trả lời **chỉ** dựa trên tài liệu

#### Vector Store

**File:** `apps/api/ai/vector_store.py`

```python
class SaaSVectorStore:
    """Multi-tenant vector store trên Qdrant."""
    
    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
        self.collection_name = f"tenant_{tenant_id}"
    
    async def search(self, query: str, limit: int = 5):
        # Search trong collection riêng của tenant
        # Return: [{"text": "...", "score": 0.95, "metadata": {...}}]
```

---

### Bước 5: SQL Agent (SQL Node)

**File:** `apps/api/ai/sql_agent.py`

Xử lý câu hỏi cần truy vấn database của tenant:

```
┌─────────────────────────────────────────────────────────────────┐
│                     TEXT-TO-SQL PIPELINE                         │
└─────────────────────────────────────────────────────────────────┘

Question ──▶ [Schema Loader] ──▶ [SQL Generator (Gemini)]
                                      │
                                      ▼
                             [Generated SQL]
                                      │
                                      ▼
                           [Security Validator]
                           (tenant_id injection)
                                      │
                                      ▼
                            [SQL Executor]
                            (SELECT only)
                                      │
                                      ▼
                          [Result Formatter]
                          (Markdown table)
                                      │
                                      ▼
                       [Return AgentResponse]
```

#### Chi tiết pipeline

1. **Schema Loader**: Lấy schema database của tenant (decrypted)
2. **SQL Generator**: Gemini sinh SQL từ câu hỏi + schema
3. **Security Validator**:
   - Chỉ cho phép `SELECT`
   - Bắt buộc inject `tenant_id` vào WHERE clause
   - Validate against SQL injection
4. **SQL Executor**: Thực thi SQL trên database tenant
5. **Formatter**: Format kết quả thành markdown table

#### Security Measures

- Chỉ `SELECT` statements được phép
- `tenant_id` luôn được inject vào WHERE
- Không cho phép `DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `TRUNCATE`
- Giới hạn số rows trả về (LIMIT)

---

### Bước 6: Sales Flow (Optional)

**File:** `apps/api/services/sales/chat_handler.py`

Xử lý các action liên quan đến bán hàng:

```
┌─────────────────────────────────────────────────────────────────┐
│                        SALES FLOW                                │
└─────────────────────────────────────────────────────────────────┘

Action/Query ──▶ [Check Sales Enabled?] ──▶ [Detect Action Type]
                                                │
                                                ▼
                              ┌─────────────────┼─────────────────┐
                              │                 │                 │
                              ▼                 ▼                 ▼
                      ┌───────────┐     ┌─────────────┐    ┌───────────┐
                      │  Product  │     │   Order     │    │   Lead    │
                      │  Query    │     │  Tracking   │    │ Collection│
                      └─────┬─────┘     └──────┬──────┘    └─────┬─────┘
                            │                  │                 │
                            ▼                  ▼                 ▼
                      ┌───────────┐     ┌─────────────┐    ┌───────────┐
                      │WooCommerce│     │ Sales DB    │    │  Form     │
                      │Shopify    │     │             │    │  Submit   │
                      └───────────┘     └─────────────┘    └───────────┘
```

#### Supported Actions

| Action | Mô tả | Connector |
|--------|-------|-----------|
| `product_search` | Tìm kiếm sản phẩm | WooCommerce / Shopify |
| `product_detail` | Chi tiết sản phẩm | WooCommerce / Shopify |
| `order_tracking` | Theo dõi đơn hàng | Sales DB |
| `add_to_cart` | Thêm vào giỏ hàng | WooCommerce / Shopify |
| `checkout` | Thanh toán | PayOS integration |
| `lead_form` | Thu thập lead | Form submission |

---

### Bước 7: Streaming Response (Optional)

**File:** `apps/api/api/v1/chat.py` (`POST /chat/stream`, `GET /chat/stream`)

Hỗ trợ real-time streaming qua Server-Sent Events (SSE):

```
┌─────────────────────────────────────────────────────────────────┐
│                     SSE STREAMING FLOW                           │
└─────────────────────────────────────────────────────────────────┘

Client ──▶ [POST /chat/stream] ──▶ [Start Background Task]
                                            │
                                            ▼
                               ┌────────────────────────┐
                               │ asyncio.create_task()   │
                               │ (Chat Handler)          │
                               └───────────┬────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                       │
                    ▼                      ▼                       ▼
            ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
            │  Heartbeat  │        │   Task      │        │   Task     │
            │  (5s)       │        │  Running?   │        │  Complete?  │
            │  ": keep-   │        │     ↓       │        │     ↓       │
            │   alive"    │        │    Yes ─────┼───────▶│    No ──────┼──▶ Continue
            └─────────────┘        └─────────────┘        └─────────────┘
                                           │
                                           ▼
                               ┌────────────────────────┐
                               │  Stream Word-by-Word   │
                               │  (20ms delay per word) │
                               └───────────┬────────────┘
                                           │
                                           ▼
                               ┌────────────────────────┐
                               │  Final Payload + Done  │
                               └───────────┬────────────┘
                                           │
                                           ▼
                               ┌────────────────────────┐
                               │  Best-Effort           │
                               │  Persistence           │
                               └────────────────────────┘
```

#### SSE Format

```javascript
// Chunk event
data: {"chunk": "Xin", "done": false}

// Heartbeat
: keep-alive

// Final event
data: {"chunk": "", "done": true, "text": "...", "metadata": {...}}
```

---

### Bước 8: Lưu trữ & Analytics

**File:** `apps/api/core/analytics_service.py`, `apps/api/ai/memory.py`

Sau mỗi response:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PERSISTENCE LAYER                            │
└─────────────────────────────────────────────────────────────────┘

Response ──▶ [Redis Memory] ──▶ [PostgreSQL] ──▶ [Analytics]
                  │                  │                │
                  ▼                  ▼                ▼
           Conversation      ChatSession +      Usage stats
           History          ChatMessage        per tenant
```

#### Redis (Conversation Memory)

```python
# Key: conversation:{tenant_id}:{session_id}
# Value: List of messages
RedisConversationMemory.add_message(role, content)
RedisConversationMemory.get_history()  # Last N messages
```

#### PostgreSQL

```sql
-- ChatSession
INSERT INTO chat_sessions (tenant_id, visitor_id, is_active, ...)
VALUES (..., ..., true, ...)

-- ChatMessage
INSERT INTO chat_messages (session_id, tenant_id, role, content, intent, ...)
VALUES (..., 'user', query, 'RAG', ...)
INSERT INTO chat_messages (session_id, tenant_id, role, content, intent, ...)
VALUES (..., 'assistant', response, 'RAG', ...)
```

#### Analytics

```python
record_turn_analytics(session, tenant_id, intent)
# - Increment turn count
# - Track intent distribution
# - Estimate token usage
```

---

## Sơ đồ luồng đầy đủ

```
┌─────────┐    ┌─────────────┐    ┌────────────┐    ┌─────────────┐
│Visitor  │───▶│Widget SDK   │───▶│FastAPI     │───▶│Middleware   │
└─────────┘    └─────────────┘    └────────────┘    └──────┬──────┘
                                                             │
                    ┌────────────────────────────────────────┤
                    │                                        │
                    ▼                                        ▼
           ┌────────────────┐                    ┌─────────────────┐
           │  POST /chat     │                    │  GET /chat/stream│
           └───────┬─────────┘                    └─────────┬───────┘
                   │                                      │
                   ├──────────────────────────────────────┤
                   │                                      │
        ┌──────────┴──────────┐              ┌───────────┴──────────┐
        │                     │              │                       │
        ▼                     ▼              ▼                       ▼
  ┌───────────┐      ┌───────────┐   ┌───────────┐          ┌─────────────┐
  │Sales Chat │      │Orchestrator│   │  SSE      │          │ Sales Chat  │
  │(action)   │      │(LangGraph) │   │  Stream   │          │ (streaming) │
  └─────┬─────┘      └──────┬─────┘   └─────┬─────┘          └──────┬──────┘
        │                   │                │                       │
        ▼                   ▼                │                       │
  ┌───────────┐      ┌───────────┐         │                       │
  │ Connectors │      │Classifier │         │                       │
  │ Woo/Shpify │      │    ↓      │         │                       │
  └─────┬─────┘      │RAG/SQL/   │         │                       │
        │            │GENERAL    │         │                       │
        ▼            └─────┬─────┘         │                       │
  ┌───────────┐          │               │                       │
  │Product/   │    ┌──────┼──────┐       │                       │
  │Order/Lead │    │      │      │       │                       │
  └─────┬─────┘    ▼      ▼      ▼       │                       │
        └──────┬──┤ RAG │┤ SQL │┤ Genrl │    │                       │
               └─────┘└─────┘└──────┘    │                       │
                     │                    │                       │
                     ▼                    ▼                       ▼
              ┌──────────┐        ┌────────────┐         ┌─────────────┐
              │  Qdrant   │        │ Tenant DB  │         │   SSE       │
              │ (vector)  │        │ (SQL exec) │         │  (word-by-  │
              └──────────┘        └────────────┘         │   word)     │
                                                         └─────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Persistence     │
                    │ ├─ Redis Memory│
                    │ ├─ PostgreSQL   │
                    │ └─ Analytics   │
                    └─────────────────┘
```

---

## Key Files Reference

| File | Mô tả |
|------|-------|
| `apps/api/api/v1/chat.py` | Entry point, routing logic, streaming |
| `apps/api/api/middleware.py` | Security middleware (auth + origin check) |
| `apps/api/ai/orchestrator.py` | LangGraph workflow definition |
| `apps/api/ai/base_agent.py` | Base agent class + AgentResponse model |
| `apps/api/ai/rag_agent.py` | RAG retrieval + generation |
| `apps/api/ai/sql_agent.py` | Text-to-SQL execution |
| `apps/api/ai/vector_store.py` | Qdrant vector store wrapper |
| `apps/api/ai/memory.py` | Redis conversation memory |
| `apps/api/ai/llm.py` | Gemini LLM wrapper |
| `apps/api/services/sales/chat_handler.py` | Sales-specific flows |
| `apps/api/services/connectors/` | WooCommerce, Shopify connectors |
| `apps/api/core/analytics_service.py` | Usage analytics |

---

## Environment Variables

```bash
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=...
POSTGRES_DB=widget_chatbot

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333

# AI
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
EMBEDDING_MODEL=...
EMBEDDING_DIM=768

# Security
SECRET_KEY=...
APP_ENCRYPTION_KEY=...  # AES-256-GCM key for DB credentials

# Payments (Optional)
PAYO_CLIENT_ID=...
PAYO_API_KEY=...
PAYO_CHECKSUM_KEY=...
```

---

## Troubleshooting

### Common Issues

1. **Widget không kết nối được**
   - Kiểm tra `X-Widget-Key` header đúng format (`pk_live_xxx`)
   - Kiểm tra `Origin` header có trong whitelist không

2. **RAG không trả kết quả**
   - Kiểm tra đã upload documents chưa
   - Kiểm tra Qdrant collection có dữ liệu không

3. **SQL Agent lỗi**
   - Kiểm tra database connector đã cấu hình chưa
   - Kiểm tra credentials đã mã hóa đúng chưa

4. **Streaming bị timeout**
   - Kiểm tra Celery worker có chạy không (cho long-running tasks)
   - Tăng `STREAM_HEARTBEAT_INTERVAL_SEC` nếu cần
