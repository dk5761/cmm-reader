/**
 * ChapterTransition Component
 *
 * Displays transition UI between chapters.
 * Shows "Previous Chapter" or "Next Chapter" with loading/error states.
 */

import { memo } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatChapterTitle } from "../types/reader.types";
import type { TransitionItem } from "../types/reader.types";

interface ChapterTransitionProps {
  item: TransitionItem;
  onLoad?: () => void;
  onRetry?: () => void;
}

export const ChapterTransition = memo(function ChapterTransition({
  item,
  onLoad,
  onRetry,
}: ChapterTransitionProps) {
  const { direction, targetChapter, isLoading } = item;

  const title = direction === "prev" ? "Previous Chapter" : "Next Chapter";
  const chapterName = targetChapter
    ? formatChapterTitle(targetChapter.chapter)
    : "No more chapters";
  const hasTarget = targetChapter !== null;

  const isLoaded = targetChapter?.state === "loaded";
  const isError = targetChapter?.state === "error";
  const errorMessage = targetChapter?.error;

  // Show minimal separator when chapter is loaded
  if (isLoaded) {
    return (
      <View className="w-full py-8 items-center justify-center">
        <View className="w-24 h-px bg-neutral-800 mb-2" />
        <Text className="text-neutral-500 font-medium text-xs uppercase tracking-widest">
          {chapterName}
        </Text>
      </View>
    );
  }

  // Error state with retry option
  if (isError) {
    return (
      <View className="w-full h-48 items-center justify-center bg-neutral-900 border-y border-neutral-800">
        <Ionicons name="alert-circle-outline" size={32} color="#ef4444" />
        <Text className="text-red-500 text-sm font-medium mt-2 mb-1">
          Failed to load {title.toLowerCase()}
        </Text>
        <Text className="text-neutral-500 text-xs mb-3">
          {errorMessage || "Unknown error"}
        </Text>
        <Pressable
          onPress={onRetry}
          className="bg-red-600 px-6 py-2 rounded-lg flex-row items-center"
        >
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text className="text-white font-medium ml-2">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="w-full h-48 items-center justify-center bg-neutral-900 border-y border-neutral-800">
      <Text className="text-neutral-400 text-sm uppercase tracking-wider mb-2">
        {title}
      </Text>

      {isLoading ? (
        <ActivityIndicator color="#3b82f6" size="small" />
      ) : hasTarget ? (
        <Pressable
          onPress={onLoad}
          className="bg-neutral-800 px-6 py-3 rounded-lg"
        >
          <Text className="text-white font-medium">{chapterName}</Text>
        </Pressable>
      ) : (
        <Text className="text-neutral-500">{chapterName}</Text>
      )}
    </View>
  );
});
