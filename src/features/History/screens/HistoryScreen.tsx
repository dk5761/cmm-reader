import { View, Text, Pressable, SectionList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import FastImage from "react-native-fast-image";
import { useCSSVariable } from "uniwind";
import {
  useGroupedHistory,
  useRemoveHistoryEntry,
  useClearHistory,
} from "@/features/Library/hooks";
import { EmptyState } from "@/shared/components";

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

type HistoryItemProps = {
  item: {
    id: string;
    mangaId: string;
    mangaTitle: string;
    mangaCover?: string;
    mangaUrl?: string;
    chapterId: string;
    chapterNumber: number;
    chapterTitle?: string;
    chapterUrl: string;
    pageReached: number;
    totalPages?: number;
    timestamp: number;
    sourceId: string;
  };
  onPress: () => void;
  onRemove: () => void;
};

function HistoryItem({ item, onPress, onRemove }: HistoryItemProps) {
  const mutedColor = useCSSVariable("--color-muted");
  const muted = typeof mutedColor === "string" ? mutedColor : "#71717a";
  const primaryColor = useCSSVariable("--color-primary");
  const primary = typeof primaryColor === "string" ? primaryColor : "#00d9ff";

  const isCompleted = item.totalPages && item.pageReached >= item.totalPages;
  const progressText = item.totalPages
    ? `Page ${item.pageReached}/${item.totalPages}`
    : `Page ${item.pageReached}`;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onRemove}
      className="flex-row px-4 py-3 active:bg-surface/50"
      android_ripple={{ color: "rgba(255,255,255,0.1)" }}
    >
      {/* Cover */}
      <View className="w-14 h-20 rounded-lg bg-surface overflow-hidden mr-3">
        {item.mangaCover ? (
          <FastImage
            source={{ uri: item.mangaCover }}
            style={{ width: "100%", height: "100%" }}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="book-outline" size={20} color={muted} />
          </View>
        )}
      </View>

      {/* Info */}
      <View className="flex-1 justify-center">
        <Text className="text-foreground font-medium" numberOfLines={1}>
          {item.mangaTitle}
        </Text>
        <Text className="text-muted text-sm mt-0.5" numberOfLines={1}>
          Chapter {item.chapterNumber}
          {item.chapterTitle ? ` - ${item.chapterTitle}` : ""}
        </Text>
        <View className="flex-row items-center gap-2 mt-1">
          {isCompleted ? (
            <View className="flex-row items-center gap-1">
              <Ionicons name="checkmark-circle" size={14} color={primary} />
              <Text style={{ color: primary }} className="text-xs">
                Completed
              </Text>
            </View>
          ) : (
            <Text className="text-muted text-xs">{progressText}</Text>
          )}
          <Text className="text-muted text-xs">•</Text>
          <Text className="text-muted text-xs">
            {formatTimeAgo(item.timestamp)}
          </Text>
        </View>
      </View>

      {/* Continue Arrow */}
      <View className="justify-center">
        <Ionicons name="play-circle-outline" size={24} color={primary} />
      </View>
    </Pressable>
  );
}

export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const groupedHistory = useGroupedHistory();
  const removeEntry = useRemoveHistoryEntry();
  const clearHistory = useClearHistory();

  const foregroundColor = useCSSVariable("--color-foreground");
  const foreground =
    typeof foregroundColor === "string" ? foregroundColor : "#fff";

  const handleContinueReading = (item: HistoryItemProps["item"]) => {
    console.log("[HistoryScreen] Continue reading:", {
      chapterId: item.chapterId,
      sourceId: item.sourceId,
      url: item.chapterUrl,
      mangaUrl: item.mangaUrl,
      mangaId: item.mangaId,
      chapterNumber: item.chapterNumber,
    });

    router.push({
      pathname: "/reader/[chapterId]",
      params: {
        chapterId: item.chapterId,
        sourceId: item.sourceId,
        url: item.chapterUrl,
        mangaUrl: item.mangaUrl || "",
        mangaId: item.mangaId,
        mangaTitle: item.mangaTitle,
        mangaCover: item.mangaCover || "",
        chapterNumber: item.chapterNumber.toString(),
        chapterTitle: item.chapterTitle || "",
      },
    });
  };

  const isEmpty = groupedHistory.length === 0;

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 border-b border-border"
        style={{ paddingTop: insets.top + 8, paddingBottom: 12 }}
      >
        <View>
          <Text className="text-foreground text-2xl font-bold">History</Text>
          <Text className="text-muted text-sm mt-1">Your reading activity</Text>
        </View>
        {!isEmpty && (
          <Pressable onPress={clearHistory} hitSlop={8} className="p-2">
            <Ionicons name="trash-outline" size={20} color={foreground} />
          </Pressable>
        )}
      </View>

      {isEmpty ? (
        <View className="flex-1 items-center justify-center">
          <EmptyState
            icon="time-outline"
            title="No reading history"
            description="Start reading to see your activity here"
          />
        </View>
      ) : (
        <SectionList
          sections={groupedHistory}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          renderSectionHeader={({ section }) => (
            <View className="bg-background px-4 py-2 border-b border-border">
              <Text className="text-muted text-xs font-bold uppercase">
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <HistoryItem
              item={item}
              onPress={() => handleContinueReading(item)}
              onRemove={() => removeEntry(item.id)}
            />
          )}
          stickySectionHeadersEnabled
        />
      )}
    </View>
  );
}
