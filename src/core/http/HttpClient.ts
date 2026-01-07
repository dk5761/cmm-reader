import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { setupCloudflareInterceptor } from "./CloudflareInterceptor";
import { cookieJar } from "./CookieJar";
import { USER_AGENT } from "./userAgent";
import type { RequestOptions } from "./types";

/**
 * HTTP client with automatic Cloudflare bypass and cookie management.
 */
class HttpClientClass {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    // Setup Cloudflare interceptor
    setupCloudflareInterceptor(this.client);

    // Request interceptor - inject cookies from CookieJar
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const url = config.url || "";
        
        // Get cookies from CookieJar
        const cookies = await cookieJar.getCookieString(url);

        if (cookies && config.headers) {
          config.headers.Cookie = cookies;
        }

        console.log(
            "[HTTP] →",
            config.method?.toUpperCase(),
            url.substring(0, 60),
            cookies ? "✓ cookies" : ""
        );

        return config;
      },
      (error) => {
        console.error("[HTTP] Request error:", error.message);
        return Promise.reject(error);
      }
    );

    // Response interceptor - simple logging
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
        if (error?.name !== "CloudflareBypassException") {
          console.error(
            "[HTTP] ✗",
            error.response?.status || "NETWORK",
            error.config?.url?.substring(0, 60),
            error.message
          );
        }
        return Promise.reject(error);
      }
    );
  }

  // Helper to extract domain (utility)
  private getDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  }

  /**
   * Make a GET request and return HTML text
   */
  async getText(url: string, options?: RequestOptions): Promise<string> {
    const response = await this.client.get(url, {
      headers: options?.headers,
      timeout: options?.timeout,
      responseType: "text",
    });
    return response.data;
  }

  /**
   * Make a GET request and return JSON
   */
  async getJson<T>(url: string, options?: RequestOptions): Promise<T> {
    const response = await this.client.get(url, {
      headers: options?.headers,
      timeout: options?.timeout,
    });
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
    const response = await this.client.post(url, data, {
      headers: options?.headers,
      timeout: options?.timeout,
      responseType: "text",
    });
    return response.data;
  }

  getUserAgent(): string {
    return USER_AGENT;
  }

  getAxiosInstance(): AxiosInstance {
    return this.client;
  }
}

export const HttpClient = new HttpClientClass();
