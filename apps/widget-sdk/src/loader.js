(function() {
  // ⚠️ DEPRECATED — Không dùng file này. Dùng dist/chatbot-embed.js (React widget).
  console.warn('[XenoAI] loader.js is deprecated. Use dist/chatbot-embed.js (React widget) instead.');

  const SCRIPT_ID = 'chatbot-widget-sdk';
  const IFRAME_ID = 'chatbot-widget-iframe';
  const API_URL = 'http://localhost:8000'; // Default dev API URL
  const CHAT_UI_URL = 'http://localhost:3000/widget'; // Next.js widget route

  class ChatbotWidget {
    constructor() {
      this.scriptTag = document.getElementById(SCRIPT_ID);
      if (!this.scriptTag) {
        this.scriptTag = document.currentScript;
      }
      
      this.apiKey = this.scriptTag.getAttribute('data-api-key');
      this.config = {
        primaryColor: this.scriptTag.getAttribute('data-primary-color') || '#2563eb',
        title: this.scriptTag.getAttribute('data-title') || 'AI Assistant',
      };

      if (!this.apiKey) {
        console.error('ChatbotWidget: Missing data-api-key attribute on script tag.');
        return;
      }

      this.init();
    }

    init() {
      if (document.readyState === 'complete') {
        this.render();
      } else {
        window.addEventListener('load', () => this.render());
      }
      this.setupListeners();
    }

    render() {
      if (document.getElementById(IFRAME_ID)) return;

      const iframe = document.createElement('iframe');
      iframe.id = IFRAME_ID;
      iframe.src = `${CHAT_UI_URL}?apiKey=${this.apiKey}`;
      
      // Basic styles for the iframe container
      Object.assign(iframe.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '60px',
        height: '60px',
        border: 'none',
        zIndex: '999999',
        transition: 'all 0.3s ease',
        borderRadius: '12px',
        overflow: 'hidden',
        colorScheme: 'light'
      });

      document.body.appendChild(iframe);
      this.iframe = iframe;
    }

    setupListeners() {
      window.addEventListener('message', (event) => {
        // Security: In production, check event.origin matches CHAT_UI_URL origin
        const { type, payload } = event.data;

        switch (type) {
          case 'WIDGET_RESIZE':
            this.handleResize(payload);
            break;
          case 'WIDGET_READY':
            this.sendConfig();
            break;
        }
      });
    }

    handleResize(payload) {
      if (!this.iframe) return;
      
      if (payload.state === 'expanded') {
        this.iframe.style.width = window.innerWidth < 480 ? '100%' : '400px';
        this.iframe.style.height = window.innerWidth < 480 ? '100%' : '600px';
        if (window.innerWidth < 480) {
          this.iframe.style.bottom = '0';
          this.iframe.style.right = '0';
          this.iframe.style.borderRadius = '0';
        }
      } else {
        this.iframe.style.width = '60px';
        this.iframe.style.height = '60px';
        this.iframe.style.bottom = '20px';
        this.iframe.style.right = '20px';
        this.iframe.style.borderRadius = '12px';
      }
    }

    sendConfig() {
      this.iframe.contentWindow.postMessage({
        type: 'WIDGET_CONFIG',
        payload: this.config
      }, '*');
    }
  }

  // Initialize
  new ChatbotWidget();
})();
