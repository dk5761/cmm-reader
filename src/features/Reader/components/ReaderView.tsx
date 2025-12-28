import { memo, useCallback, useRef, useMemo } from "react";
import { View, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebtoonReader, WebtoonReaderHandle } from "./WebtoonReader";
import { ReaderControls } from "./ReaderControls";
import { useReaderStore } from "../store/useReaderStore";
import { buildReaderItems } from "../types";
import type { Chapter } from "@/sources";

interface ReaderViewProps {
  chapters?: Chapter[];
  baseUrl?: string;
  onLoadPrev?: () => void;
  onLoadNext?: () => void;
}

/**
 * ReaderView - Pure UI component for the infinite scroll reader.
 * Builds items from loaded segments and renders the reader.
 */
export const ReaderView = memo(function ReaderView({
  chapters,
  baseUrl,
  onLoadPrev,
  onLoadNext,
}: ReaderViewProps) {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<WebtoonReaderHandle>(null);

  // Get store values
  const loadedSegments = useReaderStore((s) => s.loadedSegments);
  const chapterIndex = useReaderStore((s) => s.chapterIndex);
  const currentChapterId = useReaderStore((s) => s.chapterId);

  // Build unified items array from segments
  const items = useMemo(() => {
    if (!chapters || loadedSegments.length === 0) {
      console.log("[ReaderView] No chapters or segments");
      return [];
    }
    const builtItems = buildReaderItems(loadedSegments, chapters, chapterIndex);
    console.log("[ReaderView] Built items:", {
      total: builtItems.length,
      pages: builtItems.filter((i) => i.type === "page").length,
      transitions: builtItems.filter((i) => i.type === "transition").length,
      chapterIndex,
    });
    return builtItems;
  }, [loadedSegments, chapters, chapterIndex]);

  // Calculate initial scroll index (skip prev transition)
  const initialScrollIndex = useMemo(() => {
    // First item is always prev transition, so start at index 1
    return items.length > 1 ? 1 : 0;
  }, [items.length]);

  // Update store when page changes
  const handlePageChange = useCallback(
    (page: number, chapterId: string) => {
      const store = useReaderStore.getState();
      store.setPage(page);

      // Check if chapter changed
      if (chapterId && chapterId !== store.chapterId) {
        const newChapter = chapters?.find((c) => c.id === chapterId);
        const newIndex = chapters?.findIndex((c) => c.id === chapterId) ?? -1;
        if (newChapter && newIndex >= 0) {
          store.setCurrentChapter(chapterId, newIndex, newChapter.number);
        }
      }
    },
    [chapters]
  );

  const handleTap = useCallback(() => {
    useReaderStore.getState().toggleControls();
  }, []);

  const handleScrollToPage = useCallback(
    (page: number) => {
      // Find the page item index in items array
      let pageCount = 0;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type === "page") {
          pageCount++;
          if (pageCount === page) {
            scrollViewRef.current?.scrollToIndex(i, true);
            return;
          }
        }
      }
    },
    [items]
  );

  return (
    <View className="flex-1 bg-black">
      <StatusBar hidden />

      <WebtoonReader
        ref={scrollViewRef}
        key={currentChapterId}
        items={items}
        baseUrl={baseUrl}
        initialScrollIndex={initialScrollIndex}
        onPageChange={handlePageChange}
        onTap={handleTap}
        onLoadPrev={onLoadPrev}
        onLoadNext={onLoadNext}
        paddingBottom={insets.bottom}
      />

      <ReaderControls chapters={chapters} onScrollToPage={handleScrollToPage} />
    </View>
  );
});
