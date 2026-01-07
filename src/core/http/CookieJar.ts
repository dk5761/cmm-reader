
import { Platform } from "react-native";
import CookieManager from "@react-native-cookies/cookies";
import CookieSync from "cookie-sync";
import type { Cookie } from "./types";
import { logger } from "@/utils/logger";

/**
 * Platform-agnostic interface for Cookie Management.
 * - iOS: Uses 'cookie-sync' to bridge WKWebView and Native.
 * - Android: Uses '@react-native-cookies/cookies'.
 * 
 * This removes the need for manual AsyncStorage syncing, relying on 
 * the OS's native persistent cookie storage where possible.
 */
class CookieJar {
  
  /**
   * Get cookie string for a URL (suitable for HTTP 'Cookie' header)
   */
  async getCookieString(url: string): Promise<string> {
    try {
      if (Platform.OS === "ios") {
        // On iOS, CookieSync reads directly from WKHTTPCookieStore
        const result = await CookieSync.getCookieString(url);
        return result || "";
      } else {
        // On Android, CookieManager reads from the system CookieStore
        // Note: CookieManager.get(url) returns an object { [name]: { value, ... } }
        const cookies = await CookieManager.get(url);
        return Object.entries(cookies)
          .map(([name, c]) => `${name}=${c.value}`)
          .join("; ");
      }
    } catch (error) {
      logger.http.error("CookieJar: Failed to get cookie string", { error, url });
      return "";
    }
  }

  /**
   * Sync cookies from WebView to Native storage (iOS specific).
   * No-op on Android as they share the same store usually (or handled by CookieManager).
   */
  async syncFromWebView(url: string): Promise<void> {
    if (Platform.OS === "ios") {
      try {
        await CookieSync.syncCookiesToNative(url);
      } catch (error) {
        logger.http.error("CookieJar: Sync failed", { error, url });
      }
    }
    // Android sync is automatic/handled via CookieManager.flush() if needed
  }

  /**
   * Clear cookies for a specific domain (to force fresh challenge)
   */
  async invalidateDomain(url: string): Promise<void> {
    try {
      if (Platform.OS === "ios") {
        await CookieSync.clearCfClearance(url);
      } else {
        // On Android, we clear all cookies for this URL
        await CookieManager.clearByName(url, "cf_clearance");
      }
      logger.http.log("CookieJar: Domain invalidated", { url });
    } catch (error) {
      logger.http.error("CookieJar: Invalidation failed", { error, url });
    }
  }

  /**
   * Clear all cookies
   */
  async clearAll(): Promise<void> {
    try {
      await CookieManager.clearAll();
      logger.http.log("CookieJar: All cookies cleared");
    } catch (error) {
      logger.http.error("CookieJar: Clear failed", { error });
    }
  }

  /**
   * Check for Cloudflare Clearance token
   */
  async hasCfClearance(url: string): Promise<boolean> {
    const cookies = await this.getCookieString(url);
    return cookies.includes("cf_clearance");
  }
}

export const cookieJar = new CookieJar();
