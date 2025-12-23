import { useState, useCallback, memo, useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

const SCREEN_WIDTH = Dimensions.get("window").width;

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
  resizeMode?: "cover" | "contain" | "fill";
  width?: number;
  onHeightChange?: (height: number) => void;
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
  resizeMode = "contain",
  width = SCREEN_WIDTH,
  onHeightChange,
}: WebViewImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [currentUri, setCurrentUri] = useState(uri);
  const [dynamicHeight, setDynamicHeight] = useState<number | null>(null);
  const cdnIndexRef = useRef(0);
  const originalHostRef = useRef<string | null>(null);

  useEffect(() => {
    if (!uri) return;

    setLoaded(false);
    setCurrentUri(uri);
    setDynamicHeight(null);
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
        setCurrentUri(newUri);
      }
    } catch (e) {
      // Ignore fallback errors
    }
  }, [uri]);

  if (!uri) {
    return <View style={[style, styles.placeholder]} />;
  }

  // Ensure baseUrl has trailing slash for unsafe-url policy to send it
  const effectiveBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  // For 'fill' mode, we want width 100% and height to auto-adjust
  const imgStyle =
    resizeMode === "fill"
      ? "width: 100%; height: auto; display: block;"
      : `width: 100%; height: 100%; object-fit: ${resizeMode};`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
      <meta name="referrer" content="unsafe-url">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
          width: 100%; 
          height: 100%; 
          overflow: hidden;
          background: #000;
        }
        img { 
          ${imgStyle}
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
        onload="
          this.className='loaded';
          var w = this.naturalWidth;
          var h = this.naturalHeight;
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'loaded', width:w, height:h}));
        "
        onerror="window.ReactNativeWebView.postMessage(JSON.stringify({type:'error'}))"
      />
    </body>
    </html>
  `;

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "loaded") {
          setLoaded(true);
          // Calculate height based on image aspect ratio and container width
          if (data.width && data.height && resizeMode === "fill") {
            const aspectRatio = data.height / data.width;
            const calculatedHeight = width * aspectRatio;
            setDynamicHeight(calculatedHeight);
            onHeightChange?.(calculatedHeight);
          }
        } else if (data.type === "error") {
          tryNextCdn();
        }
      } catch {
        // Fallback for old format
        const msg = event.nativeEvent.data;
        if (msg === "loaded") {
          setLoaded(true);
        } else if (msg === "error") {
          tryNextCdn();
        }
      }
    },
    [tryNextCdn, width, resizeMode, onHeightChange]
  );

  // Use dynamic height if available and in fill mode
  const containerHeight =
    resizeMode === "fill" && dynamicHeight ? dynamicHeight : undefined;

  return (
    <View
      style={[
        style,
        styles.container,
        containerHeight ? { height: containerHeight } : {},
      ]}
    >
      <WebView
        key={currentUri} // Force re-render on URI change
        source={{
          html,
          baseUrl: effectiveBaseUrl, // Sets the "page" URL to include trailing slash
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
