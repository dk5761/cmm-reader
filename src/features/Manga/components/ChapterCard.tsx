import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import type { Chapter } from "../data/mockData";

type ChapterCardProps = {
  chapter: Chapter;
  onPress?: () => void;
  onOptions?: () => void;
};

export function ChapterCard({ chapter, onPress, onOptions }: ChapterCardProps) {
  const mutedColor = useCSSVariable("--color-muted");
  const muted = typeof mutedColor === "string" ? mutedColor : "#71717a";

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between px-4 py-3 ${
        chapter.isNew ? "bg-surface" : ""
      }`}
    >
      <View className="flex-1">
        <Text className="text-foreground text-sm font-medium">
          Chapter {chapter.number}
        </Text>
        <Text className="text-muted text-xs mt-0.5">{chapter.date}</Text>
      </View>

      <Pressable onPress={onOptions} hitSlop={8} className="p-2">
        <Ionicons name="ellipsis-vertical" size={18} color={muted} />
      </Pressable>
    </Pressable>
  );
}
