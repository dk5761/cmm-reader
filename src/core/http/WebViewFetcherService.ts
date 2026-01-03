/**
 * WebViewFetcher service for fetching HTML via hidden WebView.
 * Used for Cloudflare-protected sites where Axios can't pass the fingerprint check.
 *
 * The React context (WebViewFetcherProvider) registers its fetch function here,
 * allowing non-React code (like Source classes) to use WebView fetching.
 */

import { CF_CHALLENGE_PATTERNS } from "./types";

type FetchFunction = (url: string, timeoutMs?: number) => Promise<string>;
type PostFunction = (
  url: string,
  body?: string,
  headers?: Record<string, string>,
  timeoutMs?: number
) => Promise<string>;
type InvalidateSessionFunction = (baseUrl: string) => void;

type PendingRequest = {
  url: string;
  timeoutMs: number;
  resolve: (html: string) => void;
  reject: (error: Error) => void;
};

type PendingPostRequest = {
  url: string;
  body?: string;
  headers?: Record<string, string>;
  timeoutMs: number;
  resolve: (html: string) => void;
  reject: (error: Error) => void;
};

// Error thrown when CF challenge is detected
export class CloudflareExpiredError extends Error {
  constructor(public url: string) {
    super(`Cloudflare session expired for: ${url}`);
    this.name = "CloudflareExpiredError";
  }
}

class WebViewFetcherServiceClass {
  private fetchFunction: FetchFunction | null = null;
  private postFunction: PostFunction | null = null;
  private invalidateSessionFn: InvalidateSessionFunction | null = null;
  private pendingFetchRequests: PendingRequest[] = [];
  private pendingPostRequests: PendingPostRequest[] = [];

  /**
   * Check if HTML contains Cloudflare challenge page
   */
  private detectCfChallenge(html: string): boolean {
    const htmlLower = html.toLowerCase();
    return CF_CHALLENGE_PATTERNS.some(
      (pattern) =>
        htmlLower.includes(pattern.toLowerCase()) || html.includes(pattern)
    );
  }

  /**
   * Extract base URL from full URL
   */
  private getBaseUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return url;
    }
  }

  /**
   * Register the fetch functions from WebViewFetcherProvider
   */
  register(
    fetchFn: FetchFunction,
    postFn: PostFunction,
    invalidateSessionFn?: InvalidateSessionFunction
  ) {
    console.log("[WebViewFetcherService] Registered");
    this.fetchFunction = fetchFn;
    this.postFunction = postFn;
    this.invalidateSessionFn = invalidateSessionFn || null;

    // Process any pending fetch requests
    while (this.pendingFetchRequests.length > 0) {
      const request = this.pendingFetchRequests.shift();
      if (request) {
        this.fetchHtml(request.url, request.timeoutMs)
          .then(request.resolve)
          .catch(request.reject);
      }
    }

    // Process any pending POST requests
    while (this.pendingPostRequests.length > 0) {
      const request = this.pendingPostRequests.shift();
      if (request) {
        this.postHtml(
          request.url,
          request.body,
          request.headers,
          request.timeoutMs
        )
          .then(request.resolve)
          .catch(request.reject);
      }
    }
  }

  /**
   * Unregister the fetch functions
   */
  unregister() {
    console.log("[WebViewFetcherService] Unregistered");

    // Reject all pending fetch requests
    while (this.pendingFetchRequests.length > 0) {
      const request = this.pendingFetchRequests.shift();
      if (request) {
        request.reject(new Error("WebViewFetcher unregistered"));
      }
    }

    // Reject all pending POST requests
    while (this.pendingPostRequests.length > 0) {
      const request = this.pendingPostRequests.shift();
      if (request) {
        request.reject(new Error("WebViewFetcher unregistered"));
      }
    }

    this.fetchFunction = null;
    this.postFunction = null;
    this.invalidateSessionFn = null;
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.fetchFunction !== null && this.postFunction !== null;
  }

  /**
   * Fetch HTML from URL using hidden WebView (GET request via navigation)
   * Detects CF challenge in response and invalidates session if found
   */
  async fetchHtml(url: string, timeoutMs = 30000): Promise<string> {
    if (!this.fetchFunction) {
      console.log(
        "[WebViewFetcherService] Not ready, queueing fetch request:",
        url.substring(0, 60)
      );
      return new Promise((resolve, reject) => {
        this.pendingFetchRequests.push({ url, timeoutMs, resolve, reject });

        // Timeout for pending requests
        setTimeout(() => {
          const index = this.pendingFetchRequests.findIndex(
            (r) => r.url === url
          );
          if (index !== -1) {
            this.pendingFetchRequests.splice(index, 1);
            reject(new Error("WebViewFetcher not available"));
          }
        }, timeoutMs);
      });
    }

    console.log("[WebViewFetcherService] Fetching:", url.substring(0, 60));
    const html = await this.fetchFunction(url, timeoutMs);

    // Check for CF challenge in response
    if (this.detectCfChallenge(html)) {
      console.log("[WebViewFetcherService] CF challenge detected in response!");
      const baseUrl = this.getBaseUrl(url);
      if (this.invalidateSessionFn) {
        this.invalidateSessionFn(baseUrl);
      }
      throw new CloudflareExpiredError(url);
    }

    return html;
  }

  /**
   * POST request via WebView's JavaScript fetch (uses WebView's cookies/fingerprint)
   * Detects CF challenge in response and invalidates session if found
   */
  async postHtml(
    url: string,
    body?: string,
    headers?: Record<string, string>,
    timeoutMs = 30000
  ): Promise<string> {
    if (!this.postFunction) {
      console.log(
        "[WebViewFetcherService] Not ready, queueing POST request:",
        url.substring(0, 60)
      );
      return new Promise((resolve, reject) => {
        this.pendingPostRequests.push({
          url,
          body,
          headers,
          timeoutMs,
          resolve,
          reject,
        });

        setTimeout(() => {
          const index = this.pendingPostRequests.findIndex(
            (r) => r.url === url
          );
          if (index !== -1) {
            this.pendingPostRequests.splice(index, 1);
            reject(new Error("WebViewFetcher not available"));
          }
        }, timeoutMs);
      });
    }

    console.log("[WebViewFetcherService] POSTing:", url.substring(0, 60));
    const html = await this.postFunction(url, body, headers, timeoutMs);

    // Check for CF challenge in response
    if (this.detectCfChallenge(html)) {
      console.log(
        "[WebViewFetcherService] CF challenge detected in POST response!"
      );
      const baseUrl = this.getBaseUrl(url);
      if (this.invalidateSessionFn) {
        this.invalidateSessionFn(baseUrl);
      }
      throw new CloudflareExpiredError(url);
    }

    return html;
  }
}

export const WebViewFetcherService = new WebViewFetcherServiceClass();
