import { useCallback, useRef, useState, useMemo } from "react";
import {
  View,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  SharedValue,
} from "react-native-reanimated";
import { WebViewZoomableImage } from "./WebViewZoomableImage";
import type { Page } from "@/sources";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Number of pages to preload before and after visible range
const PAGE_BUFFER = 2;

type WebtoonReaderProps = {
  pages: Page[];
  baseUrl?: string;
  onPageChange?: (page: number) => void;
  onTap?: () => void;
  scrollY?: SharedValue<number>;
  paddingBottom?: number;
};

export function WebtoonReader({
  pages,
  baseUrl,
  onPageChange,
  onTap,
  scrollY,
  paddingBottom = 0,
}: WebtoonReaderProps) {
  const pageHeight = SCREEN_WIDTH * 1.5;
  const lastReportedPage = useRef(1);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 3 });

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (scrollY) {
        scrollY.value = event.contentOffset.y;
      }
    },
  });

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = event.nativeEvent;
      const scrollPosition = contentOffset.y;

      // Calculate which pages are visible
      const firstVisiblePage = Math.floor(scrollPosition / pageHeight);
      const lastVisiblePage = Math.ceil(
        (scrollPosition + SCREEN_HEIGHT) / pageHeight
      );

      // Update visible range with buffer
      const start = Math.max(0, firstVisiblePage - PAGE_BUFFER);
      const end = Math.min(pages.length - 1, lastVisiblePage + PAGE_BUFFER);

      setVisibleRange((prev) => {
        if (prev.start !== start || prev.end !== end) {
          return { start, end };
        }
        return prev;
      });

      // Report page change
      if (onPageChange) {
        const currentPage = firstVisiblePage + 1;
        if (currentPage !== lastReportedPage.current && currentPage >= 1) {
          lastReportedPage.current = currentPage;
          onPageChange(currentPage);
        }
      }
    },
    [onPageChange, pages.length, pageHeight]
  );

  // Create page elements with placeholders for non-visible pages
  const pageElements = useMemo(() => {
    return pages.map((page, index) => {
      const isVisible =
        index >= visibleRange.start && index <= visibleRange.end;

      if (isVisible) {
        return (
          <WebViewZoomableImage
            key={page.index}
            uri={page.imageUrl}
            baseUrl={baseUrl}
            width={SCREEN_WIDTH}
            initialHeight={pageHeight}
            onTap={onTap}
          />
        );
      } else {
        // Placeholder for non-visible pages
        return (
          <View
            key={page.index}
            style={{
              width: SCREEN_WIDTH,
              height: pageHeight,
              backgroundColor: "#111",
            }}
          />
        );
      }
    });
  }, [pages, baseUrl, pageHeight, onTap, visibleRange]);

  return (
    <Animated.ScrollView
      showsVerticalScrollIndicator={false}
      onScroll={scrollHandler}
      onScrollEndDrag={handleScroll}
      onMomentumScrollEnd={handleScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingBottom }}
      decelerationRate="fast"
      overScrollMode="never"
    >
      {pageElements}
    </Animated.ScrollView>
  );
}
