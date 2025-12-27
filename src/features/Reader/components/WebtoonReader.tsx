import {
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import { Dimensions, ViewToken } from "react-native";
import { LegendList } from "@legendapp/list";
import { WebViewZoomableImage } from "./WebViewZoomableImage";
import type { Page } from "@/sources";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type WebtoonReaderProps = {
  pages: Page[];
  baseUrl?: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  onTap?: () => void;
  paddingBottom?: number;
};

export type WebtoonReaderHandle = {
  scrollToIndex: (index: number, animated?: boolean) => void;
  scrollTo: (options: { y: number; animated?: boolean }) => void;
};

/**
 * WebtoonReader uses viewability-based page detection (Tachiyomi pattern).
 * Uses onViewableItemsChanged to get the exact visible item index,
 * avoiding scroll offset calculations that break with variable heights.
 */
export const WebtoonReader = forwardRef<
  WebtoonReaderHandle,
  WebtoonReaderProps
>(function WebtoonReader(
  { pages, baseUrl, initialPage = 1, onPageChange, onTap, paddingBottom = 0 },
  ref
) {
  const listRef = useRef<any>(null);
  const lastReportedPage = useRef(initialPage);

  // Store onPageChange in a ref so callbacks can access latest version
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  // Expose scroll methods to parent
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number, animated = true) => {
      listRef.current?.scrollToIndex({
        index: Math.max(0, Math.min(index, pages.length - 1)),
        animated,
        viewPosition: 0,
      });
    },
    scrollTo: (options: { y: number; animated?: boolean }) => {
      listRef.current?.scrollToOffset({
        offset: options.y,
        animated: options.animated ?? true,
      });
    },
  }));

  // Viewability config - item is "current" when 50% visible
  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 50,
    }),
    []
  );

  // Viewability-based page detection (like Tachiyomi's findFirstVisibleItemPosition)
  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) return;

      // Get the first visible item (similar to RecyclerView.findFirstVisibleItemPosition)
      const firstVisible = viewableItems[0];
      if (firstVisible.index === null) return;

      const currentPage = firstVisible.index + 1; // 1-indexed

      if (currentPage !== lastReportedPage.current) {
        lastReportedPage.current = currentPage;
        if (onPageChangeRef.current) {
          onPageChangeRef.current(currentPage);
        }
      }
    },
    []
  );

  // Memoize the callback pairs to avoid re-creating on each render
  const viewabilityConfigCallbackPairs = useMemo(
    () => [
      {
        viewabilityConfig,
        onViewableItemsChanged: handleViewableItemsChanged,
      },
    ],
    [viewabilityConfig, handleViewableItemsChanged]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Page; index: number }) => (
      <WebViewZoomableImage
        uri={item.imageUrl}
        baseUrl={baseUrl}
        width={SCREEN_WIDTH}
        minHeight={100}
        onTap={onTap}
      />
    ),
    [baseUrl, onTap]
  );

  const keyExtractor = useCallback(
    (item: Page, index: number) => `page-${item.index}-${index}`,
    []
  );

  return (
    <LegendList
      ref={listRef}
      data={pages}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      initialScrollIndex={initialPage > 1 ? initialPage - 1 : undefined}
      estimatedItemSize={SCREEN_WIDTH * 1.5}
      maintainVisibleContentPosition
      recycleItems
      showsVerticalScrollIndicator={false}
      viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
      contentContainerStyle={{ paddingBottom }}
      decelerationRate="fast"
      drawDistance={SCREEN_WIDTH * 2}
    />
  );
});
