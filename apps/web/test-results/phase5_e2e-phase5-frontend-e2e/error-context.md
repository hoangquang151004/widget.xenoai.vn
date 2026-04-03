# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase5_e2e.spec.js >> phase5 frontend e2e
- Location: phase5_e2e.spec.js:3:1

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator:  locator('input[placeholder="Tên bot"]')
Expected: "Bot E2E 1775188934712"
Received: "Tro ly AI"
Timeout:  5000ms

Call log:
  - Expect "toHaveValue" with timeout 5000ms
  - waiting for locator('input[placeholder="Tên bot"]')
    7 × locator resolved to <input value="Tro ly AI" placeholder="Tên bot" class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"/>
      - unexpected value "Tro ly AI"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e6]: psychology
        - generic [ref=e7]:
          - heading "E2E Company" [level=1] [ref=e8]
          - paragraph [ref=e9]: Bảng điều khiển
      - navigation [ref=e10]:
        - link "dashboard Tổng quan" [ref=e11] [cursor=pointer]:
          - /url: /dashboard
          - generic [ref=e12]: dashboard
          - generic [ref=e13]: Tổng quan
        - link "database Cơ sở tri thức (RAG)" [ref=e14] [cursor=pointer]:
          - /url: /dashboard/knowledge-base
          - generic [ref=e15]: database
          - generic [ref=e16]: Cơ sở tri thức (RAG)
        - link "table_chart Cơ sở dữ liệu (SQL)" [ref=e17] [cursor=pointer]:
          - /url: /dashboard/database
          - generic [ref=e18]: table_chart
          - generic [ref=e19]: Cơ sở dữ liệu (SQL)
        - link "widgets Cấu hình Widget" [ref=e20] [cursor=pointer]:
          - /url: /dashboard/settings
          - generic [ref=e21]: widgets
          - generic [ref=e22]: Cấu hình Widget
        - link "vpn_key Khóa API" [ref=e23] [cursor=pointer]:
          - /url: /dashboard/keys
          - generic [ref=e24]: vpn_key
          - generic [ref=e25]: Khóa API
        - link "payments Gói dịch vụ & Thanh toán" [ref=e26] [cursor=pointer]:
          - /url: /dashboard/billing
          - generic [ref=e27]: payments
          - generic [ref=e28]: Gói dịch vụ & Thanh toán
      - generic [ref=e29]:
        - 'button "Gói: Professional" [ref=e30] [cursor=pointer]'
        - link "help Hỗ trợ" [ref=e31] [cursor=pointer]:
          - /url: /dashboard/support
          - generic [ref=e32]: help
          - generic [ref=e33]: Hỗ trợ
        - button "logout Đăng xuất" [ref=e34] [cursor=pointer]:
          - generic [ref=e35]: logout
          - generic [ref=e36]: Đăng xuất
    - main [ref=e37]:
      - generic [ref=e38]:
        - generic [ref=e40]:
          - generic [ref=e41]: home
          - generic [ref=e42]: chevron_right
          - generic [ref=e43]: Dashboard
        - generic [ref=e44]:
          - generic [ref=e45]:
            - generic [ref=e46]: search
            - textbox "Tìm kiếm hệ thống..." [ref=e47]
          - generic [ref=e48]:
            - button "dark_mode" [ref=e49] [cursor=pointer]:
              - generic [ref=e50]: dark_mode
            - button "notifications" [ref=e51] [cursor=pointer]:
              - generic [ref=e52]: notifications
            - img "User Profile" [ref=e55]
      - generic [ref=e57]:
        - generic [ref=e59]:
          - heading "Cấu hình Widget & AI" [level=2] [ref=e60]
          - paragraph [ref=e61]: Thiết lập giao diện chatbot và hành vi mô hình AI.
        - generic [ref=e62]: Too many admin requests. Please try again later.
        - generic [ref=e63]:
          - generic [ref=e64]:
            - generic [ref=e65]:
              - generic [ref=e66]:
                - heading "Public Key" [level=3] [ref=e67]
                - button "Sao chép" [ref=e68] [cursor=pointer]
              - textbox [ref=e69]: pk_live_mozXY56Z8T0lmbSMrCD3z_PGmaYXrwUP5DpzuM4Hkyk
            - generic [ref=e70]:
              - generic [ref=e71]:
                - heading "Widget Config" [level=3] [ref=e72]
                - button "Lưu Widget" [ref=e73] [cursor=pointer]
              - generic [ref=e74]:
                - textbox "Tên bot" [ref=e75]: Tro ly AI
                - textbox "Logo URL (optional)" [ref=e76]
                - textbox "Lời chào" [ref=e77]: Xin chao! Toi co the giup gi cho ban?
                - textbox "Placeholder" [ref=e78]: Nhap cau hoi...
                - generic [ref=e79]:
                  - textbox [ref=e80]: "#2563eb"
                  - textbox [ref=e81]: "#2563eb"
                - textbox "Font size, ví dụ 14px" [ref=e82]: 14px
                - combobox [ref=e83]:
                  - option "bottom-right" [selected]
                  - option "bottom-left"
                - generic [ref=e84]:
                  - checkbox "Hiển thị nguồn trả lời (show_sources)" [checked] [ref=e85]
                  - text: Hiển thị nguồn trả lời (show_sources)
            - generic [ref=e86]:
              - generic [ref=e87]:
                - heading "AI Settings" [level=3] [ref=e88]
                - button "Lưu AI" [ref=e89] [cursor=pointer]
              - textbox [ref=e90]: Ban la mot tro ly AI chuyen nghiep va than thien.
              - generic [ref=e91]:
                - generic [ref=e92]:
                  - checkbox "Bật RAG" [checked] [ref=e93]
                  - text: Bật RAG
                - generic [ref=e94]:
                  - checkbox "Bật SQL" [ref=e95]
                  - text: Bật SQL
                - generic [ref=e96]:
                  - generic [ref=e97]: "Temperature: 0.70"
                  - slider [ref=e98]: "0.7"
                - generic [ref=e99]:
                  - text: Max tokens
                  - spinbutton [ref=e100]: "2048"
          - complementary [ref=e101]:
            - generic [ref=e102]:
              - heading "Live Preview" [level=3] [ref=e103]
              - generic [ref=e104]:
                - generic [ref=e105]:
                  - paragraph [ref=e106]: Tro ly AI
                  - paragraph [ref=e107]: Online
                - generic [ref=e108]:
                  - generic [ref=e109]: Xin chao! Toi co the giup gi cho ban?
                  - generic [ref=e110]: "Vị trí: bottom-right"
                  - generic [ref=e111]: "show_sources: true"
                - generic [ref=e112]: Nhap cau hoi...
  - generic [ref=e117] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e118]:
      - img [ref=e119]
    - generic [ref=e122]:
      - button "Open issues overlay" [ref=e123]:
        - generic [ref=e124]:
          - generic [ref=e125]: "0"
          - generic [ref=e126]: "1"
        - generic [ref=e127]: Issue
      - button "Collapse issues badge" [ref=e128]:
        - img [ref=e129]
  - alert [ref=e131]
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | 
  3  | test('phase5 frontend e2e', async ({ page }) => {
  4  |   const base = 'http://localhost:3000';
  5  |   const ts = Date.now();
  6  |   const email = `e2e_${ts}@test.com`;
  7  |   const password = 'password123';
  8  |   const slug = `e2e-${ts}`;
  9  |   const botName = `Bot E2E ${ts}`;
  10 |   const keyLabel = `E2E-${ts}`;
  11 | 
  12 |   await page.goto(`${base}/register`);
  13 |   await page.fill('#name', 'E2E Company');
  14 |   await page.fill('#slug', slug);
  15 |   await page.fill('#email', email);
  16 |   await page.fill('#password', password);
  17 |   await page.click('button:has-text("Khởi tạo tài khoản")');
  18 |   await page.waitForURL('**/dashboard', { timeout: 30000 });
  19 | 
  20 |   await page.goto(`${base}/dashboard/settings`);
  21 |   await page.fill('input[placeholder="Tên bot"]', botName);
  22 |   await page.click('button:has-text("Lưu Widget")');
  23 |   await expect(page.getByText('Đã lưu cấu hình widget.')).toBeVisible({ timeout: 15000 });
  24 |   await page.reload();
> 25 |   await expect(page.locator('input[placeholder="Tên bot"]')).toHaveValue(botName);
     |                                                              ^ Error: expect(locator).toHaveValue(expected) failed
  26 | 
  27 |   await page.goto(`${base}/dashboard/keys`);
  28 |   await expect(page.getByText('Danh sách API Keys')).toBeVisible({ timeout: 15000 });
  29 |   const beforeRows = await page.locator('tbody tr').count();
  30 |   await page.click('button:has-text("Tạo Key mới")');
  31 |   await page.fill('input[placeholder="Label"]', keyLabel);
  32 |   await page.click('button:has-text("Tạo key")');
  33 |   await expect(page.getByText('Hãy sao chép key này ngay.')).toBeVisible({ timeout: 15000 });
  34 |   await page.click('button:has-text("Sao chép key")');
  35 |   await page.click('button:has(span:has-text("close"))');
  36 |   await page.waitForTimeout(1000);
  37 |   const afterRows = await page.locator('tbody tr').count();
  38 |   expect(afterRows).toBeGreaterThanOrEqual(beforeRows);
  39 |   await expect(page.locator(`tbody tr:has-text("${keyLabel}")`)).toHaveCount(1);
  40 | 
  41 |   await page.goto(`${base}/dashboard/knowledge-base`);
  42 |   await page.locator('input[type="file"]').setInputFiles({
  43 |     name: 'e2e-knowledge.txt',
  44 |     mimeType: 'text/plain',
  45 |     buffer: Buffer.from('Xin chao. Tai lieu E2E kiem thu cho phase 5.')
  46 |   });
  47 |   await expect(page.getByText('Tải lên thành công. Hệ thống đang xử lý tài liệu.')).toBeVisible({ timeout: 20000 });
  48 |   await expect(page.locator('tbody tr:has-text("e2e-knowledge.txt")')).toHaveCount(1);
  49 | 
  50 |   console.log(JSON.stringify({ email, slug, botName, keyLabel }, null, 2));
  51 | });
  52 | 
```