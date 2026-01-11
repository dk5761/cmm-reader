/**
 * PageItem - Single page in the reader
 * Features:
 * - Dynamic height based on image dimensions
 * - Skeleton placeholder until dimensions known
 * - Dimension caching to avoid re-measuring
 * - Tap to toggle overlay
 */

import React, { memo, useState, useEffect } from "react";
import {
  View,
  Dimensions,
  Image as RNImage,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import type { FlatPage } from "../stores/useReaderStore";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Global dimension cache to persist across re-renders
const dimensionCache = new Map<string, { width: number; height: number }>();

interface PageItemProps {
  page: FlatPage;
  onTap?: () => void;
}

function PageItemComponent({ page, onTap }: PageItemProps) {
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Calculate height from dimensions
  const calculatedHeight = dimensions
    ? SCREEN_WIDTH * (dimensions.height / dimensions.width)
    : SCREEN_HEIGHT * 0.8; // Placeholder height

  // Measure dimensions on mount
  useEffect(() => {
    // Check cache first
    const cached = dimensionCache.get(page.imageUrl);
    if (cached) {
      setDimensions(cached);
      return;
    }

    // Measure image dimensions with headers
    RNImage.getSizeWithHeaders(
      page.imageUrl,
      page.headers || {},
      (width, height) => {
        const dims = { width, height };
        dimensionCache.set(page.imageUrl, dims);
        setDimensions(dims);
      },
      (err) => {
        console.warn(
          `[PageItem] Failed to get size for ${page.imageUrl}:`,
          err
        );
        // Use default aspect ratio on error - still show the image
        const defaultDims = {
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT * 1.4,
        };
        dimensionCache.set(page.imageUrl, defaultDims);
        setDimensions(defaultDims);
      }
    );
  }, [page.imageUrl, page.headers]);

  return (
    <Pressable
      className="bg-black"
      style={{ width: SCREEN_WIDTH, height: calculatedHeight }}
      onPress={onTap}
    >
      {/* Skeleton placeholder */}
      {(!dimensions || !imageLoaded) && !error && (
        <View className="absolute inset-0 bg-zinc-900 items-center justify-center">
          <ActivityIndicator size="large" color="#666" />
        </View>
      )}

      {/* Actual image - use style instead of className for expo-image */}
      {dimensions && (
        <Image
          source={{
            uri: page.imageUrl,
            headers: page.headers,
          }}
          style={styles.image}
          contentFit="fill"
          transition={200}
          onLoad={() => setImageLoaded(true)}
          onError={() => setError(true)}
          recyclingKey={page.key}
        />
      )}

      {/* Error state */}
      {error && (
        <View className="absolute inset-0 bg-zinc-900 items-center justify-center">
          <View className="p-5 bg-zinc-800 rounded-lg">
            <ActivityIndicator size="small" color="#888" />
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    height: "100%",
  },
});

export const PageItem = memo(PageItemComponent);
