import { useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { Dimensions } from "react-native";
import { LegendList } from "@legendapp/list";
import { MangaImage } from "@/shared/components/MangaImage";
import { ChapterTransition } from "./ChapterTransition";
import { useReaderStore } from "../store/useReaderStore";
import { useImagePreloader } from "../hooks/useImagePreloader";
import type { ReaderItem, PageItem } from "../types";
import { getReaderItemKey } from "../types";
import type { Page } from "@/sources";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PRELOAD_COUNT = 5;
const BOUNDARY_THRESHOLD = 200; // px from edge to trigger loading
const SCROLL_ACTIVATION_THRESHOLD = 0.5; // 50% of screen height before page tracking activates

type InfiniteWebtoonReaderProps = {
  items: ReaderItem[];
  baseUrl?: string;
  initialScrollIndex?: number;
  onPageChange?: (page: number, chapterId: string) => void;
  onTap?: () => void;
  onLoadPrev?: () => void;
  onLoadNext?: () => void;
  paddingBottom?: number;
};

export type WebtoonReaderHandle = {
  scrollToIndex: (index: number, animated?: boolean) => void;
};

/**
 * InfiniteWebtoonReader - Vertical scrolling reader with chapter transitions.
 * Supports seamless scrolling between chapters à la Tachiyomi.
 */
export const WebtoonReader = forwardRef<
  WebtoonReaderHandle,
  InfiniteWebtoonReaderProps
>(function WebtoonReader(
  {
    items,
    baseUrl,
    initialScrollIndex = 0,
    onPageChange,
    onTap,
    onLoadPrev,
    onLoadNext,
    paddingBottom = 0,
  },
  ref
) {
  const listRef = useRef<any>(null);
  const lastReportedPage = useRef(1);
  const lastReportedChapter = useRef<string>("");
  const hasTriggeredPrev = useRef(false);
  const hasTriggeredNext = useRef(false);

  // Scroll activation tracking - prevents page updates until user intentionally scrolls
  const hasUserScrolled = useRef(false);
  const initialScrollOffset = useRef<number | null>(null);

  // Get pages for preloading
  const pageItems = items.filter((i): i is PageItem => i.type === "page");
  const currentPage = useReaderStore((s) => s.currentPage);
  const pages: Page[] = pageItems.map((p) => p.page);
  useImagePreloader(pages, currentPage, PRELOAD_COUNT, baseUrl);

  // Store callbacks in refs
  const onPageChangeRef = useRef(onPageChange);
  const onLoadPrevRef = useRef(onLoadPrev);
  const onLoadNextRef = useRef(onLoadNext);
  onPageChangeRef.current = onPageChange;
  onLoadPrevRef.current = onLoadPrev;
  onLoadNextRef.current = onLoadNext;

  // Reset scroll tracking when items change (new chapter navigation)
  const prevItemsLength = useRef(items.length);
  if (items.length !== prevItemsLength.current) {
    hasUserScrolled.current = false;
    initialScrollOffset.current = null;
    prevItemsLength.current = items.length;
  }

  // Expose scroll methods
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number, animated = true) => {
      listRef.current?.scrollToIndex({
        index: Math.max(0, Math.min(index, items.length - 1)),
        animated,
        viewPosition: 0,
      });
    },
  }));

  // Scroll handler with boundary detection and activation threshold
  const handleScroll = useCallback(
    (event: any) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const layoutHeight = event.nativeEvent.layoutMeasurement.height;
      const contentHeight = event.nativeEvent.contentSize.height;

      // Capture initial scroll position on first scroll event
      if (initialScrollOffset.current === null) {
        initialScrollOffset.current = offsetY;
      }

      // Detect if user has scrolled past threshold (50% of screen height)
      const scrollThreshold = layoutHeight * SCROLL_ACTIVATION_THRESHOLD;
      const scrollDelta = Math.abs(
        offsetY - (initialScrollOffset.current ?? offsetY)
      );
      if (scrollDelta > scrollThreshold) {
        hasUserScrolled.current = true;
      }

      // Boundary detection for loading prev/next chapters
      // IMPORTANT: Only trigger after user has scrolled (prevents immediate navigation on load)
      if (hasUserScrolled.current) {
        const nearTop = offsetY < BOUNDARY_THRESHOLD;
        const nearBottom =
          offsetY + layoutHeight > contentHeight - BOUNDARY_THRESHOLD;

        if (nearTop && !hasTriggeredPrev.current) {
          hasTriggeredPrev.current = true;
          onLoadPrevRef.current?.();
        } else if (!nearTop) {
          hasTriggeredPrev.current = false;
        }

        if (nearBottom && !hasTriggeredNext.current) {
          hasTriggeredNext.current = true;
          onLoadNextRef.current?.();
        } else if (!nearBottom) {
          hasTriggeredNext.current = false;
        }
      }

      // Skip page tracking if:
      // 1. Slider is being dragged (slider is master)
      // 2. User hasn't scrolled past threshold (store initial value is master)
      if (
        useReaderStore.getState().isSliderDragging ||
        !hasUserScrolled.current
      ) {
        return;
      }

      // Page tracking - use top of viewport with small offset for better UX
      if (pageItems.length > 0 && contentHeight > 0) {
        const avgItemHeight = contentHeight / items.length;
        // Use top of viewport + small threshold (1/4 of viewport) for page detection
        const trackingPoint = offsetY + layoutHeight * 0.25;
        const currentIndex = Math.floor(trackingPoint / avgItemHeight);
        const currentItem = items[currentIndex];

        if (currentItem?.type === "page") {
          const pageNumber = currentItem.page.index + 1;
          const chapterId = currentItem.chapterId;

          if (
            pageNumber !== lastReportedPage.current ||
            chapterId !== lastReportedChapter.current
          ) {
            lastReportedPage.current = pageNumber;
            lastReportedChapter.current = chapterId;
            onPageChangeRef.current?.(pageNumber, chapterId);
          }
        }
      }
    },
    [items, pageItems.length]
  );

  const renderItem = useCallback(
    ({ item }: { item: ReaderItem }) => {
      if (item.type === "transition") {
        return <ChapterTransition item={item} onTap={onTap} />;
      }
      return (
        <MangaImage
          uri={item.page.imageUrl}
          headers={item.page.headers}
          style={{ width: SCREEN_WIDTH }}
          resizeMode="contain"
          priority="high"
        />
      );
    },
    [onTap]
  );

  const keyExtractor = useCallback(
    (item: ReaderItem, index: number) => getReaderItemKey(item, index),
    []
  );

  return (
    <LegendList
      ref={listRef}
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      initialScrollIndex={
        initialScrollIndex > 0 ? initialScrollIndex : undefined
      }
      estimatedItemSize={SCREEN_WIDTH * 1.5}
      maintainVisibleContentPosition
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingBottom }}
      decelerationRate={0.992}
      drawDistance={SCREEN_WIDTH * 2}
    />
  );
});
