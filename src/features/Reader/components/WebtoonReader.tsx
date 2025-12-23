import { useCallback, useRef } from "react";
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (scrollY) {
        scrollY.value = event.contentOffset.y;
      }
    },
  });

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!onPageChange) return;

      const { contentOffset, contentSize } = event.nativeEvent;
      const totalHeight = contentSize.height;
      const scrollPosition = contentOffset.y;
      const singlePageHeight = totalHeight / pages.length;
      const pageIndex = Math.min(
        Math.floor(scrollPosition / singlePageHeight) + 1,
        pages.length
      );

      if (pageIndex !== lastReportedPage.current && pageIndex >= 1) {
        lastReportedPage.current = pageIndex;
        onPageChange(pageIndex);
      }
    },
    [onPageChange, pages.length]
  );

  return (
    <Animated.ScrollView
      showsVerticalScrollIndicator={false}
      onScroll={scrollHandler}
      onMomentumScrollEnd={handleScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingBottom }}
      decelerationRate="fast"
      overScrollMode="never"
    >
      {pages.map((page) => (
        <WebViewZoomableImage
          key={page.index}
          uri={page.imageUrl}
          baseUrl={baseUrl}
          width={SCREEN_WIDTH}
          height={pageHeight}
          onTap={onTap}
        />
      ))}
    </Animated.ScrollView>
  );
}
