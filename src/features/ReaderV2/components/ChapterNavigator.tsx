/**
 * ChapterNavigator Component
 *
 * Page slider with chapter navigation buttons.
 * Implements Mihon's seek bar with haptic feedback.
 */

import { memo, useCallback, useState, useEffect } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useReaderStoreV2 } from "../store/useReaderStoreV2";
import type { ViewerChapters } from "../types/reader.types";

// Optional haptics - gracefully degrade if not available
let Haptics: any = null;
try {
  Haptics = require("expo-haptics");
} catch {
  // expo-haptics not installed
}

const triggerHaptic = (type: "selection" | "light" | "medium") => {
  if (!Haptics || Platform.OS === "web") return;
  try {
    if (type === "selection") {
      Haptics.selectionAsync();
    } else if (type === "light") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  } catch {
    // Haptics not available
  }
};

interface ChapterNavigatorProps {
  viewerChapters: ViewerChapters;
  onPrevChapter?: () => void;
  onNextChapter?: () => void;
}

export function ChapterNavigator({
  viewerChapters,
  onPrevChapter,
  onNextChapter,
}: ChapterNavigatorProps) {
  const currentPage = useReaderStoreV2((s) => s.currentPage);
  const totalPages = useReaderStoreV2((s) => s.totalPages);
  const isSeeking = useReaderStoreV2((s) => s.isSeeking);
  const seekToPage = useReaderStoreV2((s) => s.seekToPage);
  const setIsSeeking = useReaderStoreV2((s) => s.setIsSeeking);

  // Local display state for slider feedback during seeking
  // This prevents conflicts with store's isSeeking guard
  const [displayPage, setDisplayPage] = useState(currentPage);

  // Sync display page from store when not seeking
  useEffect(() => {
    if (!isSeeking) {
      setDisplayPage(currentPage);
    }
  }, [currentPage, isSeeking]);

  const hasPrevChapter = viewerChapters.prevChapter !== null;
  const hasNextChapter = viewerChapters.nextChapter !== null;

  // Handle slider drag start
  const handleSliderStart = useCallback(() => {
    setIsSeeking(true);
    triggerHaptic("selection");
  }, [setIsSeeking]);

  // Handle slider value change (update local display only)
  const handleSliderChange = useCallback((value: number) => {
    // Update local display immediately for feedback
    setDisplayPage(Math.round(value));
  }, []);

  // Handle slider drag complete (perform seek)
  const handleSliderComplete = useCallback(
    (value: number) => {
      const targetPage = Math.round(value);
      triggerHaptic("light");
      seekToPage(targetPage);
    },
    [seekToPage]
  );

  // Chapter navigation with haptics
  const handlePrevChapter = useCallback(() => {
    if (hasPrevChapter) {
      triggerHaptic("medium");
      onPrevChapter?.();
    }
  }, [hasPrevChapter, onPrevChapter]);

  const handleNextChapter = useCallback(() => {
    if (hasNextChapter) {
      triggerHaptic("medium");
      onNextChapter?.();
    }
  }, [hasNextChapter, onNextChapter]);

  // Hide slider when no pages or only 1 page
  if (totalPages <= 1) {
    return (
      <View className="px-4">
        <Text className="text-white text-sm font-medium text-center mb-2">
          {totalPages === 1 ? "1 / 1" : "Loading..."}
        </Text>
        <View className="flex-row items-center justify-center">
          <Pressable
            onPress={handlePrevChapter}
            disabled={!hasPrevChapter}
            className="p-2"
            style={{ opacity: hasPrevChapter ? 1 : 0.3 }}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <View className="w-16" />
          <Pressable
            onPress={handleNextChapter}
            disabled={!hasNextChapter}
            className="p-2"
            style={{ opacity: hasNextChapter ? 1 : 0.3 }}
          >
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="px-4">
      {/* Page indicator - uses displayPage for live feedback during seeking */}
      <Text className="text-white text-sm font-medium text-center mb-2">
        {displayPage + 1} / {totalPages}
      </Text>

      {/* Slider with chapter navigation */}
      <View className="flex-row items-center">
        {/* Previous Chapter */}
        <Pressable
          onPress={handlePrevChapter}
          disabled={!hasPrevChapter}
          className="p-2"
          style={{ opacity: hasPrevChapter ? 1 : 0.3 }}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>

        <Text className="text-zinc-400 text-xs w-6 text-center">1</Text>

        <View className="flex-1 mx-1">
          <Slider
            style={{ width: "100%", height: 40 }}
            minimumValue={0}
            maximumValue={Math.max(0, totalPages - 1)}
            step={1}
            value={displayPage}
            onSlidingStart={handleSliderStart}
            onValueChange={handleSliderChange}
            onSlidingComplete={handleSliderComplete}
            minimumTrackTintColor="#3b82f6"
            maximumTrackTintColor="#3f3f46"
            thumbTintColor="#3b82f6"
          />
        </View>

        <Text className="text-zinc-400 text-xs w-6 text-center">
          {totalPages}
        </Text>

        {/* Next Chapter */}
        <Pressable
          onPress={handleNextChapter}
          disabled={!hasNextChapter}
          className="p-2"
          style={{ opacity: hasNextChapter ? 1 : 0.3 }}
        >
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
