/**
 * ReaderOverlay - Floating overlay with chapter info and slider
 * Features:
 * - Back button to navigate back
 * - Animated fade in/out
 * - Chapter title and page counter
 * - Page slider
 * - Does NOT block touches to reader below
 */

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useReaderStore } from "../stores/useReaderStore";
import { PageSlider } from "./PageSlider";
import type { FlashList } from "@shopify/flash-list";
import type { FlatPage } from "../stores/useReaderStore";

interface ReaderOverlayProps {
  flashListRef: React.RefObject<FlashList<FlatPage>>;
}

export function ReaderOverlay({ flashListRef }: ReaderOverlayProps) {
  const router = useRouter();
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

  // Animated opacity for top bar
  const topBarStyle = useAnimatedStyle(() => {
    const opacity = withTiming(isOverlayVisible ? 1 : 0, { duration: 200 });
    return {
      opacity,
      // Only capture touches when visible
      pointerEvents: isOverlayVisible ? "auto" : "none",
    };
  }, [isOverlayVisible]);

  // Animated opacity for bottom bar
  const bottomBarStyle = useAnimatedStyle(() => {
    const opacity = withTiming(isOverlayVisible ? 1 : 0, { duration: 200 });
    return {
      opacity,
      pointerEvents: isOverlayVisible ? "auto" : "none",
    };
  }, [isOverlayVisible]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Top bar - only this captures touches when visible */}
      <Animated.View
        style={[styles.topBar, { paddingTop: insets.top + 8 }, topBarStyle]}
      >
        {/* Header row with back button */}
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
          <View style={styles.titleContainer}>
            <Text style={styles.chapterTitle} numberOfLines={1}>
              {chapterTitle || `Chapter ${chapterNumber}`}
            </Text>
            <Text style={styles.pageCounter}>
              {pageInChapter} / {totalInChapter}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Bottom bar with slider - only this captures touches when visible */}
      <Animated.View
        style={[
          styles.bottomBar,
          { paddingBottom: insets.bottom + 8 },
          bottomBarStyle,
        ]}
      >
        <PageSlider flashListRef={flashListRef} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    // CRITICAL: This allows touches to pass through to the list below
    pointerEvents: "box-none",
  },
  topBar: {
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  titleContainer: {
    flex: 1,
  },
  chapterTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
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
