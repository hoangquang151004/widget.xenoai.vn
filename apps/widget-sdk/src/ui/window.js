/**
 * W-005: Chat Window Panel
 */

const CLOSE_ICON = `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
const EXPAND_ICON = `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm0-4h2V7h3V5H5v5zm10 7h-3v2h5v-5h-2v3zm0-12V5h-5v2h3v3h2V5z"/></svg>`;
const COLLAPSE_ICON = `<svg viewBox="0 0 24 24"><path d="M14 10h5V5h-5v2h1.59L13 9.59 14.41 11 17 8.41V10zM10 5H5v5h2V8.41L9.59 11 11 9.59 8.41 7H10V5zm7 10h2v5h-5v-2h1.59L13 15.41 14.41 14 17 16.59V15zM9.59 14 7 16.59V15H5v5h5v-2H8.41L11 15.41 9.59 14z"/></svg>`;
const BOT_AVATAR = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>`;
const SEND_ICON = `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
import { t } from '../i18n.js';

export class ChatWindow {
  constructor(shadow, config, onSend, onClose, onReset) {
    this._shadow = shadow;
    this._config = config;
    this._onSend = onSend;
    this._onClose = onClose;
    this._onReset = onReset;
    this._el = null;
    this._textarea = null;
    this._sendBtn = null;
    this._expandBtn = null;
    this._isExpanded = false;
    this.messagesEl = null;
    this._render();
  }

  _render() {
    const win = document.createElement('div');
    win.className = 'w-window';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', `Chat với ${this._config.botName}`);

    win.innerHTML = `
      <!-- Header -->
      <div class="w-header">
        <div class="w-avatar">
          ${this._config.avatarUrl ? `<img src="${this._config.avatarUrl}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : BOT_AVATAR}
        </div>
        <div class="w-header-info">
          <div class="w-bot-name">${this._config.botName}</div>
          <div class="w-bot-status"><span class="w-dot"></span>${t(this._config.locale, 'botOnline')}</div>
        </div>
        <div class="w-header-actions">
          <button class="w-expand-btn" aria-label="Phóng to">${EXPAND_ICON}</button>
          <button class="w-close-btn" aria-label="${t(this._config.locale, 'close')}">${CLOSE_ICON}</button>
        </div>
      </div>

      <!-- Messages -->
      <div class="w-messages" role="log" aria-live="polite"></div>

      <!-- Input -->
      <div class="w-input-area">
        <textarea
          class="w-textarea"
          rows="1"
          placeholder="${this._config.placeholder}"
          aria-label="${t(this._config.locale, 'inputAria')}"
        ></textarea>
        <button class="w-send-btn" aria-label="Gửi">${SEND_ICON}</button>
      </div>

      <!-- Footer -->
      ${this._config.showLogo ? `<div class="w-footer">${t(this._config.locale, 'poweredBy')} <a href="https://stitch.com" target="_blank">STITCH</a></div>` : ''}
    `;

    // Refs
    this.messagesEl = win.querySelector('.w-messages');
    this._textarea = win.querySelector('.w-textarea');
    this._sendBtn = win.querySelector('.w-send-btn');
    this._expandBtn = win.querySelector('.w-expand-btn');

    // Close button
    win.querySelector('.w-close-btn').addEventListener('click', this._onClose);
    this._expandBtn.addEventListener('click', () => this._toggleExpand());

    // Send button
    this._sendBtn.addEventListener('click', () => this._submit());

    // Keyboard
    this._textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._submit();
      }
    });

    // Auto resize textarea
    this._textarea.addEventListener('input', () => {
      this._textarea.style.height = 'auto';
      this._textarea.style.height = Math.min(this._textarea.scrollHeight, 100) + 'px';
    });

    this._shadow.appendChild(win);
    this._el = win;
  }

  _toggleExpand() {
    this._isExpanded = !this._isExpanded;
    this._el.classList.toggle('w-window--expanded', this._isExpanded);
    if (this._expandBtn) {
      this._expandBtn.innerHTML = this._isExpanded ? COLLAPSE_ICON : EXPAND_ICON;
      this._expandBtn.setAttribute('aria-label', this._isExpanded ? 'Thu nhỏ' : 'Phóng to');
    }
  }

  _submit() {
    const text = this._textarea.value.trim();
    if (!text) return;
    this._textarea.value = '';
    this._textarea.style.height = 'auto';
    this._onSend(text);
  }

  open() {
    this._el.classList.add('w-window--open');
    // Focus input when opening
    setTimeout(() => this._textarea.focus(), 250);
  }

  close() {
    this._el.classList.remove('w-window--open');
  }

  setDisabled(disabled) {
    this._textarea.disabled = disabled;
    this._sendBtn.disabled = disabled;
  }
}
