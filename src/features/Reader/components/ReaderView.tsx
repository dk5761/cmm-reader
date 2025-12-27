import { memo, useCallback, useRef } from "react";
import { View, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebtoonReader, WebtoonReaderHandle } from "./WebtoonReader";
import { ReaderControls } from "./ReaderControls";
import { useReaderStore } from "../store/useReaderStore";
import type { Page, Chapter } from "@/sources";

interface ReaderViewProps {
  pages: Page[];
  baseUrl?: string;
  chapters?: Chapter[];
}

/**
 * ReaderView - Pure UI component for the reader.
 * No persistence logic - just displays pages and controls.
 */
export const ReaderView = memo(function ReaderView({
  pages,
  baseUrl,
  chapters,
}: ReaderViewProps) {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<WebtoonReaderHandle>(null);

  // Get store values
  const initialPage = useReaderStore((s) => s.initialPage);

  // Update store when page changes (UI only, no persistence)
  const handlePageChange = useCallback((page: number) => {
    if (page >= 1) {
      useReaderStore.getState().setPage(page);
    }
  }, []);

  const handleTap = useCallback(() => {
    useReaderStore.getState().toggleControls();
  }, []);

  const handleScrollToPage = useCallback((page: number) => {
    scrollViewRef.current?.scrollToIndex(page - 1, true);
  }, []);

  return (
    <View className="flex-1 bg-black">
      <StatusBar hidden />

      <WebtoonReader
        ref={scrollViewRef}
        pages={pages}
        baseUrl={baseUrl}
        initialPage={initialPage}
        onPageChange={handlePageChange}
        onTap={handleTap}
        paddingBottom={insets.bottom}
      />

      <ReaderControls chapters={chapters} onScrollToPage={handleScrollToPage} />
    </View>
  );
});
