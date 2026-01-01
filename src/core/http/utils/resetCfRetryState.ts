/**
 * Reset Cloudflare retry state for a given URL
 * Call this before manually retrying a failed CF request
 */
export function resetCfRetryState(url: string) {
  if (typeof (globalThis as any).__resetCfRetryState === "function") {
    (globalThis as any).__resetCfRetryState(url);
  }
}
