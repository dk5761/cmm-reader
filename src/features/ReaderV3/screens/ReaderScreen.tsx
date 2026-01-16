/**
 * ReaderScreen - Main screen for manga reading
 * Features:
 * - FlashList for virtualized page rendering
 * - Tap to toggle overlay
 * - Infinite scroll (load next chapter at end)
 * - 60% visibility threshold for page tracking
 * - Preloading of next 4 pages
 */

import React, { useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  Dimensions,
  ActivityIndicator,
  Text,
  Pressable,
} from "react-native";
import { FlashList, FlashListRef } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useReaderStore, FlatPage } from "../stores/useReaderStore";
import { PageItem, ReaderOverlay } from "../components";
import { usePagePreloader } from "../hooks";
import { useMangaData } from "@/features/Manga/hooks";
import {
  useMarkChapterRead,
  useSaveProgress,
  useAddHistoryEntry,
} from "@/features/Library/hooks";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export function ReaderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    chapterId: string;
    url: string; // This is the chapterUrl
    sourceId: string;
    mangaId: string;
    mangaUrl: string;
    mangaTitle: string;
    initialPage: string; // Last read page (0-based index)
  }>();

  const flashListRef = useRef<FlashListRef<FlatPage>>(null);

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
    hideOverlay,
    loadNextChapter,
    reset,
  } = useReaderStore();

  // Get chapter list for manga
  const { displayChapters } = useMangaData({
    id: params.mangaId || "",
    sourceId: params.sourceId || "",
    url: params.mangaUrl || "",
  });

  // Mark chapter as read
  const markChapterRead = useMarkChapterRead();

  // Save reading progress
  const saveProgressToRealm = useSaveProgress();

  // Add to history
  const addHistoryEntry = useAddHistoryEntry();

  // Preload next pages
  usePagePreloader(flatPages, currentFlatIndex);

  // Initialize reader on mount
  useEffect(() => {
    console.log("[ReaderV3] Init check:", {
      chapterId: params.chapterId,
      url: params.url,
      sourceId: params.sourceId,
      mangaId: params.mangaId,
      displayChaptersLen: displayChapters.length,
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

  // Calculate initial scroll index from route params (only use on first render)
  const initialScrollIndex = useMemo(() => {
    const initialPage = parseInt(params.initialPage || "0", 10);
    console.log("[ReaderV3] Initial scroll index:", initialPage);
    return initialPage > 0 ? initialPage : undefined;
  }, []); // Empty deps - only calculate once on mount

  // Refs for cleanup - to avoid stale closures in useEffect
  const flatPagesRef = useRef(flatPages);
  const currentFlatIndexRef = useRef(currentFlatIndex);
  flatPagesRef.current = flatPages;
  currentFlatIndexRef.current = currentFlatIndex;

  // Save progress on unmount
  useEffect(() => {
    return () => {
      const pages = flatPagesRef.current;
      const index = currentFlatIndexRef.current;
      const currentPage = pages[index];

      if (currentPage && params.mangaId) {
        console.log("[ReaderV3 Unmount] Saving progress and history", {
          mangaId: params.mangaId,
          chapterId: currentPage.chapterId,
          chapterNumber: currentPage.chapterNumber,
          pageIndex: currentPage.pageIndex,
        });

        // Save last page read (0-based index)
        saveProgressToRealm(
          params.mangaId,
          currentPage.chapterId,
          currentPage.chapterNumber,
          currentPage.pageIndex
        );

        // Add to reading history
        addHistoryEntry({
          mangaId: params.mangaId,
          mangaTitle: params.mangaTitle || "Unknown",
          mangaCover: undefined, // Will be fetched from manga data if needed
          mangaUrl: params.mangaUrl,
          chapterId: currentPage.chapterId,
          chapterNumber: currentPage.chapterNumber,
          chapterTitle: currentPage.chapterTitle,
          chapterUrl: params.url, // Use initial chapter URL from params
          pageReached: currentPage.pageIndex,
          totalPages: currentPage.totalPagesInChapter,
          sourceId: params.sourceId,
        });

        console.log("[ReaderV3 Unmount] History entry added");
      }

      // Reset store
      reset();
    };
  }, [
    params.mangaId,
    params.mangaTitle,
    params.mangaUrl,
    params.sourceId,
    saveProgressToRealm,
    addHistoryEntry,
    reset,
  ]);

  // Track scroll to update current page index
  // Use ref to avoid stale closure in callback
  const setCurrentFlatIndexRef = useRef(setCurrentFlatIndex);
  setCurrentFlatIndexRef.current = setCurrentFlatIndex;

  // Track last reported index to avoid unnecessary updates
  const lastReportedIndexRef = useRef(0);

  // Track chapters that have been marked as read (to avoid duplicate calls)
  const markedChaptersRef = useRef<Set<string>>(new Set());

  // Refs for marking chapter as read
  const flatPagesForScrollRef = useRef(flatPages);
  const markChapterReadRef = useRef(markChapterRead);
  flatPagesForScrollRef.current = flatPages;
  markChapterReadRef.current = markChapterRead;

  // onScroll handler - use FlashList's getFirstVisibleIndex for accurate tracking
  const handleScroll = useCallback(() => {
    if (!flashListRef.current) return;

    // Use FlashList's built-in method to get accurate first visible index
    const firstVisibleIndex = flashListRef.current.getFirstVisibleIndex();

    if (
      firstVisibleIndex !== null &&
      firstVisibleIndex !== lastReportedIndexRef.current
    ) {
      lastReportedIndexRef.current = firstVisibleIndex;
      setCurrentFlatIndexRef.current(firstVisibleIndex);

      // Check if user reached last page of a chapter - mark as read
      const currentPage = flatPagesForScrollRef.current[firstVisibleIndex];
      if (currentPage && params.mangaId) {
        const isLastPage =
          currentPage.pageIndex === currentPage.totalPagesInChapter - 1;
        const alreadyMarked = markedChaptersRef.current.has(
          currentPage.chapterId
        );

        if (isLastPage && !alreadyMarked) {
          console.log(
            "[ReaderV3] Reached last page, marking chapter as read:",
            currentPage.chapterId
          );
          markedChaptersRef.current.add(currentPage.chapterId);
          markChapterReadRef.current(params.mangaId, currentPage.chapterId);
        }
      }
    }
  }, [params.mangaId]);

  // Render page item
  const renderItem = useCallback(
    ({ item }: { item: FlatPage }) => {
      // Show chapter divider on first page of each chapter (but not the very first page)
      const showChapterDivider = item.pageIndex === 0 && item.flatIndex > 0;
      return (
        <PageItem
          page={item}
          onTap={toggleOverlay}
          showChapterDivider={showChapterDivider}
        />
      );
    },
    [toggleOverlay]
  );

  // Key extractor
  const keyExtractor = useCallback((item: FlatPage) => item.key, []);

  // Handle tap to toggle overlay
  const handleTap = useCallback(() => {
    toggleOverlay();
  }, [toggleOverlay]);

  // Loading state
  if (isLoadingChapter && flatPages.length === 0) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#fff" />
        <Text className="text-zinc-400 mt-4 text-sm">Loading chapter...</Text>
      </View>
    );
  }

  // Error state
  if (error && flatPages.length === 0) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <StatusBar style="light" />
        <Text className="text-red-400 text-base text-center mx-8 mb-4">
          {error}
        </Text>
        <Pressable
          className="px-6 py-3 bg-zinc-800 rounded-lg"
          onPress={() => router.back()}
        >
          <Text className="text-white text-sm font-semibold">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" hidden={!isOverlayVisible} />

      {/* FlashList - no Pressable wrapper */}
      <FlashList
        ref={flashListRef}
        data={flatPages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // estimatedItemSize={SCREEN_HEIGHT}

        initialScrollIndex={initialScrollIndex}
        onEndReached={loadNextChapter}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={hideOverlay}
        onScroll={handleScroll}
        scrollEventThrottle={100}
      />

      {/* Overlay */}
      <ReaderOverlay
        flashListRef={flashListRef}
        mangaTitle={params.mangaTitle || ""}
      />

      {/* Loading indicator for next chapter */}
      {isLoadingChapter && flatPages.length > 0 && (
        <View className="absolute bottom-24 self-center bg-black/70 p-3 rounded-full">
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}
    </View>
  );
}
