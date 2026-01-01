import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";
import { Platform } from "react-native";
import { WebViewFetcherService } from "./WebViewFetcherService";
import { CookieManagerInstance } from "./CookieManager";
import { CloudflareBypassException, ManualChallengeHandler } from "./types";
import CookieSync from "cookie-sync";

const MAX_CF_RETRIES = 1; // Try once and fail fast

/**
 * Registered manual challenge handler (set by WebViewFetcherContext)
 */
let manualChallengeHandler: ManualChallengeHandler | null = null;

/**
 * Register handler for manual CF challenge (called from WebViewFetcherContext)
 */
export function registerManualChallengeHandler(
  handler: ManualChallengeHandler | null
) {
  manualChallengeHandler = handler;
  console.log(
    `[CF Interceptor] Manual challenge handler ${
      handler ? "registered" : "unregistered"
    }`
  );
}

/**
 * Detects if a response is a Cloudflare challenge page
 */
function isCfChallenge(response?: AxiosResponse): boolean {
  if (!response) return false;

  const isCfStatus = response.status === 403 || response.status === 503;
  if (!isCfStatus) return false;

  const html = typeof response.data === "string" ? response.data : "";
  const hasCfMarkers =
    html.includes("cf-browser-verification") ||
    html.includes("challenge-running") ||
    html.includes("__cf_chl_jschl_tk__") ||
    html.includes("cf_chl_opt");

  // Check title through headers or response
  const title = response.headers?.["title"] || "";
  const hasJustAMoment =
    title.toLowerCase().includes("just a moment") ||
    html.toLowerCase().includes("<title>just a moment");

  return hasCfMarkers || hasJustAMoment;
}

/**
 * Attempts to solve Cloudflare challenge using hidden WebView (automatic)
 */
async function solveCfChallengeAuto(
  config: AxiosRequestConfig,
  attempt: number = 1
): Promise<{ html: string; cookies: string }> {
  const url = config.url!;
  const domain = new URL(url).hostname;

  console.log(
    `[CF Interceptor] Auto-solving challenge for ${domain} (attempt ${attempt}/${MAX_CF_RETRIES})`
  );

  // Solve using WebView with increasing timeout
  const timeout = 30000 + attempt * 10000;
  const html = await WebViewFetcherService.fetchHtml(url, timeout);

  let hasCfClearance = false;
  let cookieString = "";

  // Use native module on iOS for reliable cookie extraction from WKWebView
  if (Platform.OS === "ios") {
    hasCfClearance = await CookieSync.hasCfClearance(url);
    if (hasCfClearance) {
      cookieString = await CookieSync.getCookieString(url);
      await CookieSync.syncCookiesToNative(url);
      await CookieManagerInstance.cacheCookieString(domain, cookieString);
    }
  } else {
    // Android: use JS-based extraction (works fine)
    const cookiesArray = await CookieManagerInstance.extractFromWebView(url);
    hasCfClearance = cookiesArray.some((c) => c.name === "cf_clearance");
    if (hasCfClearance) {
      await CookieManagerInstance.setCookies(domain, cookiesArray);
      cookieString = (await CookieManagerInstance.getCookies(domain)) || "";
    }
  }

  if (!hasCfClearance) {
    throw new Error("Failed to obtain CF clearance cookie");
  }

  console.log(`[CF Interceptor] Successfully solved challenge for ${domain}`);

  return {
    html,
    cookies: cookieString,
  };
}

/**
 * Attempt manual challenge via modal WebView
 */
async function solveCfChallengeManual(
  url: string
): Promise<{ success: boolean; cookies?: string }> {
  if (!manualChallengeHandler) {
    console.log("[CF Interceptor] No manual handler registered");
    return { success: false };
  }

  console.log("[CF Interceptor] Triggering manual challenge modal");
  return manualChallengeHandler(url);
}

/**
 * Setup Cloudflare interceptor on Axios instance
 * Automatically detects and solves CF challenges like Mihon's CloudflareInterceptor
 * Falls back to manual challenge modal if auto-bypass fails
 */
export function setupCloudflareInterceptor(axiosInstance: AxiosInstance): void {
  // Track retry attempts per request
  const retryMap = new Map<string, number>();

  // Track ongoing CF solves to prevent duplicates
  const ongoingSolves = new Map<
    string,
    Promise<{ html: string; cookies: string }>
  >();

  // Export function to reset retry state for manual retries
  (globalThis as any).__resetCfRetryState = (url: string) => {
    const key = `GET:${url}`;
    retryMap.delete(key);
    ongoingSolves.delete(key);
    console.log(
      `[CF Interceptor] Reset retry state for ${url.substring(0, 60)}`
    );
  };

  // Response interceptor - detects CF challenges
  axiosInstance.interceptors.response.use(
    // Success - pass through
    (response: AxiosResponse) => response,

    // Error - check for CF challenge
    async (error: AxiosError) => {
      const { config, response } = error;

      if (!config || !response) {
        return Promise.reject(error);
      }

      // Check if this is a CF challenge
      if (isCfChallenge(response)) {
        const requestKey = `${config.method}:${config.url}`;
        const currentRetries = retryMap.get(requestKey) || 0;
        const url = config.url || "";

        console.log(
          `[CF Interceptor] CF challenge detected for ${url.substring(0, 60)}`
        );

        // Prevent infinite retry loop
        if (currentRetries >= MAX_CF_RETRIES) {
          retryMap.delete(requestKey);
          ongoingSolves.delete(requestKey);

          // Try manual challenge as fallback
          console.log(
            "[CF Interceptor] Auto-bypass exhausted, trying manual...",
            { url: url.substring(0, 60), retries: currentRetries }
          );
          const manualResult = await solveCfChallengeManual(url);

          if (manualResult.success && manualResult.cookies) {
            // Retry request with new cookies
            const retryConfig = {
              ...config,
              headers: {
                ...(config.headers || {}),
                Cookie: manualResult.cookies,
              },
            };
            console.log(
              "[CF Interceptor] Manual solve success, retrying request...",
              { url: url.substring(0, 60), hasCookies: !!manualResult.cookies }
            );
            return axiosInstance.request(retryConfig);
          }

          // Manual also failed - throw exception
          return Promise.reject(
            new CloudflareBypassException(
              `CF bypass failed (auto + manual) for ${url}`,
              currentRetries,
              url
            )
          );
        }

        retryMap.set(requestKey, currentRetries + 1);

        try {
          // Check if we're already solving this URL
          let solvePromise = ongoingSolves.get(requestKey);

          if (!solvePromise) {
            // Start new auto-solve
            console.log(
              `[CF Interceptor] Starting auto CF solve for ${requestKey}`
            );
            solvePromise = solveCfChallengeAuto(
              config as AxiosRequestConfig,
              1
            );
            ongoingSolves.set(requestKey, solvePromise);
          } else {
            console.log(
              `[CF Interceptor] Reusing ongoing CF solve for ${requestKey}`
            );
          }

          // Wait for solve to complete
          const { cookies } = await solvePromise;

          // Clean up
          ongoingSolves.delete(requestKey);

          // Update request config with cookies
          const retryConfig = {
            ...config,
            headers: {
              ...(config.headers || {}),
              Cookie: cookies,
            },
          };

          // Clear retry counter on success
          retryMap.delete(requestKey);

          // Retry original request with cookies
          console.log(`[CF Interceptor] Retrying request with cookies...`);
          return axiosInstance.request(retryConfig);
        } catch (cfError) {
          // Auto-solve failed, try manual
          console.log("[CF Interceptor] Auto-solve failed, trying manual...", {
            error: (cfError as Error).message,
            url: url.substring(0, 60),
          });
          ongoingSolves.delete(requestKey);

          const manualResult = await solveCfChallengeManual(url);

          if (manualResult.success && manualResult.cookies) {
            retryMap.delete(requestKey);
            const retryConfig = {
              ...config,
              headers: {
                ...(config.headers || {}),
                Cookie: manualResult.cookies,
              },
            };
            console.log(
              "[CF Interceptor] Manual solve success, retrying request...",
              { url: url.substring(0, 60), hasCookies: !!manualResult.cookies }
            );
            return axiosInstance.request(retryConfig);
          }

          // Both failed
          retryMap.delete(requestKey);
          return Promise.reject(
            new CloudflareBypassException(
              `CF bypass failed for ${url}`,
              currentRetries,
              url
            )
          );
        }
      }

      // Not a CF challenge, pass through error
      return Promise.reject(error);
    }
  );

  console.log("[CF Interceptor] Cloudflare interceptor enabled");
}
