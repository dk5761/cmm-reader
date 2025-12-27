import { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useChapterPages } from "../api/reader.queries";
import { useChapterList } from "../../Manga/api/manga.queries";
import { useLibraryMangaById } from "@/features/Library/hooks";
import { getSource } from "@/sources";
import { useReaderStore } from "../store/useReaderStore";
import { ReaderView } from "./ReaderView";

/**
 * ReaderContainer handles all data fetching and store initialization.
 * Renders loading state until all required data is ready.
 * Once ready, initializes the Zustand store and renders ReaderView.
 */
export function ReaderContainer() {
  const router = useRouter();
  const { chapterId, sourceId, url, mangaUrl } = useLocalSearchParams<{
    chapterId: string;
    sourceId: string;
    url: string;
    mangaUrl: string;
  }>();

  // Data fetching hooks
  const source = getSource(sourceId || "");
  const {
    data: pages,
    isLoading: pagesLoading,
    error: pagesError,
  } = useChapterPages(sourceId || "", url || "");

  const { data: chapters } = useChapterList(sourceId || "", mangaUrl || "");

  // Get manga ID for library lookup
  const getMangaIdFromUrl = (mangaUrlStr: string): string => {
    const parts = mangaUrlStr.split("/").filter(Boolean);
    return parts[parts.length - 1] || parts[parts.length - 2] || "";
  };
  const mangaId = `${sourceId}_${getMangaIdFromUrl(mangaUrl || "")}`;

  const libraryManga = useLibraryMangaById(mangaId);

  // Wait for library data to stabilize (Realm query may take a moment)
  const [libraryChecked, setLibraryChecked] = useState(false);
  const libraryCheckTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Wait 100ms for Realm to return data, then mark as checked
    libraryCheckTimeout.current = setTimeout(() => {
      setLibraryChecked(true);
    }, 100);

    return () => {
      if (libraryCheckTimeout.current) {
        clearTimeout(libraryCheckTimeout.current);
      }
    };
  }, []);

  // If libraryManga becomes available, mark as checked immediately
  useEffect(() => {
    if (libraryManga) {
      setLibraryChecked(true);
      if (libraryCheckTimeout.current) {
        clearTimeout(libraryCheckTimeout.current);
      }
    }
  }, [libraryManga]);

  // Calculate derived values - only after library is checked
  const savedChapter = libraryManga?.chapters.find((c) => c.id === chapterId);

  // Debug logging for persistence issue
  console.log("[ReaderContainer] Looking for chapterId:", chapterId);
  console.log("[ReaderContainer] libraryManga exists:", !!libraryManga);
  if (libraryManga) {
    console.log(
      "[ReaderContainer] Total chapters:",
      libraryManga.chapters.length
    );
    console.log(
      "[ReaderContainer] First 3 chapter IDs:",
      libraryManga.chapters.slice(0, 3).map((c) => c.id)
    );
    console.log("[ReaderContainer] savedChapter found:", !!savedChapter);
    console.log(
      "[ReaderContainer] savedChapter.lastPageRead:",
      savedChapter?.lastPageRead
    );
  }

  const initialPage = savedChapter?.lastPageRead || 1;
  console.log("[ReaderContainer] Using initialPage:", initialPage);

  const currentChapter = chapters?.find((ch) => ch.url === url);
  const chapterNumber = currentChapter?.number || 0;

  // Store initialization
  const initialize = useReaderStore((s) => s.initialize);
  const reset = useReaderStore((s) => s.reset);
  const isInitialized = useReaderStore((s) => s.isInitialized);
  const hasInitializedRef = useRef(false);

  // Check if all required data is ready (pages + library check)
  const isDataReady =
    !pagesLoading && pages && pages.length > 0 && libraryChecked;

  // Initialize store once when ALL data is ready
  useEffect(() => {
    if (isDataReady && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      console.log(
        "[ReaderContainer] Initializing store with page:",
        initialPage
      );
      initialize({
        initialPage,
        totalPages: pages.length,
        mangaId,
        chapterId: chapterId || "",
        chapterNumber,
        sourceId: sourceId || "",
      });
    }
  }, [
    isDataReady,
    initialPage,
    pages?.length,
    mangaId,
    chapterId,
    chapterNumber,
    sourceId,
    initialize,
  ]);

  // Reset store on unmount
  useEffect(() => {
    return () => {
      reset();
    };
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

  // Render the pure UI component
  return (
    <ReaderView
      pages={pages}
      baseUrl={source?.baseUrl}
      chapters={chapters}
      currentChapter={currentChapter}
      libraryManga={libraryManga}
    />
  );
}
