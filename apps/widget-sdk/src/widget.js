/**
 * W-010: Widget — Điều phối toàn bộ state và luồng nghiệp vụ.
 */

import { Bubble } from './ui/bubble.js';
import { ChatWindow } from './ui/window.js';
import { Messages } from './ui/messages.js';
import { sendMessage, streamMessage } from './api/client.js';
import { getSessionId, clearSession } from './storage/session.js';
import widgetCss from './styles/widget.css?inline';
import { t } from './i18n.js';

function clampChannel(v) {
  return Math.min(255, Math.max(0, Math.round(v)));
}

function normalizeHexColor(input) {
  const raw = String(input || '').trim();
  const m = raw.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  const hex = m[1].length === 3
    ? m[1].split('').map((ch) => ch + ch).join('')
    : m[1];
  return `#${hex.toLowerCase()}`;
}

function hexToRgb(hex) {
  const value = normalizeHexColor(hex);
  if (!value) return null;
  const clean = value.slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (v) => clampChannel(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function adjustColor(hex, ratio) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const adjust = (c) => c + (ratio < 0 ? c * ratio : (255 - c) * ratio);
  return rgbToHex({
    r: adjust(rgb.r),
    g: adjust(rgb.g),
    b: adjust(rgb.b),
  });
}

export class Widget {
  constructor(config, shadow) {
    this._config = config;
    this._shadow = shadow;
    this._isOpen = false;
    this._isStreaming = false;
    this._sessionId = getSessionId(config.publicKey);

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = widgetCss;
    // Set CSS vars for primary color and font size
    const primaryColor = normalizeHexColor(config.color) || '#4f46e5';
    const hoverColor = adjustColor(primaryColor, -0.12) || '#4338ca';
    const lightColor = adjustColor(primaryColor, 0.9) || '#eef2ff';
    const ff = config.fontFamily === 'serif' ? "Georgia, 'Times New Roman', serif" : "var(--w-font)";
    style.textContent += `:host { --w-color: ${primaryColor}; --w-color-hover: ${hoverColor}; --w-color-light: ${lightColor}; --w-font-size: ${config.fontSize || '14px'}; }`;
    style.textContent += ` .w-window, .w-bubble { font-family: ${ff}; }`;
    shadow.appendChild(style);

    // Expose shadow reference for bar chart canvas queries
    document._xenoWidgetShadow = shadow;
    document._xenoWidgetLocale = config.locale || 'vi';

    // Init UI
    this._bubble = new Bubble(shadow, config.color, () => this.toggle());
    this._chatWindow = new ChatWindow(
      shadow, config,
      (text) => this._handleSend(text),
      () => this.close(),
      () => this._handleReset(),
    );
    this._messages = new Messages(
      this._chatWindow.messagesEl,
      config,
      (action) => this._handleSalesAction(action),
    );

    // Welcome message
    this._messages.appendWelcome();
    this._messages.appendResetButton(() => this._handleReset());
  }

  toggle() {
    this._isOpen ? this.close() : this.open();
  }

  open() {
    this._isOpen = true;
    this._chatWindow.open();
    this._bubble.setOpen(true);
  }

  close() {
    this._isOpen = false;
    this._chatWindow.close();
    this._bubble.setOpen(false);
  }

  async _handleSalesAction(action) {
    if (this._isStreaming) return;
    this._isStreaming = true;
    this._chatWindow.setDisabled(true);
    try {
      this._messages.showTyping();
      const data = await sendMessage(this._config, '', this._sessionId, action);
      this._messages.hideTyping();
      this._messages.appendBot(
        data.content || '…',
        data.component,
        data.citations,
        data.ui_components || [],
      );
      if (!this._isOpen) this._bubble.addUnread();
    } catch (err) {
      this._messages.hideTyping();
      this._messages.appendError(err.message || t(this._config.locale, 'connectError'));
    } finally {
      this._isStreaming = false;
      this._chatWindow.setDisabled(false);
    }
  }

  async _handleSend(text) {
    if (this._isStreaming) return;

    this._messages.appendUser(text);
    this._isStreaming = true;
    this._chatWindow.setDisabled(true);

    const useStream = !!this._config.stream;

    try {
      if (useStream) {
        // W-008: SSE Streaming
        this._messages.startStream();
        await streamMessage(
          this._config,
          text,
          this._sessionId,
          (chunk) => this._messages.appendChunk(chunk),
          (payload) => {
            this._messages.endStream(payload);
            this._bubble.addUnread();
          },
          null,
        );
      } else {
        // W-007: Normal POST
        this._messages.showTyping();
        const data = await sendMessage(this._config, text, this._sessionId, null);
        this._messages.appendBot(
          data.content || '…',
          data.component,
          data.citations,
          data.ui_components || [],
        );
        if (!this._isOpen) this._bubble.addUnread();
      }
    } catch (err) {
      this._messages.hideTyping();
      this._messages.endStream();
      const msg = err.name === 'AbortError'
        ? t(this._config.locale, 'timeoutMessage')
        : (err.message || t(this._config.locale, 'connectError'));
      this._messages.appendError(msg);
    } finally {
      this._isStreaming = false;
      this._chatWindow.setDisabled(false);
    }
  }

  _handleReset() {
    clearSession(this._config.publicKey);
    this._sessionId = getSessionId(this._config.publicKey);
    this._messages.clear();
    this._messages.appendWelcome();
    this._messages.appendResetButton(() => this._handleReset());
    this._bubble.clearBadge();
  }
}
