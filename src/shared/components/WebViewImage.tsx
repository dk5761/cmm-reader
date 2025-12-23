import { useState, useCallback, memo, useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

// CDN fallback list - mirroring what MangaBox likely discovers
const CDN_HOSTS = [
  "imgs-2.2xstorage.com",
  "img-r1.2xstorage.com",
  "imgs.2xstorage.com",
  "img.2xstorage.com",
];

type WebViewImageProps = {
  uri: string;
  baseUrl?: string;
  style?: object;
  className?: string;
};

/**
 * Loads images through a WebView with CDN fallback.
 * Uses 'origin' referrer policy to pass hotlink protection (requires session cookies).
 */
function WebViewImageComponent({
  uri,
  baseUrl = "https://www.mangakakalot.gg",
  style,
  className,
}: WebViewImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [currentUri, setCurrentUri] = useState(uri);
  const cdnIndexRef = useRef(0);
  const originalHostRef = useRef<string | null>(null);

  useEffect(() => {
    if (!uri) return;

    setLoaded(false);
    setCurrentUri(uri);
    cdnIndexRef.current = 0;

    try {
      const url = new URL(uri);
      originalHostRef.current = url.host;
    } catch {
      originalHostRef.current = null;
    }
  }, [uri]);

  const tryNextCdn = useCallback(() => {
    if (!uri) return;

    try {
      const url = new URL(uri);

      // Only try fallbacks for 2xstorage CDN (others might not need fallback)
      if (!url.host.includes("2xstorage.com")) {
        console.log(
          "[WebViewImage] Not a 2xstorage URL, no fallback available"
        );
        return;
      }

      // Find next CDN to try
      cdnIndexRef.current++;

      // Get list of CDNs to try (excluding the original host)
      const cdnsToTry = CDN_HOSTS.filter((h) => h !== originalHostRef.current);

      if (cdnIndexRef.current <= cdnsToTry.length) {
        const nextCdn = cdnsToTry[cdnIndexRef.current - 1];
        url.host = nextCdn;
        const newUri = url.toString();
        // Don't log clutter unless needed
        // console.log("[WebViewImage] Trying CDN fallback:", newUri);
        setCurrentUri(newUri);
      }
    } catch (e) {
      // console.log("[WebViewImage] Error in fallback:", e);
    }
  }, [uri]);

  if (!uri) {
    return <View style={[style, styles.placeholder]} />;
  }

  // Use 'origin' to send only the domain (e.g. https://www.mangakakalot.gg) as referer
  // This satisfies hotlink protection without sending full path
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
      <meta name="referrer" content="origin">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
          width: 100%; 
          height: 100%; 
          overflow: hidden;
          background: #27272a;
        }
        img { 
          width: 100%; 
          height: 100%; 
          object-fit: cover;
          opacity: 0;
          transition: opacity 0.2s;
        }
        img.loaded {
          opacity: 1;
        }
      </style>
    </head>
    <body>
      <img 
        id="img"
        src="${currentUri}" 
        onload="this.className='loaded'; window.ReactNativeWebView.postMessage('loaded')"
        onerror="window.ReactNativeWebView.postMessage('error')"
      />
    </body>
    </html>
  `;

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const msg = event.nativeEvent.data;
      if (msg === "loaded") {
        setLoaded(true);
      } else if (msg === "error") {
        tryNextCdn();
      }
    },
    [tryNextCdn]
  );

  return (
    <View style={[style, styles.container]}>
      <WebView
        key={currentUri} // Force re-render on URI change
        source={{
          html,
          baseUrl, // Critical: sets the Origin/Referer for the document
        }}
        style={[styles.webview, !loaded && styles.loading]}
        scrollEnabled={false}
        onMessage={handleMessage}
        javaScriptEnabled
        originWhitelist={["*"]}
        cacheEnabled
        cacheMode="LOAD_DEFAULT"
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        domStorageEnabled
        mixedContentMode="always"
        userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loading: {
    opacity: 0,
  },
  placeholder: {
    backgroundColor: "#27272a",
  },
});

export const WebViewImage = memo(WebViewImageComponent);
