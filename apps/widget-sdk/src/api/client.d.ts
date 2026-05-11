export function resolveApiV1Base(config: {
  apiV1Base?: string
  apiEndpoint?: string
  publicKey?: string
}): string

export function sendMessage(
  config: { apiV1Base?: string; apiEndpoint?: string; publicKey: string },
  query: string,
  sessionId: string,
  action: { type: string; data?: Record<string, unknown> } | null,
): Promise<Record<string, unknown>>

export function streamMessage(
  config: { apiV1Base?: string; apiEndpoint?: string; publicKey: string },
  query: string,
  sessionId: string,
  onChunk: (chunk: string) => void,
  onDone: (payload: Record<string, unknown>) => void,
  action: { type: string; data?: Record<string, unknown> } | null,
): Promise<void>
