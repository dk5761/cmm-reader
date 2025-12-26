import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

const COOKIE_STORAGE_KEY = "http_cookies";
const ANDROID_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const IOS_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const USER_AGENT = Platform.OS === "ios" ? IOS_USER_AGENT : ANDROID_USER_AGENT;

interface CookieJar {
  [domain: string]: {
    [name: string]: {
      value: string;
      expires?: number;
      timestamp?: number; // When cookie was set
    };
  };
}

class HttpClientClass {
  private cookieJar: CookieJar = {};
  private initialized = false;
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 15000,
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      // Return full response for non-2xx status codes
      validateStatus: () => true,
    });

    // Request interceptor - add cookies & logging
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const url = config.url || "";
        const cookies = this.getCookiesForUrl(url);
        if (cookies && config.headers) {
          config.headers.Cookie = cookies;
          // Debug: show if cf_clearance is present
          const hasCf = cookies.includes("cf_clearance");
          console.log(
            "[HTTP] →",
            config.method?.toUpperCase(),
            url,
            hasCf ? "✓ cf_clearance" : "⚠️ NO cf_clearance"
          );
        } else {
          console.log(
            "[HTTP] →",
            config.method?.toUpperCase(),
            url,
            "⚠️ NO COOKIES"
          );
        }
        return config;
      },
      (error) => {
        console.log("[HTTP] Request error:", error.message);
        return Promise.reject(error);
      }
    );

    // Response interceptor - logging & CF detection
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        const status = response.status;
        const url = response.config.url || "";
        const size =
          typeof response.data === "string" ? response.data.length : 0;
        console.log("[HTTP] ←", status, url, `(${size} bytes)`);

        // Parse Set-Cookie headers
        const setCookie = response.headers["set-cookie"];
        if (setCookie && response.config.url) {
          const domain = this.getDomain(response.config.url);
          setCookie.forEach((cookie: string) => {
            const parts = cookie.split(";")[0].split("=");
            if (parts.length >= 2) {
              this.setCookies(domain, { [parts[0]]: parts.slice(1).join("=") });
            }
          });
        }

        return response;
      },
      (error) => {
        console.log(
          "[HTTP] ✗",
          error.response?.status || "NETWORK",
          error.config?.url,
          error.message
        );
        return Promise.reject(error);
      }
    );
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const stored = await AsyncStorage.getItem(COOKIE_STORAGE_KEY);
      if (stored) {
        this.cookieJar = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load cookies:", e);
    }
    this.initialized = true;
  }

  private async saveCookies(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        COOKIE_STORAGE_KEY,
        JSON.stringify(this.cookieJar)
      );
    } catch (e) {
      console.warn("Failed to save cookies:", e);
    }
  }

  private getDomain(url: string): string {
    const match = url.match(/^https?:\/\/([^/]+)/);
    return match ? match[1] : "";
  }

  private getCookiesForUrl(url: string): string {
    const domain = this.getDomain(url);
    const cookies = this.cookieJar[domain];
    if (!cookies) return "";

    const now = Date.now();
    return Object.entries(cookies)
      .filter(([_, cookie]) => !cookie.expires || cookie.expires > now)
      .map(([name, cookie]) => `${name}=${cookie.value}`)
      .join("; ");
  }

  setCookies(domain: string, cookies: Record<string, string>): void {
    if (!this.cookieJar[domain]) {
      this.cookieJar[domain] = {};
    }
    const timestamp = Date.now();
    for (const [name, value] of Object.entries(cookies)) {
      this.cookieJar[domain][name] = { value, timestamp };
    }
    this.saveCookies();
  }

  getCookies(domain: string): Record<string, string> {
    const cookies = this.cookieJar[domain];
    if (!cookies) return {};
    return Object.fromEntries(
      Object.entries(cookies).map(([name, cookie]) => [name, cookie.value])
    );
  }

  /**
   * Check if we have a valid Cloudflare clearance cookie for a domain.
   * Cookies older than 25 minutes are considered stale.
   */
  hasCfClearance(domain: string): boolean {
    const cookies = this.cookieJar[domain];
    if (!cookies || !cookies["cf_clearance"]) return false;

    const clearance = cookies["cf_clearance"];
    const age = Date.now() - (clearance.timestamp || 0);
    const MAX_AGE = 25 * 60 * 1000; // 25 minutes

    return age < MAX_AGE;
  }

  /**
   * Check if a response indicates a Cloudflare challenge.
   */
  isCfChallenge(response: AxiosResponse): boolean {
    // Cloudflare challenge typically returns 403 or 503
    if (response.status !== 403 && response.status !== 503) return false;

    // Check for Cloudflare headers
    const server = response.headers["server"];
    const cfRay = response.headers["cf-ray"];

    return !!(server?.includes("cloudflare") || cfRay);
  }

  clearCookies(domain?: string): void {
    if (domain) {
      delete this.cookieJar[domain];
    } else {
      this.cookieJar = {};
    }
    this.saveCookies();
  }

  /**
   * Make a fetch-like request using axios (backward compatible)
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    await this.init();

    const response = await this.client.request({
      url,
      method: (options.method as any) || "GET",
      headers: options.headers as Record<string, string>,
      data: options.body,
      responseType: "text",
    });

    // Create a fetch-like Response object for backward compatibility
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      headers: {
        get: (name: string) => response.headers[name.toLowerCase()] || null,
      },
      text: async () => response.data,
      json: async () => JSON.parse(response.data),
    } as Response;
  }

  async getText(url: string, options?: RequestInit): Promise<string> {
    await this.init();

    const response = await this.client.get(url, {
      headers: options?.headers as Record<string, string>,
      responseType: "text",
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.data;
  }

  async getJson<T>(url: string, options?: RequestInit): Promise<T> {
    await this.init();

    const response = await this.client.get(url, {
      headers: options?.headers as Record<string, string>,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.data;
  }

  getUserAgent(): string {
    return USER_AGENT;
  }
}

export const HttpClient = new HttpClientClass();
