/**
 * W-002: Entry Point — React Widget (thay the Vanilla JS)
 * Tu dong chay khi file duoc load.
 */

// Re-export React widget — bắt buộc `.tsx`: trên Windows `./Widget` có thể resolve nhầm sang `widget.js` (vanilla)
import { Widget } from './Widget.tsx'
import { normalizeApiV1Base } from './api-base'

export { normalizeApiV1Base } from './api-base'

// Keep backward compatibility with existing script tag config
declare global {
  interface Window {
    WidgetChatbot?: {
      widget: Widget | null
      init: (options: { apiKey: string; apiBase?: string }) => Widget
    }
  }
}

function findWidgetScriptTag(): HTMLScriptElement | null {
  const scripts = document.querySelectorAll('script[src]')
  /** IIFE build: widget.js — Dev Vite: /src/main.tsx (document.currentScript null với module) */
  const isEntry = (el: HTMLScriptElement) => {
    const src = el.src || ''
    return (
      src.includes('widget') ||
      src.includes('/main.tsx') ||
      src.includes('/main.ts') ||
      src.includes('/src/main')
    )
  }
  let withKey: HTMLScriptElement | null = null
  let anyEntry: HTMLScriptElement | null = null
  for (const s of scripts) {
    const el = s as HTMLScriptElement
    if (!isEntry(el)) continue
    anyEntry = el
    if (el.getAttribute('data-public-key')) withKey = el
  }
  return withKey || anyEntry
}

(function () {
  const script = findWidgetScriptTag()

  if (!script) {
    console.error(
      '[Widget Chatbot] Khong tim thay script tag (can src chua widget.js hoac /src/main.tsx).',
    )
    return
  }

  const publicKey: string = script.getAttribute('data-public-key') || ''
  if (!publicKey) {
    console.error('[Widget Chatbot] Missing data-public-key attribute.')
    return
  }

  let apiUrl = normalizeApiV1Base('http://localhost:8001')
  const attrUrl = script.getAttribute('data-api-url') ||
    script.getAttribute('data-api-endpoint')
  if (attrUrl) {
    apiUrl = normalizeApiV1Base(attrUrl)
  }

  console.log('[Widget Chatbot] Dang khoi tao voi Public Key:', publicKey.substring(0, 12) + '...')
  console.log('[Widget Chatbot] API Base:', apiUrl)

  const useStream = script.getAttribute('data-stream') === 'true' || script.getAttribute('data-stream') === '1'

  function initWidget() {
    console.log('[Widget Chatbot] Bat dau khoi tao Widget...')

    if (document.getElementById('widget-chatbot-container')) {
      console.log('[Widget Chatbot] Widget da duoc khoi tao.')
      return
    }

    if (!document.body) {
      console.error('[Widget Chatbot] document.body chua ton tai, thu lai...')
      setTimeout(initWidget, 100)
      return
    }

    const widget = new Widget({
      apiKey: publicKey,
      apiBase: apiUrl,
      useStream,
    })

    if (!window.WidgetChatbot) {
      window.WidgetChatbot = {} as Window['WidgetChatbot']
    }
    window.WidgetChatbot!.widget = widget
    console.log('[Widget Chatbot] Widget khoi tao thanh cong!')
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget)
  } else {
    initWidget()
  }
})()

// Export for manual initialization
export { Widget }