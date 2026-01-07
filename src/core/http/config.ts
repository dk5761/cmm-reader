/**
 * Cloudflare bypass configuration
 * Extracted magic numbers from CloudflareInterceptor.ts and WebViewFetcherContext.tsx
 */
export const CF_CONFIG = {
  /** Maximum auto-retry attempts before falling back to manual */
  MAX_RETRIES: 1,

  /** Timeout for auto-solve attempt (ms) */
  SOLVE_TIMEOUT_MS: 30000,

  /** Polling interval to check for cf_clearance cookie (ms) */
  POLLING_INTERVAL_MS: 2000,

  /** Delay before starting to poll after challenge opens (ms) */
  POLLING_START_DELAY_MS: 10000,

  /** Maximum time user has to complete manual challenge (ms) */
  MANUAL_TIMEOUT_MS: 90000,

  /** WebView fetch timeout (ms) */
  WEBVIEW_FETCH_TIMEOUT_MS: 30000,

  /** Max retry attempts for cookie extraction */
  COOKIE_EXTRACT_MAX_ATTEMPTS: 3,

  /** Delay between cookie extraction attempts (ms) */
  COOKIE_EXTRACT_RETRY_DELAY_MS: 500,

  /** Delay before extracting HTML after page load (ms) */
  HTML_EXTRACT_DELAY_MS: 500,

  /** Delay before checking domain ready for POST (ms) */
  DOMAIN_READY_DELAY_MS: 500,

  /** Delay before retrying CF challenge (ms) */
  CF_RETRY_DELAY_MS: 2000,

  /** Delay to wait for correct page load (ms) */
  PAGE_LOAD_WAIT_MS: 1000,

  /** Max retries for WebView navigation */
  MAX_WEBVIEW_RETRIES: 3,
} as const;
