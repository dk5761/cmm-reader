/**
 * ReaderPage Component
 *
 * Displays a single manga page image using ExpoImage.
 * Handles loading, error, and ready states.
 */

import { memo, useCallback, useState, useEffect } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
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
  const { width: screenWidth } = useWindowDimensions();
  const [aspectRatio, setAspectRatio] = useState(0.7); // Default manga aspect ratio
  const [isError, setIsError] = useState(false);

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
    },
    [page.imageUrl, page.headers]
  );

  const handleRetry = useCallback(() => {
    setIsError(false);
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
      style={{
        width: screenWidth,
        aspectRatio,
      }}
    />
  );
});
