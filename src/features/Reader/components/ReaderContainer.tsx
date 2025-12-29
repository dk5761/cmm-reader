import { useEffect, useRef, useCallback } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useChapterPages } from "../api/reader.queries";
import { useChapterList } from "../../Manga/api/manga.queries";
import { getSource } from "@/sources";
import { useReaderStore } from "../store/useReaderStore";
import { ReaderView } from "./ReaderView";
import { useSaveHistory } from "../hooks/useSaveHistory";
import { useReaderKeepAwake } from "../hooks/useReaderKeepAwake";
import { useMarkChapterRead } from "@/features/Library/hooks";
import type { ChapterSegment } from "../types";

/**
 * Back button overlay for loading/error states
 */
function BackButtonOverlay() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="absolute top-0 left-0 right-0 z-10"
    >
      <Pressable
        onPress={() => router.back()}
        className="flex-row items-center px-4 py-3"
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
        <Text className="text-white ml-2 text-base font-medium">Back</Text>
      </Pressable>
    </View>
  );
}

/**
 * ReaderContainer - Data fetching, store initialization, and history saving.
 */
export function ReaderContainer() {
  // Keep screen awake during reading
  useReaderKeepAwake();

  const router = useRouter();
  const {
    chapterId,
    sourceId,
    url,
    mangaUrl,
    mangaId,
    mangaTitle,
    mangaCover,
    chapterNumber: chapterNumberParam,
    chapterTitle: chapterTitleParam,
  } = useLocalSearchParams<{
    chapterId: string;
    sourceId: string;
    url: string;
    mangaUrl: string;
    mangaId?: string;
    mangaTitle?: string;
    mangaCover?: string;
    chapterNumber?: string;
    chapterTitle?: string;
  }>();

  // Data fetching
  const source = getSource(sourceId || "");

  console.log("[ReaderContainer] Params:", {
    chapterId,
    sourceId,
    url,
    mangaUrl,
    mangaId,
    chapterNumberParam,
    chapterTitleParam,
  });

  const {
    data: pages,
    isLoading: pagesLoading,
    error: pagesError,
  } = useChapterPages(sourceId || "", url || "");

  const { data: chapters } = useChapterList(sourceId || "", mangaUrl || "");

  // Find current chapter or create fallback from params
  const currentChapter =
    chapters?.find((ch) => ch.url === url) ??
    (chapterNumberParam
      ? {
          id: chapterId || "",
          mangaId: mangaId || "",
          url: url || "",
          number: parseFloat(chapterNumberParam),
          title: chapterTitleParam,
        }
      : undefined);

  console.log("[ReaderContainer] Chapter resolution:", {
    hasChaptersList: !!chapters,
    chaptersCount: chapters?.length,
    currentChapter: currentChapter
      ? {
          id: currentChapter.id,
          number: currentChapter.number,
          title: currentChapter.title,
        }
      : null,
    usingFallback: !chapters?.find((ch) => ch.url === url),
  });

  const chapterNumber =
    currentChapter?.number || parseFloat(chapterNumberParam || "0") || 0;
  const currentChapterIndex = chapters?.findIndex((ch) => ch.url === url) ?? -1;

  // Store initialization
  const initialize = useReaderStore((s) => s.initialize);
  const reset = useReaderStore((s) => s.reset);
  const isInitialized = useReaderStore((s) => s.isInitialized);
  const currentPage = useReaderStore((s) => s.currentPage);
  const totalPages = useReaderStore((s) => s.totalPages);
  const markedAsRead = useReaderStore((s) => s.markedAsRead);
  const setMarkedAsRead = useReaderStore((s) => s.setMarkedAsRead);
  const hasInitializedRef = useRef(false);

  console.log("[ReaderContainer] Data state:", {
    pagesLoading,
    pagesError: pagesError ? (pagesError as Error).message : null,
    pagesCount: pages?.length,
    isInitialized,
    hasInitializedRef: hasInitializedRef.current,
  });

  // History saving
  const saveHistory = useSaveHistory();

  // Chapter marking
  const markChapterRead = useMarkChapterRead();

  // Initialize store when pages are ready
  const isDataReady = !pagesLoading && pages && pages.length > 0;

  useEffect(() => {
    if (isDataReady && !hasInitializedRef.current && currentChapter) {
      hasInitializedRef.current = true;

      // Create initial segment
      const initialSegment: ChapterSegment = {
        chapterId: currentChapter.id || chapterId || "",
        chapterIndex: currentChapterIndex,
        chapter: currentChapter,
        pages: pages,
        isLoading: false,
      };

      console.log("[ReaderContainer] Initializing with segment:", {
        chapterId: initialSegment.chapterId,
        chapterIndex: initialSegment.chapterIndex,
        pagesCount: initialSegment.pages.length,
      });

      initialize({
        initialPage: 1,
        totalPages: pages.length,
        mangaId: mangaId || "",
        chapterId: currentChapter.id || chapterId || "",
        chapterNumber,
        chapterIndex: currentChapterIndex,
        sourceId: sourceId || "",
        initialSegment,
      });
    }
  }, [
    isDataReady,
    pages,
    chapterId,
    chapterNumber,
    currentChapterIndex,
    sourceId,
    mangaId,
    currentChapter,
    initialize,
  ]);

  // Save history on page change (debounced)
  useEffect(() => {
    if (isInitialized && mangaId && mangaTitle && currentChapter) {
      saveHistory({
        mangaId,
        mangaTitle,
        mangaCover,
        mangaUrl: mangaUrl || "",
        chapterId: currentChapter.id || chapterId || "",
        chapterNumber: currentChapter.number,
        chapterTitle: currentChapter.title,
        chapterUrl: url || "",
        pageReached: currentPage,
        totalPages: pages?.length,
        sourceId: sourceId || "",
      });
    }
  }, [
    isInitialized,
    currentPage,
    mangaId,
    mangaTitle,
    mangaCover,
    currentChapter,
    chapterId,
    url,
    pages?.length,
    sourceId,
    saveHistory,
  ]);

  // Mark chapter as read when reaching last page
  useEffect(() => {
    if (
      isInitialized &&
      mangaId &&
      currentChapter?.id &&
      totalPages > 0 &&
      currentPage >= totalPages &&
      !markedAsRead
    ) {
      console.log(
        "[ReaderContainer] Marking chapter as read:",
        currentChapter.id
      );
      markChapterRead(mangaId, currentChapter.id, totalPages);
      setMarkedAsRead();
    }
  }, [
    isInitialized,
    mangaId,
    currentChapter?.id,
    currentPage,
    totalPages,
    markedAsRead,
    markChapterRead,
    setMarkedAsRead,
  ]);

  // Reset store on unmount
  useEffect(() => {
    return () => reset();
  }, [reset]);

  // Handlers for loading adjacent chapters (phase 2 of infinite scroll)
  // Must be defined before conditional returns for hooks order
  const handleLoadPrev = useCallback(() => {
    if (!chapters || currentChapterIndex >= chapters.length - 1) {
      console.log("[ReaderContainer] No previous chapter available");
      return;
    }
    const prevChapter = chapters[currentChapterIndex + 1];
    console.log(
      "[ReaderContainer] Navigating to previous chapter:",
      prevChapter.id
    );
    router.replace({
      pathname: "/reader/[chapterId]",
      params: {
        chapterId: prevChapter.id,
        sourceId: sourceId || "",
        url: prevChapter.url,
        mangaUrl: mangaUrl || "",
        mangaId: mangaId || "",
        mangaTitle: mangaTitle || "",
        mangaCover: mangaCover || "",
        chapterNumber: prevChapter.number.toString(),
        chapterTitle: prevChapter.title || "",
      },
    });
  }, [
    chapters,
    currentChapterIndex,
    router,
    sourceId,
    mangaUrl,
    mangaId,
    mangaTitle,
    mangaCover,
  ]);

  const handleLoadNext = useCallback(() => {
    if (!chapters || currentChapterIndex <= 0) {
      console.log("[ReaderContainer] No next chapter available");
      return;
    }
    const nextChapter = chapters[currentChapterIndex - 1];
    console.log(
      "[ReaderContainer] Navigating to next chapter:",
      nextChapter.id
    );
    router.replace({
      pathname: "/reader/[chapterId]",
      params: {
        chapterId: nextChapter.id,
        sourceId: sourceId || "",
        url: nextChapter.url,
        mangaUrl: mangaUrl || "",
        mangaId: mangaId || "",
        mangaTitle: mangaTitle || "",
        mangaCover: mangaCover || "",
        chapterNumber: nextChapter.number.toString(),
        chapterTitle: nextChapter.title || "",
      },
    });
  }, [
    chapters,
    currentChapterIndex,
    router,
    sourceId,
    mangaUrl,
    mangaId,
    mangaTitle,
    mangaCover,
  ]);

  // Loading state
  if (pagesLoading) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <BackButtonOverlay />
        <ActivityIndicator size="large" color="#fff" />
        <Text className="text-zinc-400 mt-4">Loading chapter...</Text>
      </View>
    );
  }

  // Error state
  if (pagesError || !pages || pages.length === 0) {
    return (
      <View className="flex-1 bg-black items-center justify-center p-6">
        <BackButtonOverlay />
        <Text className="text-red-500 text-lg font-bold">
          Failed to load pages
        </Text>
        <Text className="text-zinc-400 text-center mt-2">
          {(pagesError as Error)?.message || "No pages found"}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-6 bg-zinc-800 px-6 py-3 rounded-lg"
        >
          <Text className="text-white">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // Wait for store initialization
  if (!isInitialized) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <ReaderView
      chapters={chapters}
      baseUrl={source?.baseUrl}
      onLoadPrev={handleLoadPrev}
      onLoadNext={handleLoadNext}
    />
  );
}
