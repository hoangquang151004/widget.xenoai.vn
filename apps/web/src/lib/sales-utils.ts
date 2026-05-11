export type SalesPeriod = "7d" | "30d" | "90d";

export function periodToDays(period: SalesPeriod): number {
  if (period === "7d") return 7;
  if (period === "90d") return 90;
  return 30;
}

export function statusEntries(byStatus?: Record<string, number>): Array<[string, number]> {
  return Object.entries(byStatus || {}).sort((a, b) => b[1] - a[1]);
}

export function completionRate(byStatus?: Record<string, number>): number {
  const entries = statusEntries(byStatus);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return 0;
  const completed = (byStatus?.completed || 0) + (byStatus?.confirmed || 0);
  return Math.round((completed / total) * 100);
}
