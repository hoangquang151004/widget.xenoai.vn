/**
 * W-006: Message rendering + Markdown + Rich Components
 */
import { t } from '../i18n.js';

/* ── Mini Markdown Parser ───────────────────────────────── */
function parseMarkdown(text) {
  // Escape HTML first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks ```
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  // Inline code `
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold **
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic *
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Unordered list lines starting with "- "
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  // Newlines
  html = html.replace(/\n/g, '<br>');

  return html;
}

/* ── Rich Components ─────────────────────────────────────── */
function renderTable(data) {
  const { columns, rows } = data;
  const ths = columns.map(c => `<th>${c}</th>`).join('');
  const trs = rows.map(r =>
    `<tr>${r.map(cell => `<td>${cell}</td>`).join('')}</tr>`
  ).join('');
  return `<div class="w-component"><table class="w-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

function renderProductGrid(data) {
  const cards = data.map(p => `
    <div class="w-product-card">
      ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy">` : ''}
      <div class="w-product-info">
        <div class="w-product-name">${p.name}</div>
        ${p.price ? `<div class="w-product-price">${p.price}</div>` : ''}
      </div>
    </div>
  `).join('');
  return `<div class="w-component"><div class="w-product-grid">${cards}</div></div>`;
}

function renderBarChart(data) {
  const { labels, values, label } = data;
  const max = Math.max(...values) || 1;
  const canvasId = `wc_${Math.random().toString(36).slice(2)}`;
  // Deferred draw via setTimeout after element is in DOM
  setTimeout(() => {
    const canvas = document._xenoWidgetShadow?.querySelector(`#${canvasId}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const barW = Math.floor((W - 20) / labels.length) - 6;
    ctx.clearRect(0, 0, W, H);
    labels.forEach((lbl, i) => {
      const barH = Math.floor(((values[i] || 0) / max) * (H - 30));
      const x = 10 + i * (barW + 6);
      // Bar
      const color = getComputedStyle(canvas).getPropertyValue('--w-color').trim() || '#4F46E5';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect?.(x, H - 20 - barH, barW, barH, 4) ||
        ctx.rect(x, H - 20 - barH, barW, barH);
      ctx.fill();
      // Label
      ctx.fillStyle = '#6B7280';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lbl.toString().slice(0, 8), x + barW / 2, H - 5);
      // Value
      ctx.fillStyle = '#111827';
      ctx.font = '9px sans-serif';
      ctx.fillText(values[i], x + barW / 2, H - 24 - barH);
    });
  }, 50);

  return `<div class="w-component w-chart-wrap">
    ${label ? `<div class="w-chart-label">${label}</div>` : ''}
    <canvas id="${canvasId}" width="320" height="140" style="width:100%;max-width:320px;"></canvas>
  </div>`;
}

function renderCitations(citations) {
  if (!citations || citations.length === 0) return '';
  const links = citations.map((c, i) => {
    const title = c.metadata?.title || c.source || `Nguồn ${i + 1}`;
    const url = c.metadata?.url || '#';
    return `<a href="${url}" class="w-citation" target="_blank" title="${title}">[${i + 1}]</a>`;
  }).join(' ');
  const locale = document._xenoWidgetLocale || 'vi';
  return `<div class="w-component w-citations-wrap"><span class="w-citations-label">${t(locale, 'references')}</span> ${links}</div>`;
}

function renderComponent(component) {
  if (!component) return '';
  switch (component.type) {
    case 'table':        return renderTable(component.data);
    case 'product_grid': return renderProductGrid(component.data);
    case 'bar_chart':    return renderBarChart(component.data);
    default:             return '';
  }
}

/* ── Sales V2 ui_components ─────────────────────────────── */
function renderSalesComponents(uiList, config, onSalesAction) {
  if (!uiList || !uiList.length) return '';
  return uiList.map((block) => renderSalesBlock(block, config, onSalesAction)).join('');
}

function renderSalesBlock(block, config, onSalesAction) {
  if (!block || !block.type) return '';
  const d = block.data || {};
  const pc = d.primary_color || config.color || '#2563eb';
  switch (block.type) {
    case 'product_cards': {
      const layout = d.layout === 'list' ? 'w-pc-list' : 'w-pc-grid';
      const cards = (d.products || []).map((p) => `
        <div class="w-pc-card" data-pid="${p.id}">
          ${(p.images && p.images[0]) ? `<img src="${p.images[0].url}" alt="" loading="lazy">` : ''}
          <div class="w-pc-meta">
            <div class="w-pc-name">${p.name}</div>
            <div class="w-pc-price">${(p.price || 0).toLocaleString('vi-VN')}đ</div>
            ${p.show_stock ? `<div class="w-pc-stock">${p.in_stock ? 'Còn hàng' : 'Hết'}</div>` : ''}
            <button type="button" class="w-pc-add" data-product-id="${p.id}" data-external-id="${p.external_id || ''}" data-name="${encodeURIComponent(p.name || '')}" data-price="${p.price || 0}">Thêm</button>
          </div>
        </div>`).join('');
      return `<div class="w-sales w-product-cards ${layout}" style="--w-color:${pc}">${cards}</div>`;
    }
    case 'cart': {
      const lines = (d.items || []).map((it) => `
        <div class="w-cart-line"><span>${it.name}</span><span>x${it.quantity}</span><span>${(it.line_total || 0).toLocaleString('vi-VN')}đ</span></div>`).join('');
      return `<div class="w-sales w-cart" style="--w-color:${pc}">${lines}<div class="w-cart-sub">Tạm tính: <strong>${(d.subtotal || 0).toLocaleString('vi-VN')}đ</strong></div></div>`;
    }
    case 'order_form': {
      const fields = (d.fields || []).map((f) => {
        const req = f.required ? ' required' : '';
        const val = f.prefilled != null ? String(f.prefilled) : '';
        if (f.type === 'textarea') {
          return `<label class="w-of-label">${f.label}<textarea name="${f.key}" class="w-of-input"${req}>${val}</textarea></label>`;
        }
        return `<label class="w-of-label">${f.label}<input type="${f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : 'text'}" name="${f.key}" class="w-of-input" value="${val.replace(/"/g, '&quot;')}"${req}></label>`;
      }).join('');
      return `<form class="w-sales w-order-form" style="--w-color:${pc}">${fields}<button type="submit" class="w-of-submit">Gửi đơn</button></form>`;
    }
    case 'order_confirmation': {
      const items = (d.items || []).map((it) => `<li>${it.name} x${it.quantity}</li>`).join('');
      return `<div class="w-sales w-order-ok" style="--w-color:${pc}"><p>Đơn #${d.order_id || ''}</p><ul>${items}</ul><p>Tổng: ${(d.subtotal || 0).toLocaleString('vi-VN')}đ</p></div>`;
    }
    case 'checkout_link': {
      const url = d.url || '#';
      return `<div class="w-sales w-checkout-link" style="--w-color:${pc}"><a href="${url}" target="_blank" rel="noopener" class="w-cl-btn">Mở thanh toán</a></div>`;
    }
    case 'payment_selection':
      return `<div class="w-sales w-pay-hint" style="--w-color:${pc}">Chọn thanh toán (sắp có)</div>`;
    default:
      return '';
  }
}

function bindSalesHandlers(rootEl, onSalesAction) {
  if (!rootEl || !onSalesAction) return;
  rootEl.querySelectorAll('.w-pc-add').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-product-id');
      const price = parseInt(btn.getAttribute('data-price') || '0', 10);
      const name = decodeURIComponent(btn.getAttribute('data-name') || '');
      const ext = btn.getAttribute('data-external-id') || '';
      onSalesAction({ type: 'add_to_cart', data: { product_id: id, quantity: 1, name, price, external_id: ext } });
    });
  });
  const form = rootEl.querySelector('.w-order-form');
  if (form) {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const data = {};
      fd.forEach((v, k) => { data[k] = String(v); });
      onSalesAction({ type: 'submit_form', data });
    });
  }
}

/* ── Time format ─────────────────────────────────────────── */
function fmtTime(d = new Date()) {
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

/* ── Icons ───────────────────────────────────────────────── */
const BOT_ICON = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>`;
const USER_ICON = `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

/* ── Messages class ──────────────────────────────────────── */
export class Messages {
  constructor(container, config, onSalesAction = null) {
    this._container = container;
    this._config = config;
    this._onSalesAction = onSalesAction;
    this._typingEl = null;
    this._streamRow = null;
    this._streamBubble = null;
  }

  appendWelcome() {
    const el = document.createElement('div');
    el.className = 'w-welcome';
    const icon = this._config.avatarUrl ? `<img src="${this._config.avatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : BOT_ICON;
    el.innerHTML = `
      <div class="w-welcome-icon">${icon}</div>
      ${this._config.welcomeMessage.replace(/\n/g, '<br>')}
    `;
    this._container.appendChild(el);
  }

  appendResetButton(onReset) {
    const btn = document.createElement('button');
    btn.className = 'w-reset-btn';
    btn.textContent = t(this._config.locale, 'resetConversation');
    btn.addEventListener('click', onReset);
    this._container.appendChild(btn);
  }

  appendUser(text) {
    const row = this._makeRow('user');
    row.querySelector('.w-bubble-text').innerHTML = this._escape(text);
    this._container.appendChild(row);
    this._scrollDown();
  }

  showTyping() {
    this.hideTyping();
    const row = document.createElement('div');
    row.className = 'w-row w-row--bot';
    row.innerHTML = `
      <div class="w-msg-avatar">${BOT_ICON}</div>
      <div class="w-typing"><span></span><span></span><span></span></div>
    `;
    this._container.appendChild(row);
    this._typingEl = row;
    this._scrollDown();
  }

  hideTyping() {
    if (this._typingEl) {
      this._typingEl.remove();
      this._typingEl = null;
    }
  }

  /** Bắt đầu streaming — tạo bubble rỗng */
  startStream() {
    this.hideTyping();
    const row = this._makeRow('bot');
    const bubble = row.querySelector('.w-bubble-text');
    bubble.innerHTML = `<span class="w-cursor"></span>`;
    this._container.appendChild(row);
    this._streamRow = row;
    this._streamBubble = bubble;
    this._streamText = '';
    this._scrollDown();
  }

  /** Thêm chunk text vào bubble đang stream */
  appendChunk(chunk) {
    if (!this._streamBubble) return;
    this._streamText += chunk;
    this._streamBubble.innerHTML = parseMarkdown(this._streamText) + '<span class="w-cursor"></span>';
    this._scrollDown();
  }

  /** Kết thúc stream — xóa cursor, render component nếu có */
  endStream(payload = {}) {
    const p = typeof payload === 'string' ? { text: payload } : payload;
    const { component, citations, ui_components: uiComponents } = p;
    if (!this._streamBubble) return;
    if (p.text != null) this._streamText = p.text;
    this._streamBubble.innerHTML = parseMarkdown(this._streamText || '');
    
    let extraHtml = '';
    if (citations && citations.length > 0) {
      extraHtml += renderCitations(citations);
    }
    if (component) {
      extraHtml += renderComponent(component);
    }
    if (uiComponents && uiComponents.length) {
      extraHtml += renderSalesComponents(uiComponents, this._config, this._onSalesAction);
    }
    
    if (extraHtml) {
      const wrap = document.createElement('div');
      wrap.className = 'w-sales-wrap';
      wrap.innerHTML = extraHtml;
      this._streamRow?.appendChild(wrap);
      bindSalesHandlers(wrap, this._onSalesAction);
    }
    
    const ts = document.createElement('div');
    ts.className = 'w-timestamp';
    ts.textContent = fmtTime();
    this._streamRow?.appendChild(ts);
    this._streamRow = null;
    this._streamBubble = null;
    this._scrollDown();
  }

  appendBot(text, component, citations, uiComponents = []) {
    this.hideTyping();
    const row = this._makeRow('bot');
    const bubble = row.querySelector('.w-bubble-text');
    bubble.innerHTML = parseMarkdown(text);
    
    let extraHtml = '';
    if (citations && citations.length > 0) {
      extraHtml += renderCitations(citations);
    }
    if (component) {
      extraHtml += renderComponent(component);
    }
    if (uiComponents && uiComponents.length) {
      extraHtml += renderSalesComponents(uiComponents, this._config, this._onSalesAction);
    }
    
    if (extraHtml) {
      const wrap = document.createElement('div');
      wrap.className = 'w-sales-wrap';
      wrap.innerHTML = extraHtml;
      row.appendChild(wrap);
      bindSalesHandlers(wrap, this._onSalesAction);
    }
    
    const ts = document.createElement('div');
    ts.className = 'w-timestamp';
    ts.textContent = fmtTime();
    row.appendChild(ts);
    this._container.appendChild(row);
    this._scrollDown();
  }

  appendError(msg) {
    this.hideTyping();
    const row = this._makeRow('bot');
    const bubble = row.querySelector('.w-bubble-text');
    bubble.style.background = '#FEF2F2';
    bubble.style.color = '#DC2626';
    bubble.textContent = '⚠️ ' + msg;
    this._container.appendChild(row);
    this._scrollDown();
  }

  clear() {
    this._container.innerHTML = '';
    this._typingEl = null;
    this._streamRow = null;
    this._streamBubble = null;
  }

  /* Private */
  _makeRow(type) {
    const row = document.createElement('div');
    row.className = `w-row w-row--${type}`;
    const icon = type === 'bot' 
        ? (this._config.avatarUrl ? `<img src="${this._config.avatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : BOT_ICON) 
        : USER_ICON;
    const avatarClass = 'w-msg-avatar';
    row.innerHTML = `
      <div class="${avatarClass}">${icon}</div>
      <div class="w-bubble-text"></div>
    `;
    return row;
  }

  _escape(t) {
    return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }

  _scrollDown() {
    this._container.scrollTop = this._container.scrollHeight;
  }
}
