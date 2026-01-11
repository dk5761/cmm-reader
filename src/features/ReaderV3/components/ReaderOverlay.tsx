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
import { View, Text, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useReaderStore } from "../stores/useReaderStore";
import { PageSlider } from "./PageSlider";

interface ReaderOverlayProps {
  flashListRef: React.RefObject<any>;
  mangaTitle: string;
}

export function ReaderOverlay({
  flashListRef,
  mangaTitle,
}: ReaderOverlayProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isOverlayVisible = useReaderStore((s) => s.isOverlayVisible);
  const flatPages = useReaderStore((s) => s.flatPages);
  const currentFlatIndex = useReaderStore((s) => s.currentFlatIndex);

  // Derive current page info (computed, not a selector)
  const currentPage = flatPages[currentFlatIndex];
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
    <View className="absolute inset-0 justify-between" pointerEvents="box-none">
      {/* Top bar - only this captures touches when visible */}
      <Animated.View
        className="bg-black/80 px-3 pb-3"
        style={[{ paddingTop: insets.top + 8 }, topBarStyle]}
      >
        {/* Header row with back button */}
        <View className="flex-row items-center">
          <Pressable
            className="p-1 mr-2"
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
          <View className="flex-1">
            <Text
              className="text-white text-base font-semibold mb-0.5"
              numberOfLines={1}
            >
              {mangaTitle}
            </Text>
            <Text className="text-zinc-400 text-sm">
              Chapter {chapterNumber} : Page {pageInChapter} / {totalInChapter}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Bottom bar with slider - only this captures touches when visible */}
      <Animated.View
        className="bg-black/80 pt-2"
        style={[{ paddingBottom: insets.bottom + 8 }, bottomBarStyle]}
      >
        <PageSlider flashListRef={flashListRef} />
      </Animated.View>
    </View>
  );
}
