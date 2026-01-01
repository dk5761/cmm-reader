/**
 * ReaderPage Component
 *
 * Displays a single manga page image using ExpoImage.
 * Handles loading, error, and ready states.
 * Prevents showing old images from recycled cells during fast scroll.
 */

import { memo, useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import type { ReaderPage as ReaderPageType } from "../types/reader.types";

interface ReaderPageProps {
  page: ReaderPageType;
  onRetry?: () => void;
}

const blurhash = "L6PZfSi_.AyE_3t7t7R*~qo#DgR4";

export const ReaderPage = memo(function ReaderPage({
  page,
  onRetry,
}: ReaderPageProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // Use screen aspect ratio as default (matches Mihon's parentHeight approach)
  // This creates a full-screen placeholder to prevent layout shifts during loading
  const [aspectRatio, setAspectRatio] = useState(screenWidth / screenHeight);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Reset loading state when image URL changes (prevents showing old recycled images)
  useEffect(() => {
    setIsLoading(true);
    setIsError(false);
    setAspectRatio(screenWidth / screenHeight); // Reset to default while loading
  }, [page.imageUrl, screenWidth, screenHeight]);

  useEffect(() => {
    console.log(`[ReaderPage] Rendering page:`, {
      imageUrl: page.imageUrl,
      hasHeaders: !!page.headers,
      headerKeys: Object.keys(page.headers || {}),
    });
  }, [page.imageUrl, page.headers]);

  const handleLoad = useCallback(
    (event: { source: { width: number; height: number } }) => {
      const { width, height } = event.source;
      console.log(`[ReaderPage] Image loaded successfully:`, {
        url: page.imageUrl,
        dimensions: `${width}x${height}`,
        aspectRatio: width / height,
      });
      if (width && height) {
        setAspectRatio(width / height);
      }
      setIsLoading(false);
    },
    [page.imageUrl]
  );

  const handleError = useCallback(
    (error: any) => {
      console.error(`[ReaderPage] Image load failed:`, {
        url: page.imageUrl,
        headers: page.headers,
        error: error?.error || error,
      });
      setIsError(true);
      setIsLoading(false);
    },
    [page.imageUrl, page.headers]
  );

  const handleRetry = useCallback(() => {
    setIsError(false);
    setIsLoading(true);
    onRetry?.();
  }, [onRetry]);

  if (isError) {
    return (
      <View
        className="w-full items-center justify-center bg-neutral-900"
        style={{ width: screenWidth, aspectRatio }}
      >
        <Text className="text-white text-base mb-4">Failed to load image</Text>
        <Pressable
          onPress={handleRetry}
          className="bg-blue-600 px-6 py-3 rounded-lg"
        >
          <Text className="text-white font-medium">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ width: screenWidth, aspectRatio }}>
      <Image
        source={{
          uri: page.imageUrl,
          headers: page.headers,
        }}
        placeholder={blurhash}
        contentFit="contain"
        transition={200}
        onLoad={handleLoad}
        onError={handleError}
        recyclingKey={page.imageUrl} // Force new render when URL changes
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
