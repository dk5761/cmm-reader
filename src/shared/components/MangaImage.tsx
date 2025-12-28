import { useState, useCallback, memo, useEffect, useRef } from "react";
import { View, ActivityIndicator, StyleSheet, Dimensions } from "react-native";
import FastImage, { FastImageProps } from "react-native-fast-image";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// CDN fallback list for 2xstorage
const CDN_HOSTS = [
  "imgs-2.2xstorage.com",
  "img-r1.2xstorage.com",
  "imgs.2xstorage.com",
  "img.2xstorage.com",
];

type MangaImageProps = {
  uri: string;
  headers?: Record<string, string>;
  style?: FastImageProps["style"];
  resizeMode?: "contain" | "cover" | "stretch" | "center";
  priority?: "low" | "normal" | "high";
  onLoad?: () => void;
  onError?: () => void;
  onProgress?: (event: {
    nativeEvent: { loaded: number; total: number };
  }) => void;
};

/**
 * Unified image component using react-native-fast-image.
 * Replaces ProxiedImage and WebViewImage with native performance.
 *
 * Features:
 * - Native SDWebImage (iOS) / Glide (Android)
 * - CDN fallback for 2xstorage hosts
 * - Custom headers support
 * - Priority-based loading
 * - Efficient caching
 */
function MangaImageComponent({
  uri,
  headers,
  style,
  resizeMode = "contain",
  priority = "high",
  onLoad,
  onError,
  onProgress,
}: MangaImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentUri, setCurrentUri] = useState(uri);
  const [aspectRatio, setAspectRatio] = useState<number | undefined>(undefined);
  const cdnIndexRef = useRef(0);
  const originalHostRef = useRef<string | null>(null);

  // Reset state when URI changes
  useEffect(() => {
    setLoading(true);
    setError(false);
    setCurrentUri(uri);
    setAspectRatio(undefined);
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

      // Only try fallbacks for 2xstorage CDN
      if (!url.host.includes("2xstorage.com")) {
        return;
      }

      cdnIndexRef.current++;

      // Get list of CDNs to try (excluding the original host)
      const cdnsToTry = CDN_HOSTS.filter((h) => h !== originalHostRef.current);

      if (cdnIndexRef.current <= cdnsToTry.length) {
        const nextCdn = cdnsToTry[cdnIndexRef.current - 1];
        url.host = nextCdn;
        const newUri = url.toString();
        console.log(`[MangaImage] Trying CDN fallback: ${nextCdn}`);
        setCurrentUri(newUri);
        setLoading(true);
        setError(false);
      } else {
        // All CDNs exhausted
        setError(true);
        setLoading(false);
      }
    } catch (e) {
      setError(true);
      setLoading(false);
    }
  }, [uri]);

  const handleLoad = useCallback(
    (event: any) => {
      // Get image dimensions from load event
      const { width, height } = event.nativeEvent;
      if (width && height) {
        setAspectRatio(width / height);
      }
      setLoading(false);
      setError(false);
      onLoad?.();
    },
    [onLoad]
  );

  const handleError = useCallback(() => {
    console.log(`[MangaImage] Error loading: ${currentUri}`);

    // Try CDN fallback
    if (cdnIndexRef.current === 0) {
      tryNextCdn();
    } else {
      setError(true);
      setLoading(false);
      onError?.();
    }
  }, [currentUri, tryNextCdn, onError]);

  if (!uri) {
    return <View style={[styles.placeholder, style]} />;
  }

  // Map priority to FastImage priority enum
  const fastImagePriority =
    priority === "high"
      ? FastImage.priority.high
      : priority === "low"
      ? FastImage.priority.low
      : FastImage.priority.normal;

  // Map resizeMode to FastImage resizeMode enum
  const fastImageResizeMode =
    resizeMode === "contain"
      ? FastImage.resizeMode.contain
      : resizeMode === "cover"
      ? FastImage.resizeMode.cover
      : resizeMode === "stretch"
      ? FastImage.resizeMode.stretch
      : FastImage.resizeMode.center;

  // Use aspect ratio if available, otherwise use default minHeight
  const imageStyle = aspectRatio
    ? [styles.image, { aspectRatio }]
    : [styles.image, styles.imagePlaceholderSize];

  return (
    <View style={[styles.container, style]}>
      {!error && (
        <FastImage
          style={imageStyle}
          source={{
            uri: currentUri,
            headers: headers,
            priority: fastImagePriority,
            cache: FastImage.cacheControl.immutable,
          }}
          resizeMode={fastImageResizeMode}
          onLoad={handleLoad}
          onError={handleError}
          onProgress={onProgress}
        />
      )}

      {loading && !error && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#888" />
        </View>
      )}

      {error && <View style={styles.errorPlaceholder} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    backgroundColor: "#000",
  },
  image: {
    width: SCREEN_WIDTH,
  },
  imagePlaceholderSize: {
    minHeight: 600,
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    minHeight: 300,
  },
  placeholder: {
    backgroundColor: "#27272a",
  },
  errorPlaceholder: {
    width: SCREEN_WIDTH,
    height: 400,
    backgroundColor: "#27272a",
  },
});

export const MangaImage = memo(MangaImageComponent);
