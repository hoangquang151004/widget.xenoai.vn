/**
 * W-007 + W-008: API Client — POST chat + SSE streaming.
 */

const REQUEST_TIMEOUT_MS = 100_000;
const STREAM_IDLE_TIMEOUT_MS = 300_000;

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
 */
export async function sendMessage(config, query, sessionId, action = null) {
  const url = `${config.apiEndpoint}/api/v1/chat`;
  const body = { query, session_id: sessionId };
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
        throw new Error(err.detail || `HTTP ${res.status}`);
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
  const url = `${config.apiEndpoint}/api/v1/chat/stream`;
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
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(action ? { query, session_id: sessionId, action } : { query, session_id: sessionId }),
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
      buffer = lines.pop(); // giữ lại phần chưa hoàn chỉnh cuối cùng

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
