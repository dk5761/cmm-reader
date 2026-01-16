/**
 * PageItem - Single page in the reader
 * Features:
 * - Dynamic height based on image dimensions
 * - Skeleton placeholder until dimensions known
 * - Dimension caching to avoid re-measuring
 * - Tap to toggle overlay
 * - Chapter divider for first page of new chapters
 */

import React, { memo, useState, useEffect } from "react";
import {
  View,
  Dimensions,
  Image as RNImage,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { Image } from "expo-image";
import type { FlatPage } from "../stores/useReaderStore";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Global dimension cache to persist across re-renders
const dimensionCache = new Map<string, { width: number; height: number }>();

interface PageItemProps {
  page: FlatPage;
  onTap?: () => void;
  showChapterDivider?: boolean;
}

function PageItemComponent({ page, onTap, showChapterDivider }: PageItemProps) {
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [layoutHeight, setLayoutHeight] = useState<number | null>(null);
  const [measurementFailed, setMeasurementFailed] = useState(false);

  // Calculate height from dimensions with fallback
  const calculatedHeight = layoutHeight
    ? layoutHeight
    : dimensions
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
        setMeasurementFailed(false);
      },
      (err) => {
        console.warn(
          `[PageItem] Failed to get size for ${page.imageUrl}:`,
          err
        );
        // Don't set default dimensions - wait for onLayout to get actual rendered dimensions
        setMeasurementFailed(true);
      }
    );
  }, [page.imageUrl, page.headers]);

  return (
    <View>
      {/* Chapter Divider */}
      {showChapterDivider && (
        <View className="bg-zinc-900 py-6 items-center justify-center border-t border-b border-zinc-700">
          <Text className="text-zinc-400 text-xs uppercase tracking-wider mb-1">
            Chapter {page.chapterNumber}
          </Text>
          {page.chapterTitle && (
            <Text
              className="text-white text-base font-semibold text-center px-4"
              numberOfLines={2}
            >
              {page.chapterTitle}
            </Text>
          )}
        </View>
      )}

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

        {/* Actual image - only show after dimensions loaded to prevent stretching */}
        {(dimensions || measurementFailed) && (
          <Image
            source={{
              uri: page.imageUrl,
              headers: page.headers,
            }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            onLoad={() => {
              setImageLoaded(true);
              setMeasurementFailed(false);
            }}
            onError={() => setError(true)}
            recyclingKey={page.key}
            onLayout={(e) => {
              if (measurementFailed || !dimensions) {
                const { height } = e.nativeEvent.layout;
                setLayoutHeight(height);
                // Cache layout-based dimensions for future use
                if (!dimensions) {
                  dimensionCache.set(page.imageUrl, {
                    width: SCREEN_WIDTH,
                    height,
                  });
                }
              }
            }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    height: "100%",
  },
});

export const PageItem = memo(PageItemComponent);
