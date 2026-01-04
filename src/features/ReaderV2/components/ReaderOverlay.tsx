/**
 * ReaderOverlay Component
 *
 * Header and footer overlay with animations.
 * Contains ChapterNavigator for seeking.
 */

import { memo, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useReaderStoreV2 } from "../store/useReaderStoreV2";
import { ChapterNavigator } from "./ChapterNavigator";
import type { Chapter } from "@/sources";
import { formatChapterTitle } from "../types/reader.types";

interface ReaderOverlayProps {
  chapter: Chapter | null;
  onPrevChapter?: () => void;
  onNextChapter?: () => void;
}

export const ReaderOverlay = memo(function ReaderOverlay({
  chapter,
  onPrevChapter,
  onNextChapter,
}: ReaderOverlayProps) {
  const insets = useSafeAreaInsets();
  const isOverlayVisible = useReaderStoreV2((s) => s.isOverlayVisible);
  const viewerChapters = useReaderStoreV2((s) => s.viewerChapters);

  // Use the current chapter from store (updates during infinite scroll)
  // Fall back to prop for initial render
  const currentChapter = viewerChapters?.currChapter?.chapter ?? chapter;

  // Animated styles for header
  const headerStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isOverlayVisible ? 1 : 0, { duration: 200 }),
    transform: [
      {
        translateY: withTiming(isOverlayVisible ? 0 : -50, { duration: 200 }),
      },
    ],
  }));

  // Animated styles for footer
  const footerStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isOverlayVisible ? 1 : 0, { duration: 200 }),
    transform: [
      {
        translateY: withTiming(isOverlayVisible ? 0 : 50, { duration: 200 }),
      },
    ],
  }));

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  if (!viewerChapters) return null;

  const chapterTitle = formatChapterTitle(currentChapter);

  return (
    <>
      {/* Header */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            paddingTop: insets.top,
          },
          headerStyle,
        ]}
        className="bg-black/80"
        pointerEvents={isOverlayVisible ? "auto" : "none"}
      >
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable onPress={handleBack} className="p-2 -ml-2">
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <View className="flex-1 mx-4">
            <Text
              className="text-white text-sm font-semibold"
              numberOfLines={1}
            >
              {chapterTitle}
            </Text>
          </View>
          <Pressable className="p-2 -mr-2">
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </Pressable>
        </View>
      </Animated.View>

      {/* Footer */}
      <Animated.View
        style={[
          {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: insets.bottom + 16,
          },
          footerStyle,
        ]}
        className="bg-black/80"
        pointerEvents={isOverlayVisible ? "auto" : "none"}
      >
        <ChapterNavigator
          viewerChapters={viewerChapters}
          onPrevChapter={onPrevChapter}
          onNextChapter={onNextChapter}
        />
      </Animated.View>
    </>
  );
});
