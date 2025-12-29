import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { WebViewFetcherService } from "./WebViewFetcherService";
import { CookieManagerInstance } from "./CookieManager";
import { CloudflareBypassException } from "./types";

const MAX_CF_RETRIES = 3;
const CF_RETRY_DELAYS = [2000, 5000, 10000]; // Exponential backoff

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
 * Attempts to solve Cloudflare challenge using WebView
 */
async function solveCfChallenge(
  config: AxiosRequestConfig,
  attempt: number = 1
): Promise<{ html: string; cookies: string }> {
  const url = config.url!;
  const domain = new URL(url).hostname;

  console.log(
    `[CF Interceptor] Solving challenge for ${domain} (attempt ${attempt}/${MAX_CF_RETRIES})`
  );

  try {
    // Solve using WebView with increasing timeout
    const timeout = 30000 + attempt * 10000;
    const html = await WebViewFetcherService.fetchHtml(url, timeout);

    // Extract cookies from WebView
    const cookiesArray = await CookieManagerInstance.extractFromWebView(url);

    // Check if we got CF clearance cookie
    const hasCfClearance = cookiesArray.some((c) => c.name === "cf_clearance");
    if (!hasCfClearance && attempt < MAX_CF_RETRIES) {
      console.warn(
        `[CF Interceptor] No cf_clearance cookie found, retrying...`
      );

      // Wait before retry
      await new Promise((resolve) =>
        setTimeout(resolve, CF_RETRY_DELAYS[attempt - 1] || 5000)
      );

      return solveCfChallenge(config, attempt + 1);
    }

    if (!hasCfClearance) {
      throw new Error("Failed to obtain CF clearance cookie");
    }

    // Store cookies
    await CookieManagerInstance.setCookies(domain, cookiesArray);

    // Get cookie string for request
    const cookieString = await CookieManagerInstance.getCookies(domain);

    console.log(`[CF Interceptor] Successfully solved challenge for ${domain}`);

    return {
      html,
      cookies: cookieString || "",
    };
  } catch (error) {
    const err = error as Error;
    console.error(`[CF Interceptor] Attempt ${attempt} failed:`, err.message);

    if (attempt < MAX_CF_RETRIES) {
      // Wait before retry
      await new Promise((resolve) =>
        setTimeout(resolve, CF_RETRY_DELAYS[attempt - 1] || 5000)
      );
      return solveCfChallenge(config, attempt + 1);
    }

    // All attempts failed
    throw new CloudflareBypassException(
      `Failed to bypass Cloudflare after ${MAX_CF_RETRIES} attempts: ${err.message}`,
      MAX_CF_RETRIES,
      url
    );
  }
}

/**
 * Setup Cloudflare interceptor on Axios instance
 * Automatically detects and solves CF challenges like Mihon's CloudflareInterceptor
 */
export function setupCloudflareInterceptor(axiosInstance: AxiosInstance): void {
  // Track retry attempts per request
  const retryMap = new Map<string, number>();

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

        console.log(
          `[CF Interceptor] CF challenge detected for ${config.url?.substring(
            0,
            60
          )}`
        );

        // Prevent infinite retry loop
        if (currentRetries >= MAX_CF_RETRIES) {
          retryMap.delete(requestKey);
          return Promise.reject(
            new CloudflareBypassException(
              `CF bypass retry limit exceeded for ${config.url}`,
              currentRetries,
              config.url || ""
            )
          );
        }

        retryMap.set(requestKey, currentRetries + 1);

        try {
          // Solve CF challenge
          const { cookies } = await solveCfChallenge(
            config as AxiosRequestConfig,
            1
          );

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
          // Clear retry counter
          retryMap.delete(requestKey);

          // If CF solving failed, reject with CF exception
          return Promise.reject(cfError);
        }
      }

      // Not a CF challenge, pass through error
      return Promise.reject(error);
    }
  );

  console.log("[CF Interceptor] Cloudflare interceptor enabled");
}
