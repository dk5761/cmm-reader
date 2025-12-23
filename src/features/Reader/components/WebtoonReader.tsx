import { useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { Dimensions, ViewToken } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SharedValue } from "react-native-reanimated";
import { WebViewZoomableImage } from "./WebViewZoomableImage";
import type { Page } from "@/sources";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type WebtoonReaderProps = {
  pages: Page[];
  baseUrl?: string;
  onPageChange?: (page: number) => void;
  onTap?: () => void;
  scrollY?: SharedValue<number>;
  paddingBottom?: number;
};

export type WebtoonReaderHandle = {
  scrollToIndex: (index: number, animated?: boolean) => void;
  scrollTo: (options: { y: number; animated?: boolean }) => void;
};

export const WebtoonReader = forwardRef<
  WebtoonReaderHandle,
  WebtoonReaderProps
>(function WebtoonReader(
  { pages, baseUrl, onPageChange, onTap, scrollY, paddingBottom = 0 },
  ref
) {
  const flashListRef = useRef<any>(null);
  const lastReportedPage = useRef(1);

  // Track heights for each page (for accurate scroll calculations)
  const itemHeights = useRef<Map<number, number>>(new Map());

  // Expose scroll methods to parent
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number, animated = true) => {
      flashListRef.current?.scrollToIndex({
        index: Math.max(0, Math.min(index, pages.length - 1)),
        animated,
        viewPosition: 0, // Align to top
      });
    },
    scrollTo: (options: { y: number; animated?: boolean }) => {
      flashListRef.current?.scrollToOffset({
        offset: options.y,
        animated: options.animated ?? true,
      });
    },
  }));

  // Track scroll position for parent
  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      if (scrollY) {
        scrollY.value = event.nativeEvent.contentOffset.y;
      }
    },
    [scrollY]
  );

  // Track which item is visible
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && onPageChange) {
        // Get the first fully visible item, or first visible
        const firstVisible = viewableItems[0];
        const currentPage = (firstVisible.index ?? 0) + 1;

        if (currentPage !== lastReportedPage.current) {
          lastReportedPage.current = currentPage;
          onPageChange(currentPage);
        }
      }
    },
    [onPageChange]
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleHeightChange = useCallback((index: number, height: number) => {
    itemHeights.current.set(index, height);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: Page; index: number }) => (
      <WebViewZoomableImage
        uri={item.imageUrl}
        baseUrl={baseUrl}
        width={SCREEN_WIDTH}
        minHeight={100}
        onTap={onTap}
        onHeightChange={(height) => handleHeightChange(index, height)}
      />
    ),
    [baseUrl, onTap, handleHeightChange]
  );

  const keyExtractor = useCallback(
    (item: Page, index: number) => `page-${item.index}-${index}`,
    []
  );

  // Provide layout info for better scroll accuracy
  const overrideItemLayout = useCallback(
    (layout: { span?: number }, item: Page, index: number) => {
      // FlashList v2 uses this for span, not size
    },
    []
  );

  return (
    <FlashList
      ref={flashListRef}
      data={pages}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      overrideItemLayout={overrideItemLayout}
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      contentContainerStyle={{ paddingBottom }}
      decelerationRate="fast"
      drawDistance={SCREEN_WIDTH * 2}
    />
  );
});
