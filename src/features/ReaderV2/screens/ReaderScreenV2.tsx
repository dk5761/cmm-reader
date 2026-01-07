/**
 * ReaderScreenV2
 *
 * Main entry point for the ReaderV2 feature.
 * Implements Mihon's reader architecture with:
 * - Stage 1: Fast metadata load (chapter structure)
 * - Stage 2: Lazy image loading via FlashList
 * - Stage 3: Background preloading via usePreloaderV2
 * - Stage 4: History persistence and chapter navigation
 */

import { useEffect, useCallback, useMemo } from "react";
import {
  View,
  ActivityIndicator,
  Text,
  StatusBar,
  Pressable,
} from "react-native";
import {
  GestureHandlerRootView,
  TapGestureHandler,
  State,
} from "react-native-gesture-handler";
import { useLocalSearchParams, router } from "expo-router";
import { useReaderStoreV2 } from "../store/useReaderStoreV2";
import { WebtoonViewer } from "../components/WebtoonViewer";
import { ReaderOverlay } from "../components/ReaderOverlay";
import {
  useChapterLoaderV2,
  usePrefetchChapter,
} from "../hooks/useChapterLoaderV2";
import { usePreloaderV2 } from "../hooks/usePreloaderV2";
import { useSaveProgressV2 } from "../hooks/useSaveProgressV2";
import { useKeepAwakeV2 } from "../hooks/useKeepAwakeV2";
import { useChapterList } from "@/features/Manga/api/manga.queries";
import { useGetOrCreateManga, useLibraryMangaById } from "@/features/Library/hooks";
import { Image } from "expo-image";
import type { Chapter, MangaDetails } from "@/sources";

export function ReaderScreenV2() {
  // Keep screen awake while reading
  useKeepAwakeV2();

  // Get navigation params (matching existing route structure)
  const params = useLocalSearchParams();
  const chapterId = params.chapterId as string | undefined;
  const sourceId = params.sourceId as string | undefined;
  const url = params.url as string | undefined; // Chapter URL
  const mangaUrl = params.mangaUrl as string | undefined;
  const mangaId = params.mangaId as string | undefined;
  const mangaTitle = params.mangaTitle as string | undefined;
  const mangaCover = params.mangaCover as string | undefined;
  const chapterNumberParam = params.chapterNumber as string | undefined;
  const chapterTitleParam = params.chapterTitle as string | undefined;

  // Fetch local library data to get lastPageRead
  const libraryId = (sourceId && mangaId) ? `${sourceId}_${mangaId}` : "";
  const libraryManga = useLibraryMangaById(libraryId);

  // Fetch chapters list (same as old reader)
  const { data: chapters, isLoading: chaptersLoading } = useChapterList(
    sourceId ?? "",
    mangaUrl ?? ""
  );

  // Find current chapter from list or create fallback
  const currentChapter = useMemo((): Chapter | null => {
    if (chapters) {
      const found = chapters.find(
        (ch) => ch.url === url || ch.id === chapterId
      );
      if (found) return found;
    }
    // Fallback: create chapter from params
    if (chapterId && url && chapterNumberParam) {
      return {
        id: chapterId,
        mangaId: mangaId ?? "",
        url: url,
        number: parseFloat(chapterNumberParam),
        title: chapterTitleParam,
      };
    }
    return null;
  }, [
    chapters,
    url,
    chapterId,
    mangaId,
    chapterNumberParam,
    chapterTitleParam,
  ]);

  // Find chapter index
  const currentChapterIndex = useMemo(
    () =>
      chapters?.findIndex((ch) => ch.url === url || ch.id === chapterId) ?? -1,
    [chapters, url, chapterId]
  );

  // Auto-track manga for progress (even if not in library)
  const getOrCreateManga = useGetOrCreateManga();
  useEffect(() => {
    if (chapters && chapters.length > 0 && sourceId && mangaId && mangaTitle) {
      // Create minimal manga object for tracking
      const trackingManga: MangaDetails = {
        id: mangaId,
        sourceId,
        title: mangaTitle,
        cover: mangaCover || "",
        url: mangaUrl || "",
      };
      getOrCreateManga(trackingManga, chapters, sourceId);
    }
  }, [
    chapters,
    sourceId,
    mangaId,
    mangaTitle,
    mangaCover,
    mangaUrl,
    getOrCreateManga,
  ]);

  // Store state and actions

  const initialize = useReaderStoreV2((s) => s.initialize);
  const setCurrentChapterData = useReaderStoreV2(
    (s) => s.setCurrentChapterData
  );
  const reset = useReaderStoreV2((s) => s.reset);
  const viewerChapters = useReaderStoreV2((s) => s.viewerChapters);
  const currentPage = useReaderStoreV2((s) => s.currentPage);
  const toggleOverlay = useReaderStoreV2((s) => s.toggleOverlay);
  const allChapters = useReaderStoreV2((s) => s.allChapters);
  const storeChapterIndex = useReaderStoreV2((s) => s.currentChapterIndex);

  // Infinite Scroll Logic
  const setNextChapterLoaded = useReaderStoreV2((s) => s.setNextChapterLoaded);
  const setPrevChapterLoaded = useReaderStoreV2((s) => s.setPrevChapterLoaded);
  const setNextChapterError = useReaderStoreV2((s) => s.setNextChapterError);
  const setPrevChapterError = useReaderStoreV2((s) => s.setPrevChapterError);

  const { fetchChapter } = usePrefetchChapter();

  useEffect(() => {
    if (!viewerChapters || !sourceId) return;

    // Load Next
    const next = viewerChapters.nextChapter;
    if (next && next.state === "loading") {
      console.log("[ReaderScreenV2] 📥 Fetching next chapter:", {
        chapterId: next.chapter.id,
        chapterNumber: next.chapter.number,
        currentPage,
      });

      fetchChapter(sourceId, next.chapter)
        .then((res) => {
          if (res) {
            console.log(
              `[ReaderScreenV2] ✅ Next chapter loaded: ${res.pages.length} pages`,
              {
                chapterId: res.chapter.id,
                chapterNumber: res.chapter.number,
              }
            );
            setNextChapterLoaded(res.pages);
          }
        })
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : "Failed to load chapter";
          console.error("[ReaderScreenV2] ❌ Next chapter load failed:", {
            error: message,
            chapterId: next.chapter.id,
          });
          setNextChapterError(message);
        });
    }

    // Load Prev
    const prev = viewerChapters.prevChapter;
    if (prev && prev.state === "loading") {
      console.log("[ReaderScreenV2] 📥 Fetching previous chapter:", {
        chapterId: prev.chapter.id,
        chapterNumber: prev.chapter.number,
        currentPage,
      });

      fetchChapter(sourceId, prev.chapter)
        .then((res) => {
          if (res) {
            console.log(
              `[ReaderScreenV2] ✅ Previous chapter loaded: ${res.pages.length} pages`,
              {
                chapterId: res.chapter.id,
                chapterNumber: res.chapter.number,
              }
            );
            setPrevChapterLoaded(res.pages);
          }
        })
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : "Failed to load chapter";
          console.error("[ReaderScreenV2] ❌ Previous chapter load failed:", {
            error: message,
            chapterId: prev.chapter.id,
          });
          setPrevChapterError(message);
        });
    }
  }, [
    viewerChapters?.nextChapter?.state,
    viewerChapters?.prevChapter?.state,
    sourceId,
    fetchChapter,
    setNextChapterLoaded,
    setPrevChapterLoaded,
    setNextChapterError,
    setPrevChapterError,
    currentPage,
  ]);

  // Stage 1: Load chapter pages (metadata only)
  const {
    data: loadedChapter,
    isLoading: pagesLoading,
    error,
    refetch,
  } = useChapterLoaderV2(sourceId ?? "", currentChapter, !!currentChapter);

  // Stage 3: Preload upcoming pages
  const pages = viewerChapters?.currChapter.pages ?? [];
  const currentChapterId = viewerChapters?.currChapter.chapter.id;
  const { clearPrefetchCache } = usePreloaderV2(
    pages,
    currentPage,
    currentChapterId
  );

  // Stage 4: Save reading progress
  const progressData = useMemo(
    () =>
      currentChapter && mangaId && sourceId
        ? {
            mangaId,
            mangaTitle: mangaTitle ?? "Unknown",
            mangaCover,
            chapter: currentChapter,
            sourceId,
          }
        : null,
    [currentChapter, mangaId, mangaTitle, mangaCover, sourceId]
  );
  // Stage 4: Save reading progress
  const { save: saveProgress } = useSaveProgressV2(progressData);

  // Initialize store when chapters list is ready
  useEffect(() => {
    if (chapters && chapters.length > 0 && mangaId && sourceId && chapterId) {
      // Find saved progress for this specific chapter if it exists in local DB
      const localChapter = libraryManga?.chapters?.find(c => c.id === chapterId);
      const savedPage = localChapter?.lastPageRead ?? 0;

      initialize({
        mangaId,
        sourceId,
        chapterId,
        chapters,
        initialPage: savedPage,
      });
    }
  }, [chapters?.length, mangaId, sourceId, chapterId, initialize, libraryManga]);

  // Update store when chapter data loads (Stage 1 complete)
  // Only set after store is initialized (storeChapterIndex >= 0)
  useEffect(() => {
    if (loadedChapter) {
      setCurrentChapterData(loadedChapter);
    }
  }, [loadedChapter, setCurrentChapterData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPrefetchCache();
      reset();
      // Clear image memory cache to prevent OOM
      Image.clearMemoryCache();
    };
  }, [clearPrefetchCache, reset]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    router.back();
  }, []);

  // Chapter navigation handlers
  const handlePrevChapter = useCallback(() => {
    const idx =
      storeChapterIndex >= 0 ? storeChapterIndex : currentChapterIndex;
    if (idx >= allChapters.length - 1) return;
    const prevChapter = allChapters[idx + 1];
    if (!prevChapter) return;

    // Force save progress before navigating
    saveProgress(true);

    router.replace({
      pathname: "/reader/[chapterId]",
      params: {
        chapterId: prevChapter.id,
        sourceId: sourceId ?? "",
        url: prevChapter.url,
        mangaUrl: mangaUrl ?? "",
        mangaId: mangaId ?? "",
        mangaTitle: mangaTitle ?? "",
        mangaCover: mangaCover ?? "",
        chapterNumber: prevChapter.number.toString(),
        chapterTitle: prevChapter.title ?? "",
      },
    });
  }, [
    storeChapterIndex,
    currentChapterIndex,
    allChapters,
    sourceId,
    mangaUrl,
    mangaId,
    mangaTitle,
    mangaCover,
    saveProgress,
  ]);

  const handleNextChapter = useCallback(() => {
    const idx =
      storeChapterIndex >= 0 ? storeChapterIndex : currentChapterIndex;
    if (idx <= 0) return;
    const nextChapter = allChapters[idx - 1];
    if (!nextChapter) return;

    // Force save progress before navigating
    saveProgress(true);

    router.replace({
      pathname: "/reader/[chapterId]",
      params: {
        chapterId: nextChapter.id,
        sourceId: sourceId ?? "",
        url: nextChapter.url,
        mangaUrl: mangaUrl ?? "",
        mangaId: mangaId ?? "",
        mangaTitle: mangaTitle ?? "",
        mangaCover: mangaCover ?? "",
        chapterNumber: nextChapter.number.toString(),
        chapterTitle: nextChapter.title ?? "",
      },
    });
  }, [
    storeChapterIndex,
    currentChapterIndex,
    allChapters,
    sourceId,
    mangaUrl,
    mangaId,
    mangaTitle,
    mangaCover,
    saveProgress,
  ]);

  // Determine loading state
  const isLoading = chaptersLoading || pagesLoading;

  // Missing required params
  if (!chapterId || !sourceId || !url) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-4">
        <StatusBar hidden />
        <Text className="text-red-500 text-lg mb-2">Missing Parameters</Text>
        <Text className="text-white text-center mb-4">
          Required: chapterId, sourceId, url
        </Text>
        <Pressable
          onPress={handleBack}
          className="bg-blue-600 px-6 py-3 rounded-lg"
        >
          <Text className="text-white font-medium">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <StatusBar hidden />
        <ActivityIndicator color="#3b82f6" size="large" />
        <Text className="text-white mt-4">Loading chapter...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-4">
        <StatusBar hidden />
        <Text className="text-red-500 text-lg mb-2">Failed to load</Text>
        <Text className="text-white text-center mb-4">
          {error instanceof Error ? error.message : "Unknown error"}
        </Text>
        <View className="flex-row gap-4">
          <Pressable
            onPress={handleBack}
            className="bg-neutral-700 px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-medium">Go Back</Text>
          </Pressable>
          <Pressable
            onPress={() => refetch()}
            className="bg-blue-600 px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-medium">Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Not initialized yet
  if (!viewerChapters) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <StatusBar hidden />
        <ActivityIndicator color="#3b82f6" size="small" />
        <Text className="text-neutral-500 mt-2">Initializing...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView className="flex-1 bg-black">
      <StatusBar hidden />

      {/* Main reader content */}
      <TapGestureHandler onActivated={toggleOverlay}>
        <View className="flex-1">
          <WebtoonViewer />
        </View>
      </TapGestureHandler>

      {/* Reader controls overlay */}
      <ReaderOverlay
        chapter={currentChapter}
        onPrevChapter={handlePrevChapter}
        onNextChapter={handleNextChapter}
      />
    </GestureHandlerRootView>
  );
}
