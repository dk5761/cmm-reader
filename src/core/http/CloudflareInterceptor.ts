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
import { cfLogger } from "@/utils/cfDebugLogger";

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
  const startTime = Date.now();

  console.log(
    `[CF Interceptor] Auto-solving challenge for ${domain} (attempt ${attempt}/${MAX_CF_RETRIES})`
  );

  await cfLogger.log("CF Interceptor", "Auto-solve started", {
    url: url.substring(0, 80),
    domain,
    attempt,
    maxRetries: MAX_CF_RETRIES,
  });

  // Solve using WebView with increasing timeout
  const timeout = 30000 + attempt * 10000;
  const html = await WebViewFetcherService.fetchHtml(url, timeout);

  let hasCfClearance = false;
  let cookieString = "";
  const cookieExtractStart = Date.now();

  // Use native module on iOS for reliable cookie extraction from WKWebView
  if (Platform.OS === "ios") {
    hasCfClearance = await CookieSync.hasCfClearance(url);
    if (hasCfClearance) {
      cookieString = await CookieSync.getCookieString(url);

      const syncStart = Date.now();
      await CookieSync.syncCookiesToNative(url);
      await cfLogger.logCookieSync("toNative", domain, {
        success: true,
        durationMs: Date.now() - syncStart,
        cookieLength: cookieString.length,
      });

      const cacheStart = Date.now();
      await CookieManagerInstance.cacheCookieString(domain, cookieString);
      await cfLogger.logCookieSync("toCache", domain, {
        success: true,
        durationMs: Date.now() - cacheStart,
        cookieLength: cookieString.length,
      });
    }

    await cfLogger.logCookieExtraction("iOS-Native", url, {
      success: hasCfClearance,
      cookieString: hasCfClearance ? cookieString : undefined,
      durationMs: Date.now() - cookieExtractStart,
    });
  } else {
    // Android: use JS-based extraction (works fine)
    const cookiesArray = await CookieManagerInstance.extractFromWebView(url);
    hasCfClearance = cookiesArray.some((c) => c.name === "cf_clearance");
    if (hasCfClearance) {
      await CookieManagerInstance.setCookies(domain, cookiesArray);
      cookieString = (await CookieManagerInstance.getCookies(domain)) || "";
    }

    await cfLogger.logCookieExtraction("Android-WebView", url, {
      success: hasCfClearance,
      cookies: cookiesArray,
      cookieString: hasCfClearance ? cookieString : undefined,
      durationMs: Date.now() - cookieExtractStart,
    });
  }

  if (!hasCfClearance) {
    const error = "Failed to obtain CF clearance cookie";
    await cfLogger.log(
      "CF Interceptor",
      "Auto-solve failed - no cf_clearance",
      {
        url: url.substring(0, 80),
        domain,
        durationMs: Date.now() - startTime,
      }
    );
    throw new Error(error);
  }

  console.log(`[CF Interceptor] Successfully solved challenge for ${domain}`);

  await cfLogger.log("CF Interceptor", "Auto-solve SUCCESS", {
    url: url.substring(0, 80),
    domain,
    cookieLength: cookieString.length,
    totalDurationMs: Date.now() - startTime,
  });

  return {
    html,
    cookies: cookieString,
  };
}

/**
 * Attempt background refresh (Mihon-style)
 * Tries to get a fresh token via hidden WebView without user interaction
 * Returns true if successful (new cookie != old cookie)
 */
async function attemptBackgroundRefresh(
  url: string,
  oldCookieString: string | null
): Promise<boolean> {
  const domain = new URL(url).hostname;
  const startTime = Date.now();

  console.log(`[CF Interceptor] Attempting background refresh for ${domain}`);

  await cfLogger.log("CF Interceptor", "Background refresh started", {
    url: url.substring(0, 80),
    domain,
    hadOldCookie: !!oldCookieString,
    oldCookieLength: oldCookieString?.length || 0,
  });

  try {
    // Load URL in hidden WebView with 15s timeout
    await WebViewFetcherService.fetchHtml(url, 15000);

    // Get new cookie string
    let newCookieString: string | null = null;
    if (Platform.OS === "ios") {
      newCookieString = await CookieSync.getCookieString(url);
    } else {
      const cookies = await CookieManagerInstance.extractFromWebView(url);
      newCookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    }

    // Check validity
    const hasCfClearance = newCookieString?.includes("cf_clearance") || false;

    // Key insight from Mihon: Compare cookie strings, not expiry dates
    // Success = new cookie exists AND is different from old
    const isDifferent = newCookieString !== oldCookieString;
    const success = hasCfClearance && isDifferent;

    await cfLogger.log(
      "CF Interceptor",
      success ? "Background refresh SUCCESS" : "Background refresh FAILED",
      {
        domain,
        hasCfClearance,
        isDifferent,
        oldCookieLength: oldCookieString?.length || 0,
        newCookieLength: newCookieString?.length || 0,
        durationMs: Date.now() - startTime,
      }
    );

    if (success) {
      console.log(
        `[CF Interceptor] Background refresh succeeded for ${domain} in ${
          Date.now() - startTime
        }ms`
      );
    } else {
      console.log(
        `[CF Interceptor] Background refresh failed for ${domain} - cookie comparison: has=${hasCfClearance}, different=${isDifferent}`
      );
    }

    return success;
  } catch (error) {
    console.log(
      `[CF Interceptor] Background refresh error for ${domain}:`,
      error
    );

    await cfLogger.log("CF Interceptor", "Background refresh ERROR", {
      domain,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    return false;
  }
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
        const domain = new URL(url).hostname;

        console.log(
          `[CF Interceptor] CF challenge detected for ${url.substring(0, 60)}`
        );

        // Log curl-like request info for debugging
        const cookieHeader =
          config.headers?.["Cookie"] || config.headers?.["cookie"] || "none";
        await cfLogger.log("CF Interceptor", "Request that triggered 403", {
          curl: `curl -X ${config.method?.toUpperCase()} "${url.substring(
            0,
            100
          )}"`,
          headers: {
            Cookie:
              typeof cookieHeader === "string"
                ? cookieHeader.substring(0, 100)
                : "none",
            UserAgent: config.headers?.["User-Agent"] || "default",
          },
          status: response.status,
        });

        await cfLogger.logChallengeState("detected", {
          url: url.substring(0, 80),
          status: response.status,
          currentRetries,
          maxRetries: MAX_CF_RETRIES,
        });

        // STEP 1: Save old cookie before clearing (Mihon approach)
        let oldCookieString: string | null = null;
        if (Platform.OS === "ios") {
          try {
            oldCookieString = await CookieSync.getCookieString(url);
            console.log(
              `[CF Interceptor] Saved old cookie for comparison (length: ${
                oldCookieString?.length || 0
              })`
            );
          } catch (e) {
            console.log("[CF Interceptor] Failed to get old cookie:", e);
          }
        }

        // STEP 2: Clear invalid token when 403 is received
        // The token exists but CF has invalidated it server-side
        if (Platform.OS === "ios") {
          try {
            console.log(
              `[CF Interceptor] Clearing potentially invalid token for ${domain}`
            );
            await CookieSync.clearCfClearance(url);
            await cfLogger.log(
              "CF Interceptor",
              "Cleared invalid token on 403",
              {
                domain,
                reason: "Server returned 403 despite token existing",
              }
            );
          } catch (e) {
            console.log("[CF Interceptor] Failed to clear token:", e);
          }
        }

        // STEP 3: Try background refresh (Mihon-style)
        // Attempt to get fresh token via hidden WebView before showing modal
        const backgroundRefreshed = await attemptBackgroundRefresh(
          url,
          oldCookieString
        );

        if (backgroundRefreshed) {
          console.log(
            `[CF Interceptor] Background refresh succeeded, retrying request automatically`
          );

          await cfLogger.log(
            "CF Interceptor",
            "Auto-retry after background refresh",
            {
              url: url.substring(0, 80),
              domain,
            }
          );

          // Retry the original request with fresh cookies
          return axiosInstance.request(config);
        }

        console.log(
          `[CF Interceptor] Background refresh failed, will try auto-solve or manual`
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

          await cfLogger.logChallengeState("modal-opened", {
            reason: "Auto-bypass exhausted",
            retries: currentRetries,
          });

          const manualStart = Date.now();
          const manualResult = await solveCfChallengeManual(url);

          await cfLogger.logChallengeState(
            manualResult.success ? "completed" : "failed",
            {
              manualDurationMs: Date.now() - manualStart,
              hasCookies: !!manualResult.cookies,
              cookieLength: manualResult.cookies?.length,
            }
          );

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
