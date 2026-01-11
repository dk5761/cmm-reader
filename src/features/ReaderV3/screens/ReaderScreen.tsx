/**
 * ReaderScreen - Main screen for manga reading
 * Features:
 * - FlashList for virtualized page rendering
 * - Tap to toggle overlay
 * - Infinite scroll (load next chapter at end)
 * - 60% visibility threshold for page tracking
 * - Preloading of next 4 pages
 */

import React, { useCallback, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Pressable,
  ActivityIndicator,
  Text,
} from "react-native";
import { FlashList, ViewToken } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useReaderStore, FlatPage } from "../stores/useReaderStore";
import { PageItem, ReaderOverlay } from "../components";
import { usePagePreloader } from "../hooks";
import { useMangaData } from "@/features/Manga/hooks";
import { useMarkChapterRead } from "@/features/Library/hooks";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export function ReaderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    chapterId: string;
    url: string; // This is the chapterUrl
    sourceId: string;
    mangaId: string;
    mangaUrl: string;
  }>();

  // Debug: Log params
  console.log("[ReaderV3] Params received:", {
    chapterId: params.chapterId,
    url: params.url,
    sourceId: params.sourceId,
    mangaId: params.mangaId,
    mangaUrl: params.mangaUrl,
  });

  const flashListRef = useRef<FlashList<FlatPage>>(null);

  // Store state
  const {
    flatPages,
    currentFlatIndex,
    isLoadingChapter,
    isOverlayVisible,
    error,
    initReader,
    setCurrentFlatIndex,
    toggleOverlay,
    loadNextChapter,
    saveProgress,
    reset,
  } = useReaderStore();

  // Get chapter list for manga
  const { displayChapters } = useMangaData({
    id: params.mangaId || "",
    sourceId: params.sourceId || "",
    url: params.mangaUrl || "",
  });

  // Debug: Log chapters
  console.log("[ReaderV3] Display chapters count:", displayChapters.length);

  // Mark chapter as read
  const markChapterRead = useMarkChapterRead();

  // Preload next pages
  usePagePreloader(flatPages, currentFlatIndex);

  // Initialize reader on mount
  useEffect(() => {
    console.log("[ReaderV3] Init check:", {
      chapterId: params.chapterId,
      url: params.url,
      sourceId: params.sourceId,
      mangaId: params.mangaId,
      chaptersLen: displayChapters.length,
    });

    if (
      params.chapterId &&
      params.url &&
      params.sourceId &&
      params.mangaId &&
      displayChapters.length > 0
    ) {
      console.log("[ReaderV3] Initializing reader...");
      initReader({
        chapterId: params.chapterId,
        chapterUrl: params.url, // Use url param as chapterUrl
        sourceId: params.sourceId,
        mangaId: params.mangaId,
        mangaUrl: params.mangaUrl || "",
        allChapters: displayChapters.map((ch) => ({
          id: ch.id,
          mangaId: ch.mangaId,
          number: ch.number,
          title: ch.title,
          url: ch.url,
        })),
      });
    }
  }, [
    params.chapterId,
    params.url,
    params.sourceId,
    params.mangaId,
    params.mangaUrl,
    displayChapters.length,
  ]);

  // Save progress on unmount
  useEffect(() => {
    return () => {
      // Save progress
      saveProgress();

      // Mark current chapter as read
      const currentPage = flatPages[currentFlatIndex];
      if (currentPage && params.mangaId) {
        markChapterRead(params.mangaId, currentPage.chapterId);
      }

      // Reset store
      reset();
    };
  }, []);

  // Viewability config for 60% threshold
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 100,
  }).current;

  // Handle viewable items change
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentFlatIndex(viewableItems[0].index);
      }
    },
    [setCurrentFlatIndex]
  );

  // Stable ref for onViewableItemsChanged
  const viewabilityConfigCallbackPairs = useRef([
    { viewabilityConfig, onViewableItemsChanged },
  ]);

  // Render page item
  const renderItem = useCallback(({ item }: { item: FlatPage }) => {
    return <PageItem page={item} />;
  }, []);

  // Key extractor
  const keyExtractor = useCallback((item: FlatPage) => item.key, []);

  // Handle tap to toggle overlay
  const handleTap = useCallback(() => {
    toggleOverlay();
  }, [toggleOverlay]);

  // Loading state
  if (isLoadingChapter && flatPages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading chapter...</Text>
      </View>
    );
  }

  // Error state
  if (error && flatPages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden={!isOverlayVisible} />

      {/* FlashList - no Pressable wrapper */}
      <FlashList
        ref={flashListRef}
        data={flatPages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={SCREEN_HEIGHT}
        onEndReached={loadNextChapter}
        onEndReachedThreshold={0.5}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
        showsVerticalScrollIndicator={false}
      />

      {/* Tap zones for toggle overlay - on left and right edges */}
      <Pressable
        style={styles.tapZoneLeft}
        onPress={() => {
          console.log("[ReaderScreen] Left tap zone pressed");
          toggleOverlay();
        }}
      />
      <Pressable
        style={styles.tapZoneRight}
        onPress={() => {
          console.log("[ReaderScreen] Right tap zone pressed");
          toggleOverlay();
        }}
      />

      {/* Overlay */}
      <ReaderOverlay flashListRef={flashListRef} />

      {/* Loading indicator for next chapter */}
      {isLoadingChapter && flatPages.length > 0 && (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#aaa",
    marginTop: 16,
    fontSize: 14,
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 16,
    textAlign: "center",
    marginHorizontal: 32,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#333",
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  loadingMore: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 12,
    borderRadius: 20,
  },
  tapZoneLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 60,
    // backgroundColor: "rgba(255, 0, 0, 0.2)", // Debug: uncomment to see zone
  },
  tapZoneRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 60,
    // backgroundColor: "rgba(0, 255, 0, 0.2)", // Debug: uncomment to see zone
  },
});
