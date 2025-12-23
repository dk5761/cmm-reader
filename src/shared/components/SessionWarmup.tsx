import { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import CookieManager from "@react-native-cookies/cookies";
import { HttpClient } from "@/core/http";

type SessionWarmupProps = {
  /** URL to visit for warmup (e.g., the manga site homepage) */
  url: string;
  /** Callback when session is ready (cookies established) */
  onReady?: () => void;
  /** Timeout in ms before considering warmup complete anyway */
  timeout?: number;
};

/**
 * Hidden WebView that visits a URL to establish session cookies.
 * These cookies are then shared with other WebViews AND synced to HttpClient.
 */
export function SessionWarmup({
  url,
  onReady,
  timeout = 8000,
}: SessionWarmupProps) {
  const [isWarming, setIsWarming] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  const getDomain = (urlString: string): string => {
    try {
      const parsed = new URL(urlString);
      return parsed.hostname;
    } catch {
      return urlString;
    }
  };

  const syncCookiesToHttpClient = useCallback(async () => {
    try {
      const domain = getDomain(url);
      // Get all cookies from WebView for this domain
      const cookies = await CookieManager.get(url);

      if (Object.keys(cookies).length > 0) {
        // Convert to simple key-value format for HttpClient
        const cookieMap: Record<string, string> = {};
        for (const [name, cookie] of Object.entries(cookies)) {
          cookieMap[name] = cookie.value;
        }

        // Sync to HttpClient
        HttpClient.setCookies(domain, cookieMap);
        console.log(
          "[SessionWarmup] Synced cookies to HttpClient:",
          Object.keys(cookieMap).join(", ")
        );

        // Check for Cloudflare clearance
        if (cookieMap["cf_clearance"]) {
          console.log(
            "[SessionWarmup] ✓ Cloudflare clearance cookie obtained!"
          );
        }
      }
    } catch (e) {
      console.warn("[SessionWarmup] Failed to sync cookies:", e);
    }
  }, [url]);

  const completeWarmup = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;

    // Sync cookies before completing
    await syncCookiesToHttpClient();

    setIsWarming(false);
    onReady?.();
  }, [syncCookiesToHttpClient, onReady]);

  useEffect(() => {
    // Set a timeout to complete warmup even if page takes too long
    timeoutRef.current = setTimeout(() => {
      console.log(
        "[SessionWarmup] Timeout reached, completing warmup for:",
        url
      );
      completeWarmup();
    }, timeout);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [url, timeout, completeWarmup]);

  const handleLoadEnd = useCallback(() => {
    console.log("[SessionWarmup] Page loaded, syncing cookies for:", url);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    completeWarmup();
  }, [url, completeWarmup]);

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      console.log(
        "[SessionWarmup] Navigation:",
        navState.url,
        "loading:",
        navState.loading
      );
    },
    []
  );

  if (!isWarming) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        onLoadEnd={handleLoadEnd}
        onNavigationStateChange={handleNavigationStateChange}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        cacheEnabled
        cacheMode="LOAD_DEFAULT"
        userAgent={HttpClient.getUserAgent()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
  },
  webview: {
    flex: 1,
  },
});
