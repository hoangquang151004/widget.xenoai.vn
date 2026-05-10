import React from 'react'
import { createRoot, Root } from 'react-dom/client'
import {
  ChatBubble,
  ChatWindow,
  MessageList,
  ChatComposer,
  SalesPanel,
  apiResponseToWidgetConfig,
} from '@widget-chatbot/ui'
import type { ChatMessage, WidgetConfig, Product } from '@widget-chatbot/ui'
import { normalizeApiV1Base } from './api-base'
import { sendMessage, streamMessage } from './api/client'
import { getSessionId, clearSession } from './storage/session'

interface WidgetOptions {
  apiKey: string
  apiBase?: string
  /** POST /chat/stream khi true (data-stream trên script). */
  useStream?: boolean
  container?: HTMLElement
}

/** Relative base khi không truyền apiBase. */
const DEFAULT_API_BASE = '/api/v1'

function assistantFromApiPayload(data: Record<string, unknown>, id: string): ChatMessage {
  const text = (data.text ?? data.content ?? '') as string
  const uiRaw = data.ui_components
  const ui_components = Array.isArray(uiRaw) ? (uiRaw as ChatMessage['ui_components']) : undefined
  const citations = Array.isArray(data.citations) ? (data.citations as ChatMessage['citations']) : undefined
  const component = (data.component ?? null) as ChatMessage['component']

  return {
    id,
    role: 'assistant',
    content: text || '…',
    timestamp: new Date(),
    ui_components,
    citations,
    component,
    metadata: typeof data.metadata === 'object' && data.metadata ? (data.metadata as Record<string, unknown>) : undefined,
  }
}

export class Widget {
  private container!: HTMLElement
  private shadowRoot!: ShadowRoot
  private root: Root | null = null
  private config: WidgetConfig | null = null
  private initError: string | null = null
  private options: WidgetOptions
  private apiV1Base = ''
  private sessionId: string
  private messages: ChatMessage[] = []
  private isSending = false
  private isOpen = false
  private unreadCount = 0
  private mountedElement: HTMLElement | null = null
  private salesPanelOpen = false
  private selectedProduct: Product | undefined = undefined
  private products: Product[] = []

  constructor(options: WidgetOptions) {
    this.options = options
    this.sessionId = getSessionId(options.apiKey)
    this.container = options.container || this.createContainer()
    console.log('[Widget] Container:', this.container)

    if (!this.container) {
      console.error('[Widget] Loi: container khong ton tai!')
      return
    }

    console.log('[Widget] Tao Shadow DOM...')
    try {
      this.shadowRoot = this.container.attachShadow({ mode: 'open' })
      console.log('[Widget] Shadow DOM created:', this.shadowRoot)
    } catch (e) {
      console.error('[Widget] Loi tao Shadow DOM:', e)
      return
    }

    this.injectStyles()
    this.mountedElement = document.createElement('div')
    this.mountedElement.id = 'widget-chatbot-root'
    this.shadowRoot.appendChild(this.mountedElement)
    this.root = createRoot(this.mountedElement)
    this.init()
  }

  private createContainer(): HTMLElement {
    console.log('[Widget] Tao container moi...')

    if (!document.body) {
      console.error('[Widget] document.body chua ton tai!')
      const tempContainer = document.createElement('div')
      tempContainer.id = 'widget-chatbot-container-temp'
      document.documentElement.appendChild(tempContainer)
      return tempContainer
    }

    const container = document.createElement('div')
    container.id = 'widget-chatbot-container'
    document.body.appendChild(container)
    console.log('[Widget] Container da append:', container)
    return container
  }

  private injectStyles() {
    const style = document.createElement('style')
    style.textContent = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
    `
    this.shadowRoot.appendChild(style)
  }

  private async init() {
    try {
      console.log('[Widget] Bat dau fetch config tu:', this.options.apiBase || '/api')
      const config = await this.fetchConfig()
      console.log('[Widget] Da nhan duoc config:', config)
      this.config = apiResponseToWidgetConfig(config)
      const rawBase = (this.options.apiBase || DEFAULT_API_BASE).trim()
      const forNorm =
        rawBase.startsWith('http://') || rawBase.startsWith('https://') || rawBase.startsWith('/')
          ? rawBase
          : `/${rawBase}`
      this.apiV1Base = normalizeApiV1Base(forNorm).replace(/\/$/, '')

      this.messages = [
        {
          id: 'welcome',
          role: 'assistant',
          content: this.config.welcomeMessage,
          timestamp: new Date(),
        },
      ]
      this.render()
    } catch (error) {
      console.error('[Widget] Loi khi khoi tao:', error)
      this.initError =
        error instanceof Error ? error.message : 'Không thể tải cấu hình widget.'
      this.renderError()
    }
  }

  private async fetchConfig(): Promise<Record<string, unknown>> {
    const rawBase = (this.options.apiBase || DEFAULT_API_BASE).trim()
    const forNorm =
      rawBase.startsWith('http://') ||
      rawBase.startsWith('https://') ||
      rawBase.startsWith('/')
        ? rawBase
        : `/${rawBase}`
    const apiBase = normalizeApiV1Base(forNorm).replace(/\/$/, '')
    const url = `${apiBase}/chat/config`
    const response = await fetch(url, {
      headers: {
        'X-Widget-Key': this.options.apiKey,
      },
    })
    if (!response.ok) {
      throw new Error(
        `Widget config lỗi HTTP ${response.status}: ${url}. Kiểm tra API và public key.`,
      )
    }
    return response.json()
  }

  private renderError() {
    if (!this.root) return
    const msg =
      this.initError ||
      'Không thể tải cấu hình widget. Kiểm tra API, CORS và allowed origins.'
    this.root.render(
      <div
        style={{
          position: 'fixed',
          right: '16px',
          bottom: '16px',
          zIndex: 2147483647,
          fontFamily: 'system-ui, sans-serif',
          padding: '16px',
          maxWidth: 'min(320px, calc(100vw - 32px))',
          color: '#b91c1c',
          background: '#fef2f2',
          borderRadius: '12px',
          fontSize: '12px',
          lineHeight: 1.5,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}
      >
        <strong style={{ display: 'block', marginBottom: '8px' }}>Widget</strong>
        {msg}
      </div>,
    )
  }

  private handleBubbleClick = () => {
    this.isOpen = !this.isOpen
    if (this.isOpen) {
      this.unreadCount = 0
    }
    this.render()
  }

  private handleClose = () => {
    this.isOpen = false
    this.render()
  }

  private handleReset = () => {
    clearSession(this.options.apiKey)
    this.sessionId = getSessionId(this.options.apiKey)
    if (this.config) {
      this.messages = [
        {
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          content: this.config.welcomeMessage,
          timestamp: new Date(),
        },
      ]
    }
    this.render()
  }

  private openSalesPanel = (data?: Record<string, unknown>) => {
    if (data?.product) {
      this.selectedProduct = data.product as Product
    }
    this.salesPanelOpen = true
    this.render()
  }

  private closeSalesPanel = () => {
    this.salesPanelOpen = false
    this.selectedProduct = undefined
    this.render()
  }

  /** Gửi action sales: body.action = { type, data }. */
  private dispatchSalesAction = async (type: string, data: Record<string, unknown>) => {
    if (this.isSending || !this.config) return
    this.isSending = true
    this.render()
    try {
      const payload = await sendMessage(
        { apiV1Base: this.apiV1Base, publicKey: this.options.apiKey },
        '',
        this.sessionId,
        { type, data },
      )
      const assistant = assistantFromApiPayload(payload, `a-${Date.now()}`)
      this.messages = [...this.messages, assistant]
      if (!this.isOpen) this.unreadCount += 1
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Lỗi kết nối'
      this.messages = [
        ...this.messages,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ ${err}`,
          timestamp: new Date(),
        },
      ]
    } finally {
      this.isSending = false
      this.render()
    }
  }

  private handleSend = async (text: string) => {
    if (this.isSending || !this.config || !text.trim()) return
    const q = text.trim()
    this.isSending = true

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: q,
      timestamp: new Date(),
    }
    this.messages = [...this.messages, userMsg]

    const streamId = `stream-${Date.now()}`
    if (this.options.useStream) {
      this.messages = [
        ...this.messages,
        {
          id: streamId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          isStreaming: true,
        },
      ]
    }
    this.render()

    const apiConfig = { apiV1Base: this.apiV1Base, publicKey: this.options.apiKey }

    try {
      if (this.options.useStream) {
        await streamMessage(
          apiConfig,
          q,
          this.sessionId,
          (chunk: string) => {
            this.messages = this.messages.map((m) =>
              m.id === streamId ? { ...m, content: m.content + chunk } : m,
            )
            this.render()
          },
          (payload: Record<string, unknown>) => {
            const textFinal = (payload.text ?? '') as string
            const uiRaw = payload.ui_components
            const ui_components = Array.isArray(uiRaw) ? uiRaw : undefined
            this.messages = this.messages.map((m) =>
              m.id === streamId
                ? {
                    ...m,
                    content: textFinal || m.content || '…',
                    isStreaming: false,
                    ui_components,
                    citations: payload.citations as ChatMessage['citations'],
                    component: payload.component as ChatMessage['component'],
                    metadata:
                      typeof payload.metadata === 'object' && payload.metadata
                        ? (payload.metadata as Record<string, unknown>)
                        : undefined,
                  }
                : m,
            )
            if (!this.isOpen) this.unreadCount += 1
            this.isSending = false
            this.render()
          },
          null,
        )
      } else {
        const data = await sendMessage(apiConfig, q, this.sessionId, null)
        const assistant = assistantFromApiPayload(data, `a-${Date.now()}`)
        this.messages = [...this.messages, assistant]
        if (!this.isOpen) this.unreadCount += 1
        this.isSending = false
        this.render()
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Lỗi kết nối'
      if (this.options.useStream) {
        this.messages = this.messages.filter((m) => m.id !== streamId)
      }
      this.messages = [
        ...this.messages,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ ${err}`,
          timestamp: new Date(),
        },
      ]
      this.isSending = false
      this.render()
    }
  }

  render() {
    if (!this.root || !this.config) return

    const resetBtn = (
      <button
        type="button"
        onClick={this.handleReset}
        style={{
          fontSize: '11px',
          padding: '4px 8px',
          borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.5)',
          background: 'rgba(255,255,255,0.15)',
          color: '#fff',
          cursor: 'pointer',
          marginRight: '4px',
        }}
      >
        Làm mới
      </button>
    )

    this.root.render(
      <>
        <ChatBubble
          primaryColor={this.config.primaryColor}
          position={this.config.position}
          isOpen={this.isOpen}
          onClick={this.handleBubbleClick}
          unreadCount={this.unreadCount}
        />
        <ChatWindow
          config={this.config}
          isOpen={this.isOpen}
          onClose={this.handleClose}
          headerExtra={resetBtn}
          footer={
            <ChatComposer
              placeholder={this.config.placeholder || 'Nhập tin nhắn...'}
              primaryColor={this.config.primaryColor}
              disabled={this.isSending}
              onSend={(t) => void this.handleSend(t)}
            />
          }
        >
          <MessageList
            messages={this.messages}
            config={this.config}
            onAction={(action, payload) => void this.dispatchSalesAction(action, payload)}
            onOpenSalesPanel={this.openSalesPanel}
          />
        </ChatWindow>
        <SalesPanel
          isOpen={this.salesPanelOpen}
          onClose={this.closeSalesPanel}
          config={this.config}
          initialProduct={this.selectedProduct}
          onAction={(action, payload) => void this.dispatchSalesAction(action, payload)}
        />
      </>,
    )
  }

  destroy() {
    if (this.root) {
      this.root.unmount()
      this.root = null
    }
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
  }
}

export default Widget
