export const MAX_ENRICHMENT_ATTEMPTS = 3;

export const enrichmentRetryDelayMs = (attempt: number): number | null =>
  [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000][attempt] ?? null;

export function retryState(attempt: number): { state: "retrying" | "failed"; delayMs: number | null; attempt: number } {
  const delayMs = enrichmentRetryDelayMs(attempt);
  return { state: delayMs === null ? "failed" : "retrying", delayMs, attempt: attempt + 1 };
}
