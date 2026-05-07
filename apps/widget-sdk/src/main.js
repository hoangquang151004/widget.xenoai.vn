/**
 * W-002: Entry Point — Parse config từ script tag và khởi tạo Widget.
 * Tự động chạy khi file được load.
 */

import { Widget } from './widget.js';
import { resolveLocale } from './i18n.js';
import { applyRemoteConfig } from './config/runtime-config.js';

(function () {
  // Tìm script tag hiện tại (ưu tiên thẻ có data-public-key)
  const script = document.currentScript || 
    document.querySelector('script[src*="widget.js"][data-public-key]');

  if (!script) {
    console.error('[XenoAI Widget] Không tìm thấy script tag hợp lệ. Hãy đảm bảo bạn đã thêm attribute data-public-key.');
    return;
  }

  // W-002: Parse config từ data attributes (Support both data-api-url and data-api-endpoint)
  const apiAttr = script.getAttribute('data-api-url') || script.getAttribute('data-api-endpoint') || 'http://localhost:8001';
  
  const config = {
    publicKey:   script.getAttribute('data-public-key') || '',
    apiEndpoint: apiAttr.replace(/\/$/, ''),
    botName:     script.getAttribute('data-bot-name')     || 'AI Assistant',
    color:       script.getAttribute('data-color')        || '#2563eb',
    placeholder: script.getAttribute('data-placeholder')  || 'Nhập câu hỏi của bạn...',
    position:    script.getAttribute('data-position')     || 'bottom-right',
    stream:      script.getAttribute('data-stream') !== 'false', // default: true
    welcomeMessage: script.getAttribute('data-welcome')    || 'Xin chào! Tôi có thể giúp gì cho bạn?',
    avatarUrl:   script.getAttribute('data-avatar')       || '',
    fontSize:    script.getAttribute('data-font-size')    || '14px',
    showLogo:    script.getAttribute('data-show-logo') !== 'false', // default: true
    locale:      resolveLocale(
      script.getAttribute('data-locale') ||
      (navigator.languages && navigator.languages[0]) ||
      navigator.language ||
      'vi'
    ),
  };

  console.log('[XenoAI Widget] Đang khởi tạo với Public Key:', config.publicKey.substring(0, 12) + '...');

  // ──────────────────────────────────────────────────────────────────────────
  // D-001: Dynamic Configuration Fetching
  // ──────────────────────────────────────────────────────────────────────────
  async function fetchConfig() {
    if (!config.publicKey) return;

    try {
      const response = await fetch(`${config.apiEndpoint}/api/v1/chat/config`, {
        headers: { 
          'X-Widget-Key': config.publicKey,
          'Accept': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        applyRemoteConfig(config, data);
      } else {
        console.warn(`[XenoAI Widget] API trả về lỗi ${response.status}: ${response.statusText}`);
      }
    } catch (e) {
      console.warn('[XenoAI Widget] Không thể tải cấu hình từ backend, sử dụng mặc định.', e);
    }
  }

  // W-003: Tạo Shadow DOM container
  async function initWidget() {
    // Tránh init 2 lần
    if (document.getElementById('ai-chatbot-widget-root')) return;

    // Fetch config trước khi init UI
    await fetchConfig();

    const container = document.createElement('div');
    container.id = 'ai-chatbot-widget-root';
    
    // Áp dụng vị trí dựa trên config
    const isLeft = config.position === 'bottom-left';
    container.style.cssText = `position:fixed;z-index:2147483647;bottom:0;${isLeft ? 'left:0' : 'right:0'};pointer-events:none;`;
    document.body.appendChild(container);

    const shadow = container.attachShadow({ mode: 'open' });

    // Wrapper để pointer-events hoạt động chỉ trên các phần tử con
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `position:fixed;bottom:0;${isLeft ? 'left:0' : 'right:0'};pointer-events:none;`;
    shadow.appendChild(wrapper);

    // Overwrite shadow reference với wrapper shadow
    new Widget(config, shadow);
  }

  // Khởi động sau khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
