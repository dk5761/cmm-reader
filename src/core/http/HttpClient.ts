import { Platform } from "react-native";
import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { setupCloudflareInterceptor } from "./CloudflareInterceptor";
import { CookieManagerInstance } from "./CookieManager";
import type { RequestOptions } from "./types";

const ANDROID_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const IOS_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const USER_AGENT = Platform.OS === "ios" ? IOS_USER_AGENT : ANDROID_USER_AGENT;

/**
 * HTTP client with automatic Cloudflare bypass and cookie management.
 * Similar to Mihon's OkHttpClient with CloudflareInterceptor.
 */
class HttpClientClass {
  private client: AxiosInstance;
  private initialized = false;

  constructor() {
    this.client = axios.create({
      timeout: 30000, // Increased for CF solving
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      // Don't reject on non-2xx status (we need to detect CF challenges)
      // validateStatus: () => true,
    });

    // Setup Cloudflare interceptor (automatic CF detection & solving)
    setupCloudflareInterceptor(this.client);

    // Request interceptor - inject cookies from CookieManager
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const url = config.url || "";
        const domain = this.getDomain(url);

        // Get cookies from CookieManager
        const cookies = await CookieManagerInstance.getCookies(domain);

        if (cookies && config.headers) {
          config.headers.Cookie = cookies;
          console.log(
            "[HTTP] →",
            config.method?.toUpperCase(),
            url.substring(0, 60),
            "✓ cookies"
          );
        } else {
          console.log(
            "[HTTP] →",
            config.method?.toUpperCase(),
            url.substring(0, 60)
          );
        }

        return config;
      },
      (error) => {
        console.error("[HTTP] Request error:", error.message);
        return Promise.reject(error);
      }
    );

    // Response interceptor - logging
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        const status = response.status;
        const url = response.config.url || "";
        const size =
          typeof response.data === "string" ? response.data.length : 0;
        console.log(
          "[HTTP] ←",
          status,
          url.substring(0, 60),
          `(${size} bytes)`
        );
        return response;
      },
      (error) => {
        console.error(
          "[HTTP] ✗",
          error.response?.status || "NETWORK",
          error.config?.url?.substring(0, 60),
          error.message
        );
        return Promise.reject(error);
      }
    );
  }

  /**
   * Initialize - load cookies from storage
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    await CookieManagerInstance.load();
    this.initialized = true;
  }

  private getDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      const match = url.match(/^https?:\/\/([^/]+)/);
      return match ? match[1] : "";
    }
  }

  /**
   * Make a GET request and return HTML text
   */
  async getText(url: string, options?: RequestOptions): Promise<string> {
    await this.init();

    const response = await this.client.get(url, {
      headers: options?.headers,
      timeout: options?.timeout,
      responseType: "text",
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.data;
  }

  /**
   * Make a GET request and return JSON
   */
  async getJson<T>(url: string, options?: RequestOptions): Promise<T> {
    await this.init();

    const response = await this.client.get(url, {
      headers: options?.headers,
      timeout: options?.timeout,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.data;
  }

  /**
   * Make a POST request
   */
  async post(
    url: string,
    data: any,
    options?: RequestOptions
  ): Promise<string> {
    await this.init();

    const response = await this.client.post(url, data, {
      headers: options?.headers,
      timeout: options?.timeout,
      responseType: "text",
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.data;
  }

  /**
   * Get User-Agent string
   */
  getUserAgent(): string {
    return USER_AGENT;
  }

  /**
   * Get raw Axios instance (for advanced usage)
   */
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }
}

export const HttpClient = new HttpClientClass();
