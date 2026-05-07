function escAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderSalesComponents(uiList, config, onSalesAction) {
  if (!uiList || !uiList.length) return '';
  return uiList.map((block) => renderSalesBlock(block, config, onSalesAction)).join('');
}

function renderSalesBlock(block, config) {
  if (!block || !block.type) return '';
  const d = block.data || {};
  const pc = d.primary_color || config.color || '#2563eb';
  switch (block.type) {
    case 'product_cards': {
      const layout = d.layout === 'list' ? 'w-pc-list' : 'w-pc-grid';
      const cards = (d.products || []).map((p) => {
        const variants = (p.variants || [])
          .filter((v) => Array.isArray(v.values) && v.values.length > 0)
          .map((v, idx) => {
            const opts = v.values
              .map((x) => `<option value="${escAttr(x)}">${escAttr(x)}</option>`)
              .join('');
            return `<label class="w-pc-variant-label">${escAttr(v.key || `variant_${idx}`)}
              <select class="w-pc-variant" data-variant-key="${escAttr(v.key || `variant_${idx}`)}">${opts}</select>
            </label>`;
          })
          .join('');
        return `
        <div class="w-pc-card" data-pid="${escAttr(p.id)}">
          ${(p.images && p.images[0]) ? `<img src="${escAttr(p.images[0].url)}" alt="" loading="lazy">` : ''}
          <div class="w-pc-meta">
            <div class="w-pc-name">${escAttr(p.name)}</div>
            <div class="w-pc-price">${(p.price || 0).toLocaleString('vi-VN')}đ</div>
            ${p.show_stock ? `<div class="w-pc-stock">${p.in_stock ? 'Còn hàng' : 'Hết'}</div>` : ''}
            ${variants ? `<div class="w-pc-variants">${variants}</div>` : ''}
            <label class="w-pc-qty-label">SL
              <input class="w-pc-qty" type="number" min="1" value="1" />
            </label>
            <button type="button" class="w-pc-add" data-product-id="${escAttr(p.id)}" data-external-id="${escAttr(p.external_id || '')}" data-name="${encodeURIComponent(p.name || '')}" data-price="${p.price || 0}">Thêm</button>
          </div>
        </div>`;
      }).join('');
      return `<div class="w-sales w-product-cards ${layout}" style="--w-color:${pc}">${cards}</div>`;
    }
    case 'cart': {
      const lines = (d.items || []).map((it) => `
        <div class="w-cart-line"><span>${escAttr(it.name)}</span><span>x${it.quantity}</span><span>${(it.line_total || 0).toLocaleString('vi-VN')}đ</span></div>`).join('');
      return `<div class="w-sales w-cart" style="--w-color:${pc}">${lines}<div class="w-cart-sub">Tạm tính: <strong>${(d.subtotal || 0).toLocaleString('vi-VN')}đ</strong></div></div>`;
    }
    case 'order_form': {
      const fields = (d.fields || []).map((f) => {
        const req = f.required ? ' required' : '';
        const val = f.prefilled != null ? String(f.prefilled) : '';
        if (f.type === 'textarea') {
          return `<label class="w-of-label">${escAttr(f.label)}<textarea name="${escAttr(f.key)}" class="w-of-input"${req}>${escAttr(val)}</textarea></label>`;
        }
        return `<label class="w-of-label">${escAttr(f.label)}<input type="${f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : 'text'}" name="${escAttr(f.key)}" class="w-of-input" value="${escAttr(val)}"${req}></label>`;
      }).join('');
      return `<form class="w-sales w-order-form" style="--w-color:${pc}">${fields}<button type="submit" class="w-of-submit">Gửi đơn</button></form>`;
    }
    case 'order_confirmation': {
      const items = (d.items || []).map((it) => `<li>${escAttr(it.name)} x${it.quantity}</li>`).join('');
      return `<div class="w-sales w-order-ok" style="--w-color:${pc}"><p>Đơn #${escAttr(d.order_id || '')}</p><ul>${items}</ul><p>Tổng: ${(d.subtotal || 0).toLocaleString('vi-VN')}đ</p></div>`;
    }
    case 'checkout_link': {
      const url = d.url || '#';
      const mins = Number(d.expires_minutes || 30);
      const expiresAt = Date.now() + mins * 60 * 1000;
      return `<div class="w-sales w-checkout-link" style="--w-color:${pc}">
        <a href="${escAttr(url)}" target="_blank" rel="noopener" class="w-cl-btn" data-checkout-link="1" data-expires-at="${expiresAt}">Mở thanh toán</a>
        <div class="w-cl-meta" data-checkout-countdown="1">Link hết hạn sau ${mins}:00</div>
      </div>`;
    }
    case 'payment_selection': {
      const methods = (d.methods || []).filter(Boolean);
      if (!methods.length) {
        return `<div class="w-sales w-pay-hint" style="--w-color:${pc}">Chưa có phương thức thanh toán khả dụng.</div>`;
      }
      const options = methods.map((m, idx) => {
        const key = m.key || `method_${idx}`;
        const checked = idx === 0 ? ' checked' : '';
        const extra = m.bank_info
          ? `<div class="w-pay-bank">${Object.values(m.bank_info).filter(Boolean).map(escAttr).join(' · ')}</div>`
          : '';
        return `<label class="w-pay-opt">
          <input type="radio" name="w-payment-method" value="${escAttr(key)}"${checked}>
          <span>${escAttr(m.label || key)}</span>
          ${extra}
        </label>`;
      }).join('');
      return `<div class="w-sales w-payment-box" style="--w-color:${pc}">
        ${options}
        <button type="button" class="w-pay-submit">Xác nhận thanh toán</button>
      </div>`;
    }
    default:
      return '';
  }
}

export function bindSalesHandlers(rootEl, onSalesAction) {
  if (!rootEl || !onSalesAction) return;
  rootEl.querySelectorAll('.w-pc-add').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.w-pc-card');
      const id = btn.getAttribute('data-product-id');
      const price = parseInt(btn.getAttribute('data-price') || '0', 10);
      const name = decodeURIComponent(btn.getAttribute('data-name') || '');
      const ext = btn.getAttribute('data-external-id') || '';
      const qtyInput = card?.querySelector('.w-pc-qty');
      const quantity = Math.max(1, parseInt(qtyInput?.value || '1', 10) || 1);
      const variantSelect = card?.querySelector('.w-pc-variant');
      const variant_key = variantSelect?.getAttribute('data-variant-key') || null;
      const variant_value = variantSelect?.value || null;
      onSalesAction({
        type: 'add_to_cart',
        data: { product_id: id, quantity, name, price, external_id: ext, variant_key, variant_value },
      });
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
  const payBtn = rootEl.querySelector('.w-pay-submit');
  if (payBtn) {
    payBtn.addEventListener('click', () => {
      const selected = rootEl.querySelector('input[name="w-payment-method"]:checked');
      const paymentMethod = selected?.value || 'cod';
      onSalesAction({ type: 'submit_form', data: { payment_method: paymentMethod } });
    });
  }

  rootEl.querySelectorAll('[data-checkout-link="1"]').forEach((linkEl) => {
    const countdownEl = rootEl.querySelector('[data-checkout-countdown="1"]');
    const expiresAt = parseInt(linkEl.getAttribute('data-expires-at') || '0', 10);
    if (!expiresAt || !countdownEl) return;
    let tid = null;
    const update = () => {
      const msLeft = expiresAt - Date.now();
      if (msLeft <= 0) {
        countdownEl.textContent = 'Link đã hết hạn. Vui lòng nhắn bot để tạo lại.';
        linkEl.classList.add('w-cl-expired');
        linkEl.setAttribute('aria-disabled', 'true');
        linkEl.addEventListener('click', (ev) => ev.preventDefault(), { once: true });
        if (tid) clearInterval(tid);
        return;
      }
      const totalSec = Math.floor(msLeft / 1000);
      const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
      const ss = String(totalSec % 60).padStart(2, '0');
      countdownEl.textContent = `Link hết hạn sau ${mm}:${ss}`;
    };
    update();
    tid = setInterval(update, 1000);
  });
}
