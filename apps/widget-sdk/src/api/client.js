/**
 * W-007 + W-008: API Client — POST chat + SSE streaming.
 * apiV1Base: URL đã chuẩn hóa .../api/v1 (hoặc truyền apiEndpoint origin — tự resolve).
 */

const REQUEST_TIMEOUT_MS = 100_000;
const STREAM_IDLE_TIMEOUT_MS = 300_000;

/**
 * @param {{ apiV1Base?: string; apiEndpoint?: string; publicKey?: string }} config
 * @returns {string}
 */
export function resolveApiV1Base(config) {
  if (config.apiV1Base) {
    return String(config.apiV1Base).replace(/\/$/, '');
  }
  const ep = String(config.apiEndpoint || '').replace(/\/$/, '');
  if (!ep) return '/api/v1';
  if (ep.endsWith('/api/v1')) return ep;
  if (ep.endsWith('/api')) return `${ep.slice(0, -4)}/api/v1`;
  return `${ep}/api/v1`;
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * W-007: Gửi tin nhắn thường (non-streaming).
 * @param {object} config — cần publicKey; apiV1Base hoặc apiEndpoint
 * @param {string} query
 * @param {string} sessionId
 * @param {object | null} action — { type, data } gửi qua /chat/action khi có
 */
export async function sendMessage(config, query, sessionId, action = null) {
  const base = resolveApiV1Base(config);
  const path = action ? '/chat/action' : '/chat';
  const url = `${base}${path}`;
  const body = { query: query ?? '', session_id: sessionId };
  if (action) body.action = action;
  const opts = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Widget-Key': config.publicKey,
    },
    body: JSON.stringify(body),
  };

  let attempt = 0;
  while (attempt < 2) {
    try {
      const res = await fetchWithTimeout(url, opts);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err.detail;
        const msg =
          typeof detail === 'string'
            ? detail
            : Array.isArray(detail)
              ? detail.map((d) => d.msg || d).join(', ')
              : detail
                ? JSON.stringify(detail)
                : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      return await res.json();
    } catch (e) {
      attempt++;
      if (attempt >= 2) throw e;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}

/**
 * W-008: SSE streaming via fetch + ReadableStream.
 */
export async function streamMessage(config, query, sessionId, onChunk, onDone, action = null) {
  const base = resolveApiV1Base(config);
  const url = `${base}/chat/stream`;
  const controller = new AbortController();
  let timer = null;
  const resetIdleTimer = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), STREAM_IDLE_TIMEOUT_MS);
  };
  resetIdleTimer();

  let fullText = '';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Widget-Key': config.publicKey,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(
        action ? { query, session_id: sessionId, action } : { query, session_id: sessionId },
      ),
      signal: controller.signal,
    });
    resetIdleTimer();

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetIdleTimer();

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const raw = trimmed.slice(6).trim();
        if (raw === '[DONE]') {
          onDone({ text: fullText, ui_components: [], slots: {}, metadata: {} });
          return;
        }

        let payload;
        try {
          payload = JSON.parse(raw);
        } catch (e) {
          console.error('SSE Parse Error:', e, raw);
          continue;
        }

        if (payload.error) {
          throw new Error(payload.error);
        }
        if (payload.chunk) {
          fullText += payload.chunk;
          onChunk(payload.chunk);
        }
        if (payload.done) {
          onDone({
            text: payload.text || fullText,
            ui_components: payload.ui_components || [],
            slots: payload.slots || {},
            metadata: payload.metadata || {},
            citations: payload.citations,
            component: payload.component,
          });
          return;
        }
      }
    }
    onDone({ text: fullText, ui_components: [], slots: {}, metadata: {} });
  } catch (e) {
    if (timer) clearTimeout(timer);
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
