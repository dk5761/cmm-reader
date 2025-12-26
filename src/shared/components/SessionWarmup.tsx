import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Text,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  WebView,
  WebViewNavigation,
  WebViewMessageEvent,
} from "react-native-webview";
import CookieManager from "@react-native-cookies/cookies";
import * as WebBrowser from "expo-web-browser";
import { HttpClient } from "@/core/http";

type SessionWarmupProps = {
  /** URL to visit for warmup (e.g., the manga site homepage) */
  url: string;
  /** Callback when session is ready (cookies established) */
  onReady?: () => void;
  /** Timeout in ms before showing manual WebView (for CF sites) */
  autoTimeout?: number;
  /** Max timeout before giving up entirely */
  maxTimeout?: number;
  /** Whether to wait for cf_clearance cookie (for Cloudflare sites) */
  requireCfClearance?: boolean;
};

// JavaScript to check if we're on the actual site (not CF challenge)
const PAGE_CHECK_JS = `
(function() {
  try {
    // Check if this is the CF challenge page
    var isCfChallenge = document.title.toLowerCase().includes('just a moment') ||
                        document.body.innerHTML.includes('cf-browser-verification') ||
                        document.body.innerHTML.includes('challenge-running');
    
    // Get cookies anyway
    var cookies = document.cookie;
    
    // Check for site-specific indicators that we're past CF
    var hasContent = document.querySelector('.page-listing-item') !== null ||
                    document.querySelector('.manga') !== null ||
                    document.querySelector('article') !== null ||
                    document.body.innerHTML.length > 50000;
    
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'pageCheck',
      isCfChallenge: isCfChallenge,
      hasContent: hasContent,
      cookies: cookies,
      url: window.location.href,
      title: document.title,
      bodyLength: document.body.innerHTML.length
    }));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'error',
      error: e.message
    }));
  }
})();
true;
`;

/**
 * Hidden WebView that visits a URL to establish session cookies.
 * For Cloudflare sites: first tries auto-bypass, then shows WebView for manual Turnstile.
 */
export function SessionWarmup({
  url,
  onReady,
  autoTimeout = 5000,
  maxTimeout = 120000,
  requireCfClearance = false,
}: SessionWarmupProps) {
  const [isWarming, setIsWarming] = useState(true);
  const [showManualWebView, setShowManualWebView] = useState(false);
  const [showSafariOption, setShowSafariOption] = useState(false);
  const [isSafariLoading, setIsSafariLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safariTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);
  const webViewRef = useRef<WebView>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cfChallengePassedRef = useRef(false);

  const getDomain = (urlString: string): string => {
    try {
      const parsed = new URL(urlString);
      return parsed.hostname;
    } catch {
      return urlString;
    }
  };

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
    if (safariTimeoutRef.current) {
      clearTimeout(safariTimeoutRef.current);
      safariTimeoutRef.current = null;
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
  }, []);

  // Try to get cookies from native CookieManager (including HttpOnly)
  const syncCookiesFromNative = useCallback(async () => {
    try {
      const domain = getDomain(url);

      // Flush cookies on Android to ensure they're synced
      if (Platform.OS === "android") {
        await CookieManager.flush();
      }

      // Try to get cookies
      const cookies = await CookieManager.get(url);
      console.log("[SessionWarmup] Native cookies:", JSON.stringify(cookies));

      if (Object.keys(cookies).length > 0) {
        const cookieMap: Record<string, string> = {};
        for (const [name, cookie] of Object.entries(cookies)) {
          cookieMap[name] = cookie.value;
        }
        HttpClient.setCookies(domain, cookieMap);
        console.log(
          "[SessionWarmup] ✓ Native cookies synced:",
          Object.keys(cookieMap).join(", ")
        );

        if (cookieMap["cf_clearance"]) {
          console.log("[SessionWarmup] ✓ cf_clearance found via native!");
          return true;
        }
      }
    } catch (e) {
      console.warn("[SessionWarmup] Native cookie sync failed:", e);
    }
    return false;
  }, [url]);

  const completeWarmup = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;

    clearAllTimers();

    // Final attempt to sync cookies from native
    await syncCookiesFromNative();

    console.log("[SessionWarmup] ✓ Warmup complete for:", url);
    setShowManualWebView(false);
    setIsWarming(false);
    onReady?.();
  }, [url, onReady, clearAllTimers, syncCookiesFromNative]);

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        if (data.type === "pageCheck") {
          console.log("[SessionWarmup] Page check:", {
            isCfChallenge: data.isCfChallenge,
            hasContent: data.hasContent,
            title: data.title,
            bodyLength: data.bodyLength,
          });

          // If we're past the CF challenge (not on challenge page AND has content)
          if (!data.isCfChallenge && data.hasContent) {
            console.log("[SessionWarmup] ✓ CF challenge passed! Completing...");
            cfChallengePassedRef.current = true;

            // Try to get cookies from native (may include HttpOnly cf_clearance)
            await syncCookiesFromNative();

            // Small delay to ensure cookies are fully set, then complete
            setTimeout(() => {
              completeWarmup();
            }, 500);
          } else if (data.isCfChallenge) {
            console.log("[SessionWarmup] Still on CF challenge page...");
          }
        } else if (data.type === "error") {
          console.warn("[SessionWarmup] JS error:", data.error);
        }
      } catch (e) {
        console.warn("[SessionWarmup] Failed to parse message:", e);
      }
    },
    [syncCookiesFromNative, completeWarmup]
  );

  // Inject page check script
  const injectPageCheck = useCallback(() => {
    if (webViewRef.current && !completedRef.current) {
      webViewRef.current.injectJavaScript(PAGE_CHECK_JS);
    }
  }, []);

  // Show fullscreen WebView for manual Turnstile completion
  const showManualMode = useCallback(() => {
    if (!completedRef.current && !cfChallengePassedRef.current) {
      console.log(
        "[SessionWarmup] Auto-bypass timeout, showing manual WebView"
      );
      setShowManualWebView(true);

      // After 15s in manual mode, show Safari option (iOS only)
      if (Platform.OS === "ios") {
        safariTimeoutRef.current = setTimeout(() => {
          if (!completedRef.current && !cfChallengePassedRef.current) {
            console.log(
              "[SessionWarmup] Manual WebView timing out, showing Safari option"
            );
            setShowSafariOption(true);
          }
        }, 15000);
      }
    }
  }, []);

  // Open URL in Safari for Turnstile bypass
  const openInSafari = useCallback(async () => {
    if (completedRef.current) return;

    console.log("[SessionWarmup] Opening in Safari:", url);
    setIsSafariLoading(true);

    try {
      // Use openAuthSessionAsync which shares cookies with Safari
      const result = await WebBrowser.openAuthSessionAsync(
        url,
        undefined, // No callback URL - user will manually come back
        {
          preferEphemeralSession: false, // Share cookies with Safari
          showInRecents: true,
        }
      );

      console.log("[SessionWarmup] Safari result:", result.type);

      // After returning from Safari, try to sync cookies
      const hasClearance = await syncCookiesFromNative();

      if (hasClearance) {
        console.log("[SessionWarmup] ✓ Got cf_clearance from Safari!");
        completeWarmup();
      } else {
        // Give a moment for cookies to propagate, then complete anyway
        console.log("[SessionWarmup] No cf_clearance yet, waiting briefly...");
        setTimeout(async () => {
          await syncCookiesFromNative();
          completeWarmup();
        }, 1000);
      }
    } catch (error) {
      console.warn("[SessionWarmup] Safari error:", error);
      // Still try to sync cookies and complete
      await syncCookiesFromNative();
      completeWarmup();
    } finally {
      setIsSafariLoading(false);
    }
  }, [url, syncCookiesFromNative, completeWarmup]);

  useEffect(() => {
    if (requireCfClearance) {
      // For CF sites: 10s auto timeout, then show manual WebView
      timeoutRef.current = setTimeout(() => {
        showManualMode();
      }, autoTimeout);

      // Max timeout - give up after maxTimeout
      maxTimeoutRef.current = setTimeout(() => {
        console.log("[SessionWarmup] Max timeout reached, completing anyway");
        completeWarmup();
      }, maxTimeout);
    } else {
      // For non-CF sites: simple timeout
      timeoutRef.current = setTimeout(() => {
        console.log("[SessionWarmup] Timeout reached for:", url);
        completeWarmup();
      }, autoTimeout);
    }

    return () => {
      clearAllTimers();
    };
  }, [
    url,
    autoTimeout,
    maxTimeout,
    requireCfClearance,
    completeWarmup,
    showManualMode,
    clearAllTimers,
  ]);

  const handleLoadEnd = useCallback(() => {
    console.log("[SessionWarmup] Page loaded:", url);

    // Inject script to check page state
    injectPageCheck();

    // Set up periodic check
    if (!checkIntervalRef.current) {
      checkIntervalRef.current = setInterval(() => {
        if (!completedRef.current && !cfChallengePassedRef.current) {
          injectPageCheck();
        } else if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }
      }, 2000);
    }
  }, [url, injectPageCheck]);

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      console.log(
        "[SessionWarmup] Navigation:",
        navState.url.substring(0, 50),
        "loading:",
        navState.loading
      );

      // Check if URL no longer has CF challenge params (good sign!)
      const hasCfChallenge = navState.url.includes("__cf_chl");
      if (
        !hasCfChallenge &&
        !navState.loading &&
        navState.url.includes(getDomain(url))
      ) {
        console.log(
          "[SessionWarmup] Navigation indicates CF challenge may be complete"
        );
        // Small delay then check page
        setTimeout(() => {
          injectPageCheck();
        }, 1000);
      }
    },
    [url, injectPageCheck]
  );

  const handleCancel = useCallback(() => {
    console.log("[SessionWarmup] User cancelled manual warmup");
    completeWarmup();
  }, [completeWarmup]);

  if (!isWarming) {
    return null;
  }

  // Manual WebView modal for Cloudflare Turnstile
  if (showManualWebView) {
    return (
      <Modal
        visible={true}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCancel}
      >
        <SafeAreaView style={styles.modalContainer} edges={["top", "bottom"]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Complete Verification</Text>
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Skip</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            Please complete the security check to access this source
          </Text>

          {/* Safari fallback button - shows after timeout on iOS */}
          {showSafariOption && Platform.OS === "ios" && (
            <TouchableOpacity
              onPress={openInSafari}
              style={styles.safariButton}
              disabled={isSafariLoading}
            >
              {isSafariLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.safariButtonText}>Open in Safari</Text>
              )}
            </TouchableOpacity>
          )}

          <WebView
            ref={webViewRef}
            source={{ uri: url }}
            style={styles.fullWebview}
            onLoadEnd={handleLoadEnd}
            onNavigationStateChange={handleNavigationStateChange}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            originWhitelist={["*"]}
            cacheEnabled
            cacheMode="LOAD_DEFAULT"
            userAgent={HttpClient.getUserAgent()}
          />
        </SafeAreaView>
      </Modal>
    );
  }

  // Hidden WebView for auto-bypass attempt
  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webview}
        onLoadEnd={handleLoadEnd}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        originWhitelist={["*"]}
        cacheEnabled
        cacheMode="LOAD_DEFAULT"
        userAgent={HttpClient.getUserAgent()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenContainer: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
  },
  webview: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a4a",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#3a3a5a",
  },
  cancelText: {
    color: "#aaa",
    fontSize: 14,
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  fullWebview: {
    flex: 1,
  },
  safariButton: {
    backgroundColor: "#007AFF",
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  safariButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
