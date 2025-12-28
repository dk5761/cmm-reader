import { useEffect, useRef } from "react";
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
  } = useLocalSearchParams<{
    chapterId: string;
    sourceId: string;
    url: string;
    mangaUrl: string;
    mangaId?: string;
    mangaTitle?: string;
    mangaCover?: string;
  }>();

  // Data fetching
  const source = getSource(sourceId || "");
  const {
    data: pages,
    isLoading: pagesLoading,
    error: pagesError,
  } = useChapterPages(sourceId || "", url || "");

  const { data: chapters } = useChapterList(sourceId || "", mangaUrl || "");

  // Find current chapter for chapter number
  const currentChapter = chapters?.find((ch) => ch.url === url);
  const chapterNumber = currentChapter?.number || 0;

  // Store initialization
  const initialize = useReaderStore((s) => s.initialize);
  const reset = useReaderStore((s) => s.reset);
  const isInitialized = useReaderStore((s) => s.isInitialized);
  const currentPage = useReaderStore((s) => s.currentPage);
  const totalPages = useReaderStore((s) => s.totalPages);
  const markedAsRead = useReaderStore((s) => s.markedAsRead);
  const setMarkedAsRead = useReaderStore((s) => s.setMarkedAsRead);
  const hasInitializedRef = useRef(false);

  // History saving
  const saveHistory = useSaveHistory();

  // Chapter marking
  const markChapterRead = useMarkChapterRead();

  // Initialize store when pages are ready
  const isDataReady = !pagesLoading && pages && pages.length > 0;

  useEffect(() => {
    if (isDataReady && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      initialize({
        initialPage: 1,
        totalPages: pages.length,
        mangaId: mangaId || "",
        chapterId: chapterId || "",
        chapterNumber,
        sourceId: sourceId || "",
      });
    }
  }, [
    isDataReady,
    pages?.length,
    chapterId,
    chapterNumber,
    sourceId,
    mangaId,
    initialize,
  ]);

  // Save history on page change (debounced)
  useEffect(() => {
    if (isInitialized && mangaId && mangaTitle && currentChapter) {
      saveHistory({
        mangaId,
        mangaTitle,
        mangaCover,
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
    <ReaderView pages={pages} baseUrl={source?.baseUrl} chapters={chapters} />
  );
}
