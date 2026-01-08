/**
 * ChapterNavigator Component
 *
 * Page slider with chapter navigation buttons.
 * Implements Mihon's seek bar with haptic feedback.
 */

import { memo, useCallback, useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { triggerHaptic, triggerSelection } from "@/utils/haptics";
import { useReaderStoreV2 } from "../store/useReaderStoreV2";
import type { ViewerChapters } from "../types/reader.types";

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

  // Local state only for immediate feedback DURING the drag
  const [displayPage, setDisplayPage] = useState(currentPage);

  // The actual value to show in UI (Slider + Text)
  const activePage = isSeeking ? displayPage : currentPage;

  const hasPrevChapter = viewerChapters.prevChapter !== null;
  const hasNextChapter = viewerChapters.nextChapter !== null;

  // Handle slider drag start
  const handleSliderStart = useCallback(() => {
    // console.log("[ChapterNavigator] Slider Start");
    setDisplayPage(currentPage); // Sync local state to current store value
    setIsSeeking(true);
    triggerSelection();
  }, [currentPage, setIsSeeking]);

  // Handle slider value change (update local display only)
  const handleSliderChange = useCallback((value: number) => {
    // Update local display immediately for snappy feedback during drag
    const rounded = Math.round(value);
    setDisplayPage(rounded);
  }, []);

  // Handle slider drag complete (perform seek)
  const handleSliderComplete = useCallback(
    (value: number) => {
      const targetPage = Math.round(value);
      // console.log("[ChapterNavigator] Slider Complete -> Seek to", targetPage);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
      seekToPage(targetPage);
    },
    [seekToPage]
  );

  // Chapter navigation with haptics
  const handlePrevChapter = useCallback(() => {
    if (hasPrevChapter) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      onPrevChapter?.();
    }
  }, [hasPrevChapter, onPrevChapter]);

  const handleNextChapter = useCallback(() => {
    if (hasNextChapter) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
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
      {/* Page indicator - uses activePage for instant feedback */}
      <Text className="text-white text-sm font-medium text-center mb-2">
        {activePage + 1} / {totalPages}
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
            value={activePage}
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
