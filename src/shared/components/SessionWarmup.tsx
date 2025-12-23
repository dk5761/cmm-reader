import { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";

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
 * These cookies are then shared with other WebViews in the app.
 */
export function SessionWarmup({
  url,
  onReady,
  timeout = 5000,
}: SessionWarmupProps) {
  const [isWarming, setIsWarming] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Set a timeout to complete warmup even if page takes too long
    timeoutRef.current = setTimeout(() => {
      console.log(
        "[SessionWarmup] Timeout reached, completing warmup for:",
        url
      );
      setIsWarming(false);
      onReady?.();
    }, timeout);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [url, timeout, onReady]);

  const handleLoadEnd = useCallback(() => {
    console.log("[SessionWarmup] Page loaded, cookies established for:", url);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsWarming(false);
    onReady?.();
  }, [url, onReady]);

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
        userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
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
