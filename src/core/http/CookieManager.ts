import AsyncStorage from "@react-native-async-storage/async-storage";
import CookieManager from "@react-native-cookies/cookies";
import type { Cookie, StoredCookies } from "./types";

const STORAGE_KEY = "cf_cookies_v1";
const DEFAULT_EXPIRY_HOURS = 24;

/**
 * Centralized cookie management for HTTP requests.
 * Stores cookies extracted from WebView and provides them to Axios requests.
 * Similar to OkHttp's CookieJar in Mihon.
 */
class CookieManagerClass {
  private cookies: Map<string, StoredCookies> = new Map();
  private isLoaded = false;

  /**
   * Load cookies from persistent storage on app start
   */
  async load(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert plain object to Map
        this.cookies = new Map(Object.entries(parsed));
        console.log(
          "[CookieManager] Loaded cookies for",
          this.cookies.size,
          "domains"
        );
      }
      this.isLoaded = true;
    } catch (e) {
      console.error("[CookieManager] Failed to load cookies:", e);
      this.isLoaded = true;
    }
  }

  /**
   * Save cookies to persistent storage
   */
  private async save(): Promise<void> {
    try {
      // Convert Map to plain object for storage
      const obj = Object.fromEntries(this.cookies);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      console.log(
        "[CookieManager] Saved cookies for",
        this.cookies.size,
        "domains"
      );
    } catch (e) {
      console.error("[CookieManager] Failed to save cookies:", e);
    }
  }

  /**
   * Extract cookies from WebView for a given URL
   */
  async extractFromWebView(url: string): Promise<Cookie[]> {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      // Get cookies from WebView
      const webViewCookies = await CookieManager.get(url);

      const cookies: Cookie[] = Object.entries(webViewCookies).map(
        ([name, cookie]) => ({
          name,
          value: cookie.value,
          domain: cookie.domain || domain,
          path: cookie.path,
          expires: cookie.expires
            ? new Date(cookie.expires).getTime()
            : undefined,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
        })
      );

      console.log(
        "[CookieManager] Extracted",
        cookies.length,
        "cookies from WebView for",
        domain
      );
      return cookies;
    } catch (e) {
      console.error(
        "[CookieManager] Failed to extract cookies from WebView:",
        e
      );
      return [];
    }
  }

  /**
   * Set cookies for a domain (after CF solve)
   */
  async setCookies(domain: string, cookies: Cookie[]): Promise<void> {
    if (!cookies || cookies.length === 0) {
      console.warn("[CookieManager] No cookies to set for", domain);
      return;
    }

    // Create cookie string for headers
    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Calculate expiry (use cookie expiry or default 24 hours)
    const cookieExpiry = cookies.find((c) => c.expires)?.expires;
    const expiry =
      cookieExpiry || Date.now() + DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000;

    const stored: StoredCookies = {
      cookies,
      cookieString,
      expiry,
      domain,
    };

    this.cookies.set(domain, stored);
    await this.save();

    console.log(
      "[CookieManager] Stored cookies for",
      domain,
      "expires:",
      new Date(expiry).toISOString()
    );
  }

  /**
   * Get cookie string for a domain (for request headers)
   */
  async getCookies(domain: string): Promise<string | null> {
    if (!this.isLoaded) {
      await this.load();
    }

    const stored = this.cookies.get(domain);

    if (!stored) {
      return null;
    }

    // Check if expired
    if (stored.expiry < Date.now()) {
      console.log("[CookieManager] Cookies expired for", domain);
      this.cookies.delete(domain);
      await this.save();
      return null;
    }

    return stored.cookieString;
  }

  /**
   * Cache cookie string directly (for native module on iOS)
   * This persists the cookie string without needing individual cookie objects
   */
  async cacheCookieString(domain: string, cookieString: string): Promise<void> {
    if (!cookieString) return;

    // Parse cookie string to check for cf_clearance
    const hasCfClearance = cookieString.includes("cf_clearance=");

    const stored: StoredCookies = {
      cookies: [], // Empty - we only have the string from native
      cookieString,
      expiry: Date.now() + DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000,
      domain,
    };

    this.cookies.set(domain, stored);
    await this.save();

    console.log(
      "[CookieManager] Cached cookie string for",
      domain,
      hasCfClearance ? "(has cf_clearance)" : ""
    );
  }

  /**
   * Check if we have valid CF clearance cookie
   */
  async hasCfClearance(domain: string): Promise<boolean> {
    const stored = this.cookies.get(domain);
    if (!stored || stored.expiry < Date.now()) {
      return false;
    }

    // Check cookieString first (used when caching from native module)
    if (stored.cookieString?.includes("cf_clearance=")) {
      return true;
    }

    // Fallback to checking cookies array
    return stored.cookies.some((c) => c.name === "cf_clearance");
  }

  /**
   * Clear cookies for a domain
   */
  async clearDomain(domain: string): Promise<void> {
    this.cookies.delete(domain);
    await this.save();
    console.log("[CookieManager] Cleared cookies for", domain);
  }

  /**
   * Clear all cookies
   */
  async clearAll(): Promise<void> {
    this.cookies.clear();
    await AsyncStorage.removeItem(STORAGE_KEY);
    console.log("[CookieManager] Cleared all cookies");
  }

  /**
   * Clean expired cookies
   */
  async cleanExpired(): Promise<void> {
    const now = Date.now();
    let cleaned = 0;

    for (const [domain, stored] of this.cookies.entries()) {
      if (stored.expiry < now) {
        this.cookies.delete(domain);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await this.save();
      console.log("[CookieManager] Cleaned", cleaned, "expired domains");
    }
  }

  /**
   * Get all stored domains (for debugging)
   */
  getStoredDomains(): string[] {
    return Array.from(this.cookies.keys());
  }
}

export const CookieManagerInstance = new CookieManagerClass();
