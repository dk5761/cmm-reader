import AsyncStorage from "@react-native-async-storage/async-storage";

const COOKIE_STORAGE_KEY = "http_cookies";
const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

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
  isCfChallenge(response: Response): boolean {
    // Cloudflare challenge typically returns 403 or 503
    if (response.status !== 403 && response.status !== 503) return false;

    // Check for Cloudflare headers
    const server = response.headers.get("server");
    const cfRay = response.headers.get("cf-ray");

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

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    await this.init();

    const headers = new Headers(options.headers);

    // Set default headers
    if (!headers.has("User-Agent")) {
      headers.set("User-Agent", USER_AGENT);
    }

    // Add cookies
    const cookies = this.getCookiesForUrl(url);
    if (cookies) {
      headers.set("Cookie", cookies);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Parse Set-Cookie headers (simplified)
    const setCookie = response.headers.get("Set-Cookie");
    if (setCookie) {
      const domain = this.getDomain(url);
      const cookieParts = setCookie.split(";")[0].split("=");
      if (cookieParts.length >= 2) {
        this.setCookies(domain, { [cookieParts[0]]: cookieParts[1] });
      }
    }

    return response;
  }

  async getText(url: string, options?: RequestInit): Promise<string> {
    const response = await this.fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.text();
  }

  async getJson<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await this.fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  getUserAgent(): string {
    return USER_AGENT;
  }
}

export const HttpClient = new HttpClientClass();
