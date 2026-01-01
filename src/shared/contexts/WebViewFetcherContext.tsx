import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  View,
  StyleSheet,
  Modal,
  Text,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { HttpClient } from "@/core/http";
import { WebViewFetcherService } from "@/core/http/WebViewFetcherService";
import { registerManualChallengeHandler } from "@/core/http/CloudflareInterceptor";
import { CookieManagerInstance } from "@/core/http/CookieManager";
import { useSession } from "./SessionContext";
import CookieSync from "cookie-sync";
import { cfLogger } from "@/utils/cfDebugLogger";

type RequestType = "navigate" | "post";

type FetchRequest = {
  id: string;
  type: RequestType;
  url: string;
  body?: string;
  headers?: Record<string, string>;
  resolve: (html: string) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  // For POST: whether we've navigated to domain first
  domainReady?: boolean;
};

type WebViewFetcherContextType = {
  fetchHtml: (url: string, timeoutMs?: number) => Promise<string>;
  postHtml: (
    url: string,
    body?: string,
    headers?: Record<string, string>,
    timeoutMs?: number
  ) => Promise<string>;
  isReady: boolean;
};

const WebViewFetcherContext = createContext<WebViewFetcherContextType | null>(
  null
);

// JavaScript to extract page HTML after navigation
const EXTRACT_HTML_JS = `
(function() {
  try {
    var html = document.documentElement.outerHTML;
    var title = document.title || '';
    var isCfChallenge = title.toLowerCase().includes('just a moment') ||
                        html.includes('cf-browser-verification') ||
                        html.includes('challenge-running');
    
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'html',
      html: html,
      title: title,
      isCfChallenge: isCfChallenge,
      url: window.location.href
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

// Generate JavaScript for POST request via fetch API
const createPostScript = (
  url: string,
  body?: string,
  headers?: Record<string, string>
) => {
  const headersObj = {
    "X-Requested-With": "XMLHttpRequest",
    ...headers,
  };

  // Escape the body properly for JS string
  const bodyStr = body ? body.replace(/"/g, '\\"') : "";

  return `
(async function() {
  try {
    console.log('[WebViewFetcher JS] Starting POST to:', "${url}");
    const response = await fetch("${url}", {
      method: "POST",
      headers: ${JSON.stringify(headersObj)},
      body: "${bodyStr}",
      credentials: "include"
    });
    console.log('[WebViewFetcher JS] POST response status:', response.status);
    const html = await response.text();
    console.log('[WebViewFetcher JS] POST response length:', html.length);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'postResponse',
      html: html,
      status: response.status,
      url: "${url}"
    }));
  } catch(e) {
    console.log('[WebViewFetcher JS] POST error:', e.message);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'postError',
      error: e.message,
      url: "${url}"
    }));
  }
})();
true;
`;
};

// JavaScript to signal domain is ready for fetch requests
const DOMAIN_READY_CHECK_JS = `
(function() {
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'domainReady',
    url: window.location.href,
    origin: window.location.origin
  }));
})();
true;
`;

type WebViewFetcherProviderProps = {
  children: ReactNode;
};

// Extract origin from URL
const getOrigin = (url: string): string => {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
};

/**
 * Provider that manages a hidden WebView for fetching HTML from CF-protected sites.
 * Supports both GET (navigation) and POST (fetch API) requests.
 */
export function WebViewFetcherProvider({
  children,
}: WebViewFetcherProviderProps) {
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const requestQueueRef = useRef<FetchRequest[]>([]);
  const currentRequestRef = useRef<FetchRequest | null>(null);
  const currentOriginRef = useRef<string>("https://localhost");
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Manual CF challenge modal state
  const [manualChallengeUrl, setManualChallengeUrl] = useState<string | null>(
    null
  );
  const manualChallengeResolveRef = useRef<
    ((result: { success: boolean; cookies?: string }) => void) | null
  >(null);
  const manualWebViewRef = useRef<WebView>(null);
  const manualChallengeTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const cfCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const [isVerifying, setIsVerifying] = useState(false);

  // Process next request in queue
  const processNextRequest = useCallback(() => {
    if (currentRequestRef.current || requestQueueRef.current.length === 0) {
      return;
    }

    const request = requestQueueRef.current.shift();
    if (!request) return;

    currentRequestRef.current = request;
    retryCountRef.current = 0;
    console.log(
      "[WebViewFetcher] Processing",
      request.type.toUpperCase(),
      "request:",
      request.url.substring(0, 60)
    );

    if (webViewRef.current) {
      if (request.type === "navigate") {
        // Navigate to URL for GET requests
        // Use window.location.replace() to force full navigation (bypass any caching)
        // Add timestamp to bust browser cache
        const cacheBustedUrl =
          request.url +
          (request.url.includes("?") ? "&" : "?") +
          "_t=" +
          Date.now();
        const safeUrl = JSON.stringify(cacheBustedUrl);
        console.log("[WebViewFetcher] Full URL to navigate:", cacheBustedUrl);
        webViewRef.current.injectJavaScript(
          `window.location.replace(${safeUrl}); true;`
        );
      } else if (request.type === "post") {
        const targetOrigin = getOrigin(request.url);

        // Check if we're on the correct origin for the POST request
        if (currentOriginRef.current === targetOrigin) {
          // Already on correct domain, execute POST immediately
          console.log("[WebViewFetcher] Already on domain, executing POST");
          request.domainReady = true;
          const script = createPostScript(
            request.url,
            request.body,
            request.headers
          );
          webViewRef.current.injectJavaScript(script);
        } else {
          // Need to navigate to domain first
          console.log(
            "[WebViewFetcher] Navigating to domain first:",
            targetOrigin
          );
          request.domainReady = false;
          webViewRef.current.injectJavaScript(`
            window.location.href = "${targetOrigin}/";
            true;
          `);
        }
      }
    }
  }, []);

  // Handle messages from WebView
  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        const request = currentRequestRef.current;

        console.log("[WebViewFetcher] Message:", data.type);

        if (!request) {
          console.log(
            "[WebViewFetcher] Received message but no active request"
          );
          return;
        }

        // Handle navigation response (GET)
        if (data.type === "html") {
          console.log("[WebViewFetcher] Received HTML:", {
            responseUrl: data.url,
            requestUrl: request.url,
            title: data.title,
            isCfChallenge: data.isCfChallenge,
            length: data.html?.length,
          });

          // Check if the response URL matches the request URL (allow for slight differences)
          // This prevents returning stale HTML from the previous page
          // Extract key params (like order=) to verify we got the right page
          const requestUrl = new URL(request.url);
          const responseUrl = data.url || "";

          // Get the key distinguishing param (e.g., order=update or order=rating)
          const requestOrder = requestUrl.searchParams.get("order");
          const responseHasCorrectOrder = requestOrder
            ? responseUrl.includes(`order=${requestOrder}`)
            : responseUrl.includes(requestUrl.pathname);

          if (!responseHasCorrectOrder) {
            console.log(
              "[WebViewFetcher] URL mismatch, waiting for correct page...",
              { expected: requestOrder, got: responseUrl }
            );
            // Wait for the correct page to load
            setTimeout(() => {
              if (webViewRef.current) {
                webViewRef.current.injectJavaScript(EXTRACT_HTML_JS);
              }
            }, 1000);
            return;
          }

          if (data.isCfChallenge) {
            retryCountRef.current++;
            if (retryCountRef.current < maxRetries) {
              console.log("[WebViewFetcher] Still on CF challenge, waiting...");
              setTimeout(() => {
                if (webViewRef.current) {
                  webViewRef.current.injectJavaScript(EXTRACT_HTML_JS);
                }
              }, 2000);
              return;
            }
          }

          clearTimeout(request.timeout);
          request.resolve(data.html);
          currentRequestRef.current = null;
          processNextRequest();
        }
        // Handle domain ready (for POST after navigation)
        else if (data.type === "domainReady") {
          console.log("[WebViewFetcher] Domain ready:", data.origin);
          currentOriginRef.current = data.origin || "";

          // If this is a POST request waiting for domain, execute it now
          if (
            request.type === "post" &&
            !request.domainReady &&
            webViewRef.current
          ) {
            console.log("[WebViewFetcher] Domain ready, executing POST now");
            request.domainReady = true;
            const script = createPostScript(
              request.url,
              request.body,
              request.headers
            );
            webViewRef.current.injectJavaScript(script);
          }
        }
        // Handle POST response
        else if (data.type === "postResponse") {
          console.log("[WebViewFetcher] POST response:", {
            url: data.url?.substring(0, 50),
            status: data.status,
            length: data.html?.length,
          });

          clearTimeout(request.timeout);
          request.resolve(data.html);
          currentRequestRef.current = null;
          processNextRequest();
        }
        // Handle POST error
        else if (data.type === "postError") {
          console.warn("[WebViewFetcher] POST error:", data.error);
          clearTimeout(request.timeout);
          request.reject(new Error(data.error));
          currentRequestRef.current = null;
          processNextRequest();
        }
        // Handle general JS error
        else if (data.type === "error") {
          console.warn("[WebViewFetcher] JS error:", data.error);
          clearTimeout(request.timeout);
          request.reject(new Error(data.error));
          currentRequestRef.current = null;
          processNextRequest();
        }
      } catch (e) {
        console.warn("[WebViewFetcher] Failed to parse message:", e);
      }
    },
    [processNextRequest]
  );

  // Handle load end - extract HTML for navigation requests, or signal domain ready for POST
  const handleLoadEnd = useCallback(() => {
    const request = currentRequestRef.current;

    console.log("[WebViewFetcher] Page loaded");

    if (!request) return;

    if (request.type === "navigate") {
      console.log("[WebViewFetcher] Navigate request, extracting HTML");
      setTimeout(() => {
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(EXTRACT_HTML_JS);
        }
      }, 500);
    } else if (request.type === "post" && !request.domainReady) {
      // Domain loaded, now we can execute the POST
      console.log("[WebViewFetcher] POST domain loaded, signaling ready");
      setTimeout(() => {
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(DOMAIN_READY_CHECK_JS);
        }
      }, 500);
    }
  }, []);

  // GET request via navigation
  const fetchHtml = useCallback(
    (url: string, timeoutMs = 30000): Promise<string> => {
      return new Promise((resolve, reject) => {
        const id = Math.random().toString(36).substring(7);

        const timeout = setTimeout(() => {
          console.log(
            "[WebViewFetcher] Request timeout:",
            url.substring(0, 60)
          );
          if (currentRequestRef.current?.id === id) {
            currentRequestRef.current = null;
            processNextRequest();
          } else {
            requestQueueRef.current = requestQueueRef.current.filter(
              (r) => r.id !== id
            );
          }
          reject(new Error("WebView fetch timeout"));
        }, timeoutMs);

        const request: FetchRequest = {
          id,
          type: "navigate",
          url,
          resolve,
          reject,
          timeout,
        };
        requestQueueRef.current.push(request);

        console.log(
          "[WebViewFetcher] Queued GET request:",
          url.substring(0, 60),
          "Queue size:",
          requestQueueRef.current.length
        );
        processNextRequest();
      });
    },
    [processNextRequest]
  );

  // POST request via fetch API
  const postHtml = useCallback(
    (
      url: string,
      body?: string,
      headers?: Record<string, string>,
      timeoutMs = 30000
    ): Promise<string> => {
      return new Promise((resolve, reject) => {
        const id = Math.random().toString(36).substring(7);

        const timeout = setTimeout(() => {
          console.log("[WebViewFetcher] POST timeout:", url.substring(0, 60));
          if (currentRequestRef.current?.id === id) {
            currentRequestRef.current = null;
            processNextRequest();
          } else {
            requestQueueRef.current = requestQueueRef.current.filter(
              (r) => r.id !== id
            );
          }
          reject(new Error("WebView POST timeout"));
        }, timeoutMs);

        const request: FetchRequest = {
          id,
          type: "post",
          url,
          body,
          headers,
          resolve,
          reject,
          timeout,
          domainReady: false,
        };
        requestQueueRef.current.push(request);

        console.log(
          "[WebViewFetcher] Queued POST request:",
          url.substring(0, 60),
          "Queue size:",
          requestQueueRef.current.length
        );
        processNextRequest();
      });
    },
    [processNextRequest]
  );

  // Mark as ready when WebView is mounted
  const handleWebViewLoad = useCallback(() => {
    console.log("[WebViewFetcher] WebView ready");
    setIsReady(true);
  }, []);

  // Clean up manual challenge timers
  const clearManualChallengeTimers = useCallback(() => {
    if (manualChallengeTimeoutRef.current) {
      clearTimeout(manualChallengeTimeoutRef.current);
      manualChallengeTimeoutRef.current = null;
    }
    if (cfCheckIntervalRef.current) {
      clearInterval(cfCheckIntervalRef.current);
      cfCheckIntervalRef.current = null;
    }
  }, []);

  // Get invalidateSession from SessionContext
  const { invalidateSession } = useSession();

  // Check for successful CF challenge completion (cf_clearance cookie)
  const checkForCfClearance = useCallback(
    async (
      url: string
    ): Promise<{
      success: boolean;
      cookies?: string;
    }> => {
      try {
        const domain = new URL(url).hostname;

        // Use native module on iOS for reliable cookie extraction
        if (Platform.OS === "ios") {
          const hasCfClearance = await CookieSync.hasCfClearance(url);
          if (hasCfClearance) {
            const cookieString = await CookieSync.getCookieString(url);
            await CookieSync.syncCookiesToNative(url);
            // Cache for persistence across app restarts
            await CookieManagerInstance.cacheCookieString(domain, cookieString);
            return { success: true, cookies: cookieString || undefined };
          }
          return { success: false };
        }

        // Android: use existing method
        const cookiesArray = await CookieManagerInstance.extractFromWebView(
          url
        );
        const hasCfClearance = cookiesArray.some(
          (c) => c.name === "cf_clearance"
        );

        if (hasCfClearance) {
          await CookieManagerInstance.setCookies(domain, cookiesArray);
          const cookieString = await CookieManagerInstance.getCookies(domain);
          return { success: true, cookies: cookieString || undefined };
        }
        return { success: false };
      } catch {
        return { success: false };
      }
    },
    []
  );

  // Manual challenge handler - called by CloudflareInterceptor when auto-bypass fails
  const handleManualChallenge = useCallback(
    async (url: string): Promise<{ success: boolean; cookies?: string }> => {
      console.log("[WebViewFetcher] Manual challenge requested for:", url);

      // STEP 1: Check if existing token is still valid (not expired)
      if (Platform.OS === "ios") {
        try {
          const validity = await CookieSync.isCfClearanceValid(url);
          console.log("[WebViewFetcher] Token validity check:", validity);

          await cfLogger.log("WebViewFetcher", "Token validity check", {
            url: url.substring(0, 80),
            exists: validity.exists,
            isValid: validity.isValid,
            expiresDate: validity.expiresDate,
          });

          if (validity.exists && validity.isValid) {
            // Token exists and is NOT expired - this shouldn't happen if we got here
            // but just in case, return success without showing modal
            console.log("[WebViewFetcher] Valid token exists, skipping modal");
            const cookies = await CookieSync.getCookieString(url);
            return { success: true, cookies };
          }

          // STEP 2: Token is expired or invalid - clear it before showing modal
          if (validity.exists && !validity.isValid) {
            console.log("[WebViewFetcher] Clearing expired cf_clearance token");
            await CookieSync.clearCfClearance(url);

            await cfLogger.log("WebViewFetcher", "Cleared expired token", {
              url: url.substring(0, 80),
              wasExpired: true,
            });
          }
        } catch (e) {
          console.log("[WebViewFetcher] Token validity check failed:", e);
        }
      }

      // STEP 3: Show modal for user to complete challenge
      return new Promise((resolve) => {
        cfLogger.logChallengeState("modal-opened", {
          url: url.substring(0, 80),
          trigger: "manual-challenge-handler",
          clearedExpiredToken: true,
        });

        manualChallengeResolveRef.current = resolve;
        setManualChallengeUrl(url);

        // Start 90-second timeout
        manualChallengeTimeoutRef.current = setTimeout(async () => {
          console.log("[WebViewFetcher] Manual challenge timeout (90s)");
          const result = await checkForCfClearance(url);
          clearManualChallengeTimers();

          if (manualChallengeResolveRef.current) {
            manualChallengeResolveRef.current(result);
            manualChallengeResolveRef.current = null;
          }
          setManualChallengeUrl(null);
        }, 90000);

        // Wait 10 seconds before starting polling (increased from 5s)
        // This gives user time to complete the challenge without premature detection
        setTimeout(() => {
          // Only start polling if modal is still open
          if (!manualChallengeResolveRef.current) return;

          console.log("[WebViewFetcher] Starting cf_clearance polling...");
          cfCheckIntervalRef.current = setInterval(async () => {
            const checkStart = Date.now();

            // Use validity check to ensure we only detect NEW valid tokens
            if (Platform.OS === "ios") {
              const validity = await CookieSync.isCfClearanceValid(url);
              if (validity.isValid) {
                console.log(
                  "[WebViewFetcher] Valid cf_clearance detected, auto-dismissing"
                );
                const cookies = await CookieSync.getCookieString(url);

                await cfLogger.log(
                  "WebViewFetcher",
                  "Auto-dismiss - valid token found",
                  {
                    pollingDurationMs: Date.now() - checkStart,
                    cookieLength: cookies?.length,
                  }
                );

                clearManualChallengeTimers();

                if (manualChallengeResolveRef.current) {
                  manualChallengeResolveRef.current({ success: true, cookies });
                  manualChallengeResolveRef.current = null;
                }
                setManualChallengeUrl(null);
              }
            } else {
              // Android fallback
              const result = await checkForCfClearance(url);
              if (result.success) {
                console.log(
                  "[WebViewFetcher] cf_clearance detected, auto-dismissing"
                );

                await cfLogger.log(
                  "WebViewFetcher",
                  "Auto-dismiss - cf_clearance found",
                  {
                    pollingDurationMs: Date.now() - checkStart,
                    hasCookies: !!result.cookies,
                    cookieLength: result.cookies?.length,
                  }
                );

                clearManualChallengeTimers();

                if (manualChallengeResolveRef.current) {
                  manualChallengeResolveRef.current(result);
                  manualChallengeResolveRef.current = null;
                }
                setManualChallengeUrl(null);
              }
            }
          }, 2000);
        }, 10000); // Increased to 10 seconds
      });
    },
    [checkForCfClearance, clearManualChallengeTimers]
  );

  // Handle manual challenge completion (user presses Done)
  const handleManualChallengeDone = useCallback(async () => {
    if (!manualChallengeUrl) return;

    console.log("[WebViewFetcher] User pressed Done, extracting cookies...");
    clearManualChallengeTimers();
    setIsVerifying(true);

    const domain = new URL(manualChallengeUrl).hostname;
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 500;

    try {
      let hasCfClearance = false;
      let cookieString: string | undefined;

      // Retry logic - attempt extraction multiple times with delay
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        // Wait before each attempt to allow cookie to be written
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));

        console.log(
          `[WebViewFetcher] Cookie extraction attempt ${attempt}/${MAX_ATTEMPTS}`
        );

        // Use native module on iOS for reliable cookie extraction from WKWebView
        if (Platform.OS === "ios") {
          hasCfClearance = await CookieSync.hasCfClearance(manualChallengeUrl);
          if (hasCfClearance) {
            cookieString = await CookieSync.getCookieString(manualChallengeUrl);
            // Sync to native storage and cache for persistence
            await CookieSync.syncCookiesToNative(manualChallengeUrl);
            await CookieManagerInstance.cacheCookieString(domain, cookieString);
            break;
          }
        } else {
          // Android: use existing method (works fine)
          const cookiesArray = await CookieManagerInstance.extractFromWebView(
            manualChallengeUrl
          );
          hasCfClearance = cookiesArray.some((c) => c.name === "cf_clearance");
          if (hasCfClearance) {
            await CookieManagerInstance.setCookies(domain, cookiesArray);
            cookieString =
              (await CookieManagerInstance.getCookies(domain)) || undefined;
            break;
          }
        }

        if (attempt === MAX_ATTEMPTS && !hasCfClearance) {
          console.log(
            `[WebViewFetcher] cf_clearance not found after ${MAX_ATTEMPTS} attempts`
          );
        }
      }

      console.log(
        "[WebViewFetcher] Manual challenge cookies:",
        hasCfClearance ? "cf_clearance found" : "no cf_clearance",
        { cookieLength: cookieString?.length }
      );

      if (manualChallengeResolveRef.current) {
        console.log("[WebViewFetcher] Resolving manual challenge promise:", {
          success: hasCfClearance,
          hasCookies: !!cookieString,
        });

        await cfLogger.logChallengeState(
          hasCfClearance ? "completed" : "failed",
          {
            trigger: "user-pressed-done",
            cookieLength: cookieString?.length,
            maxAttempts: MAX_ATTEMPTS,
          }
        );

        manualChallengeResolveRef.current({
          success: hasCfClearance,
          cookies: cookieString,
        });
        manualChallengeResolveRef.current = null;
      }
    } catch (error) {
      console.error("[WebViewFetcher] Failed to extract cookies:", error);
      if (manualChallengeResolveRef.current) {
        manualChallengeResolveRef.current({ success: false });
        manualChallengeResolveRef.current = null;
      }
    } finally {
      setIsVerifying(false);
    }

    setManualChallengeUrl(null);
  }, [manualChallengeUrl, clearManualChallengeTimers]);

  // Handle manual challenge cancel
  const handleManualChallengeCancel = useCallback(() => {
    console.log("[WebViewFetcher] User cancelled manual challenge");

    cfLogger.logChallengeState("cancelled", {
      trigger: "user-pressed-cancel",
    });

    clearManualChallengeTimers();

    if (manualChallengeResolveRef.current) {
      manualChallengeResolveRef.current({ success: false });
      manualChallengeResolveRef.current = null;
    }
    setManualChallengeUrl(null);
  }, [clearManualChallengeTimers]);

  // Register manual challenge handler with CloudflareInterceptor
  useEffect(() => {
    registerManualChallengeHandler(handleManualChallenge);
    return () => {
      registerManualChallengeHandler(null);
    };
  }, [handleManualChallenge]);

  // Register with the global service so non-React code can use it
  useEffect(() => {
    WebViewFetcherService.register(fetchHtml, postHtml, invalidateSession);
    return () => {
      WebViewFetcherService.unregister();
    };
  }, [fetchHtml, postHtml, invalidateSession]);

  return (
    <WebViewFetcherContext.Provider value={{ fetchHtml, postHtml, isReady }}>
      {children}
      <View style={styles.container} pointerEvents="none">
        <WebView
          ref={webViewRef}
          source={{
            html: "<html><body></body></html>",
            baseUrl: "https://localhost/",
          }}
          style={styles.webview}
          onLoadEnd={handleLoadEnd}
          onMessage={handleMessage}
          onLoad={handleWebViewLoad}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          cacheEnabled
          cacheMode="LOAD_DEFAULT"
          userAgent={HttpClient.getUserAgent()}
        />
      </View>

      {/* Manual CF Challenge Modal */}
      <Modal
        visible={!!manualChallengeUrl}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleManualChallengeCancel}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Pressable
              onPress={handleManualChallengeCancel}
              style={styles.modalButton}
              disabled={isVerifying}
            >
              <Text
                style={[
                  styles.modalButtonText,
                  isVerifying && styles.modalButtonDisabled,
                ]}
              >
                Cancel
              </Text>
            </Pressable>
            <Text style={styles.modalTitle}>Complete Verification</Text>
            <Pressable
              onPress={handleManualChallengeDone}
              style={[styles.modalButton, styles.modalDoneButton]}
              disabled={isVerifying}
            >
              <Text
                style={[
                  styles.modalButtonText,
                  styles.modalDoneText,
                  isVerifying && styles.modalButtonDisabled,
                ]}
              >
                {isVerifying ? "Verifying..." : "Done"}
              </Text>
            </Pressable>
          </View>

          {/* WebView */}
          {manualChallengeUrl && (
            <WebView
              ref={manualWebViewRef}
              source={{ uri: manualChallengeUrl }}
              style={styles.modalWebview}
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
              cacheEnabled
              cacheMode="LOAD_DEFAULT"
              originWhitelist={["*"]}
              allowsInlineMediaPlayback
              mixedContentMode="compatibility"
              allowsBackForwardNavigationGestures
              userAgent={
                Platform.OS === "ios"
                  ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
                  : "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
              }
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.loadingText}>Loading challenge...</Text>
                </View>
              )}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn(
                  "[WebViewFetcher] Manual WebView error:",
                  nativeEvent.description
                );
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn(
                  "[WebViewFetcher] Manual WebView HTTP error:",
                  nativeEvent.statusCode
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </WebViewFetcherContext.Provider>
  );
}

export function useWebViewFetcher() {
  const context = useContext(WebViewFetcherContext);
  if (!context) {
    throw new Error(
      "useWebViewFetcher must be used within a WebViewFetcherProvider"
    );
  }
  return context;
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
  modalContainer: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
  modalButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalButtonText: {
    fontSize: 16,
    color: "#888",
  },
  modalDoneButton: {
    backgroundColor: "#22c55e",
    borderRadius: 8,
  },
  modalDoneText: {
    color: "#fff",
    fontWeight: "600",
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalWebview: {
    flex: 1,
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0f",
  },
  loadingText: {
    marginTop: 16,
    color: "#888",
    fontSize: 14,
  },
});
