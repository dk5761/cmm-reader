import { useState, useEffect, memo } from "react";
import { View, Image as RNImage, ActivityIndicator } from "react-native";

type ProxiedImageProps = {
  uri: string;
  headers?: Record<string, string>;
  style?: object;
  contentFit?: "cover" | "contain" | "fill";
  className?: string;
};

/**
 * Custom image component that fetches images with proper headers
 * Works around Glide's limitation of not forwarding custom headers on Android
 */
function ProxiedImageComponent({
  uri,
  headers,
  style,
  contentFit = "cover",
  className,
}: ProxiedImageProps) {
  const [imageData, setImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!uri) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchImage() {
      try {
        setLoading(true);
        setError(false);

        const response = await fetch(uri, {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            Referer: new URL(uri).origin + "/",
            Accept: "image/webp,image/png,image/*,*/*;q=0.8",
            ...headers,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();

        // Convert blob to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("Failed to read blob"));
            }
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(blob);

        const base64 = await base64Promise;

        if (!cancelled) {
          setImageData(base64);
          setLoading(false);
        }
      } catch (e) {
        console.log("[ProxiedImage] Error loading:", uri, e);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    fetchImage();

    return () => {
      cancelled = true;
    };
  }, [uri, headers]);

  if (loading) {
    return (
      <View
        className={className}
        style={[style, { justifyContent: "center", alignItems: "center" }]}
      >
        <ActivityIndicator size="small" color="#888" />
      </View>
    );
  }

  if (error || !imageData) {
    return (
      <View
        className={className}
        style={[style, { backgroundColor: "#27272a" }]}
      />
    );
  }

  return (
    <RNImage
      source={{ uri: imageData }}
      style={style}
      resizeMode={contentFit === "fill" ? "stretch" : contentFit}
    />
  );
}

export const ProxiedImage = memo(ProxiedImageComponent);
