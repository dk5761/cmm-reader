/**
 * ReaderOverlay - Floating overlay with chapter info and slider
 * Features:
 * - Tap to toggle visibility
 * - Animated fade in/out
 * - Chapter title and page counter
 * - Page slider
 */

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReaderStore } from "../stores/useReaderStore";
import { PageSlider } from "./PageSlider";
import type { FlashList } from "@shopify/flash-list";
import type { FlatPage } from "../stores/useReaderStore";

interface ReaderOverlayProps {
  flashListRef: React.RefObject<FlashList<FlatPage>>;
}

export function ReaderOverlay({ flashListRef }: ReaderOverlayProps) {
  const insets = useSafeAreaInsets();
  const isOverlayVisible = useReaderStore((s) => s.isOverlayVisible);
  const flatPages = useReaderStore((s) => s.flatPages);
  const currentFlatIndex = useReaderStore((s) => s.currentFlatIndex);

  // Derive current page info (computed, not a selector)
  const currentPage = flatPages[currentFlatIndex];
  const chapterTitle = currentPage?.chapterTitle || "";
  const chapterNumber = currentPage?.chapterNumber || 0;
  const pageInChapter = currentPage ? currentPage.pageIndex + 1 : 0;
  const totalInChapter = currentPage ? currentPage.totalPagesInChapter : 0;

  // Animated opacity
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = withTiming(isOverlayVisible ? 1 : 0, { duration: 200 });
    return {
      opacity,
      pointerEvents: isOverlayVisible ? "auto" : "none",
    };
  }, [isOverlayVisible]);

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.chapterTitle} numberOfLines={1}>
          {chapterTitle || `Chapter ${chapterNumber}`}
        </Text>
        <Text style={styles.pageCounter}>
          {pageInChapter} / {totalInChapter}
        </Text>
      </View>

      {/* Bottom bar with slider */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <PageSlider flashListRef={flashListRef} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    pointerEvents: "box-none",
  },
  topBar: {
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  chapterTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  pageCounter: {
    color: "#aaa",
    fontSize: 13,
  },
  bottomBar: {
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingTop: 8,
  },
});
