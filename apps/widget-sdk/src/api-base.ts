/**
 * Chuẩn hóa gốc API thành .../api/v1 (khớp FastAPI: /api/v1/chat/...).
 */
export function normalizeApiV1Base(originOrUrl: string): string {
  let u = originOrUrl.replace(/\/$/, '')
  if (u.endsWith('/api/v1')) return u
  if (u.endsWith('/api')) return `${u.slice(0, -4)}/api/v1`
  return `${u}/api/v1`
}
