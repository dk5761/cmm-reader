/**
 * ReaderPage Component
 *
 * Displays a single manga page image using ExpoImage.
 * Handles loading, error, and ready states.
 * Prevents showing old images from recycled cells during fast scroll.
 */

import { memo, useCallback, useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { ReaderPage as ReaderPageType } from "../types/reader.types";

interface ReaderPageProps {
  page: ReaderPageType;
}

const blurhash = "L6PZfSi_.AyE_3t7t7R*~qo#DgR4";

export const ReaderPage = memo(function ReaderPage({ page }: ReaderPageProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // Use screen aspect ratio as default (matches Mihon's parentHeight approach)
  // This creates a full-screen placeholder to prevent layout shifts during loading
  const [aspectRatio, setAspectRatio] = useState(screenWidth / screenHeight);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Retry counter for cache-busting on retry
  const [retryCount, setRetryCount] = useState(0);

  // Reset loading state when image URL changes (prevents showing old recycled images)
  useEffect(() => {
    setIsLoading(true);
    setIsError(false);
    setRetryCount(0);
    setAspectRatio(screenWidth / screenHeight); // Reset to default while loading
  }, [page.imageUrl, screenWidth, screenHeight]);

  // Build image URI with cache-busting on retry
  const imageUri = useMemo(() => {
    if (retryCount === 0) {
      return page.imageUrl;
    }
    // Add cache-buster query param for retries
    const separator = page.imageUrl.includes("?") ? "&" : "?";
    return `${page.imageUrl}${separator}_retry=${retryCount}`;
  }, [page.imageUrl, retryCount]);

  const handleLoad = useCallback(
    (event: { source: { width: number; height: number } }) => {
      const { width, height } = event.source;
      if (width && height) {
        setAspectRatio(width / height);
      }
      setIsLoading(false);
    },
    []
  );

  const handleError = useCallback(
    (error: any) => {
      console.error(`[ReaderPage] Image load failed:`, {
        url: page.imageUrl,
        error: error?.error || error,
      });
      setIsError(true);
      setIsLoading(false);
    },
    [page.imageUrl]
  );

  // Actual retry mechanism with cache-busting
  const handleRetry = useCallback(() => {
    setIsError(false);
    setIsLoading(true);
    setRetryCount((c) => c + 1);
  }, []);

  if (isError) {
    return (
      <View
        className="w-full items-center justify-center bg-neutral-900"
        style={{ width: screenWidth, aspectRatio }}
      >
        <Ionicons name="image-outline" size={48} color="#6b7280" />
        <Text className="text-neutral-400 text-base mt-4 mb-4">
          Failed to load image
        </Text>
        <Pressable
          onPress={handleRetry}
          className="bg-blue-600 px-6 py-3 rounded-lg flex-row items-center"
        >
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text className="text-white font-medium ml-2">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ width: screenWidth, aspectRatio }}>
      <Image
        source={{
          uri: imageUri,
          headers: page.headers,
        }}
        placeholder={blurhash}
        contentFit="contain"
        transition={200}
        onLoad={handleLoad}
        onError={handleError}
        recyclingKey={`${page.imageUrl}-${retryCount}`} // Force new render on retry
        style={{
          width: screenWidth,
          aspectRatio,
          opacity: isLoading ? 0 : 1, // Hide until loaded
        }}
      />
      {isLoading && (
        <View
          className="absolute inset-0 items-center justify-center bg-neutral-900"
          style={{ width: screenWidth, aspectRatio }}
        >
          <ActivityIndicator color="#3b82f6" size="large" />
        </View>
      )}
    </View>
  );
});
