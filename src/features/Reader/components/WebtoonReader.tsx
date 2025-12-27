import { useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { Dimensions } from "react-native";
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
};

/**
 * WebtoonReader - Simple vertical scrolling manga reader.
 * Uses onScroll for page calculation.
 */
export const WebtoonReader = forwardRef<
  WebtoonReaderHandle,
  WebtoonReaderProps
>(function WebtoonReader(
  { pages, baseUrl, initialPage = 1, onPageChange, onTap, paddingBottom = 0 },
  ref
) {
  const listRef = useRef<any>(null);
  const lastReportedPage = useRef(1);

  // Store onPageChange in ref
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  // Expose scroll methods
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number, animated = true) => {
      listRef.current?.scrollToIndex({
        index: Math.max(0, Math.min(index, pages.length - 1)),
        animated,
        viewPosition: 0,
      });
    },
  }));

  // Simple scroll handler for page tracking
  const handleScroll = useCallback(
    (event: any) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const layoutHeight = event.nativeEvent.layoutMeasurement.height;
      const contentHeight = event.nativeEvent.contentSize.height;

      if (pages.length > 0 && contentHeight > 0) {
        const avgItemHeight = contentHeight / pages.length;
        const midPoint = offsetY + layoutHeight / 2;
        const currentPage = Math.min(
          pages.length,
          Math.max(1, Math.floor(midPoint / avgItemHeight) + 1)
        );

        if (currentPage !== lastReportedPage.current) {
          lastReportedPage.current = currentPage;
          onPageChangeRef.current?.(currentPage);
        }
      }
    },
    [pages.length]
  );

  const renderItem = useCallback(
    ({ item }: { item: Page }) => (
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
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingBottom }}
      decelerationRate="fast"
      drawDistance={SCREEN_WIDTH * 2}
    />
  );
});
