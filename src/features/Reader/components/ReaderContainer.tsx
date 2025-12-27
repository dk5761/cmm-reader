import { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useChapterPages } from "../api/reader.queries";
import { useChapterList } from "../../Manga/api/manga.queries";
import { getSource } from "@/sources";
import { useReaderStore } from "../store/useReaderStore";
import { ReaderView } from "./ReaderView";

/**
 * ReaderContainer - Data fetching and store initialization.
 * No persistence logic - just loads pages and renders ReaderView.
 */
export function ReaderContainer() {
  const router = useRouter();
  const { chapterId, sourceId, url, mangaUrl } = useLocalSearchParams<{
    chapterId: string;
    sourceId: string;
    url: string;
    mangaUrl: string;
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
  const hasInitializedRef = useRef(false);

  // Initialize store when pages are ready
  const isDataReady = !pagesLoading && pages && pages.length > 0;

  useEffect(() => {
    if (isDataReady && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      initialize({
        initialPage: 1, // Always start at page 1 (no persistence)
        totalPages: pages.length,
        mangaId: "",
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
    initialize,
  ]);

  // Reset store on unmount
  useEffect(() => {
    return () => reset();
  }, [reset]);

  // Loading state
  if (pagesLoading) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#fff" />
        <Text className="text-zinc-400 mt-4">Loading chapter...</Text>
      </View>
    );
  }

  // Error state
  if (pagesError || !pages || pages.length === 0) {
    return (
      <View className="flex-1 bg-black items-center justify-center p-6">
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
