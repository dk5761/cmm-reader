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
  StyleSheet,
  Image as RNImage,
  ActivityIndicator,
  Pressable,
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

    // Measure image dimensions
    RNImage.getSize(
      page.imageUrl,
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
        // Use default aspect ratio on error
        const defaultDims = {
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT * 0.8,
        };
        dimensionCache.set(page.imageUrl, defaultDims);
        setDimensions(defaultDims);
      }
    );
  }, [page.imageUrl]);

  return (
    <Pressable
      style={[styles.container, { height: calculatedHeight }]}
      onPress={onTap}
    >
      {/* Skeleton placeholder */}
      {(!dimensions || !imageLoaded) && !error && (
        <View style={styles.placeholder}>
          <ActivityIndicator size="large" color="#666" />
        </View>
      )}

      {/* Actual image */}
      {dimensions && (
        <Image
          source={{
            uri: page.imageUrl,
            headers: page.headers,
          }}
          style={styles.image}
          contentFit="contain"
          transition={200}
          onLoad={() => setImageLoaded(true)}
          onError={() => setError(true)}
          recyclingKey={page.key}
        />
      )}

      {/* Error state */}
      {error && (
        <View style={styles.errorContainer}>
          <View style={styles.errorBox}>
            <ActivityIndicator size="small" color="#888" />
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    backgroundColor: "#000",
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  errorBox: {
    padding: 20,
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
  },
});

export const PageItem = memo(PageItemComponent);
