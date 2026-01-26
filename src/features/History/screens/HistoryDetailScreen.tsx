import {
  View,
  Text,
  Pressable,
  FlatList,
  Alert,
  Animated as RNAnimated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useCSSVariable } from "uniwind";
import { Swipeable, RectButton } from "react-native-gesture-handler";
import { useRef } from "react";
import {
  useMangaHistoryDetails,
  useRemoveHistoryEntry,
  useRemoveMangaHistory,
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

type ChapterHistoryItemProps = {
  item: {
    id: string;
    chapterId: string;
    chapterNumber: number;
    chapterTitle?: string;
    chapterUrl: string;
    pageReached: number;
    totalPages?: number;
    timestamp: number;
  };
  onPress: () => void;
  onRemove: () => void;
};

function ChapterHistoryItem({
  item,
  onPress,
  onRemove,
}: ChapterHistoryItemProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const mutedColor = useCSSVariable("--color-muted");
  const muted = typeof mutedColor === "string" ? mutedColor : "#71717a";
  const primaryColor = useCSSVariable("--color-primary");
  const primary = typeof primaryColor === "string" ? primaryColor : "#00d9ff";

  const isCompleted = item.totalPages && item.pageReached >= item.totalPages;
  const progressText = item.totalPages
    ? `Page ${item.pageReached}/${item.totalPages}`
    : `Page ${item.pageReached}`;

  const handleDelete = () => {
    swipeableRef.current?.close();
    onRemove();
  };

  const renderRightActions = (
    progress: RNAnimated.AnimatedInterpolation<number>,
    dragX: RNAnimated.AnimatedInterpolation<number>
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [-75, 0],
      outputRange: [0, 75],
      extrapolate: "clamp",
    });

    return (
      <RNAnimated.View
        style={{
          flexDirection: "row",
          transform: [{ translateX }],
        }}
      >
        <RectButton
          style={{
            width: 75,
            backgroundColor: "#ef4444",
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={22} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 10, marginTop: 4 }}>
            Delete
          </Text>
        </RectButton>
      </RNAnimated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
    >
      <Pressable
        onPress={onPress}
        className="flex-row items-center px-4 py-3 active:bg-surface/50 border-b border-border bg-background"
        android_ripple={{ color: "rgba(255,255,255,0.1)" }}
      >
        {/* Chapter Info */}
        <View className="flex-1">
          <Text className="text-foreground font-medium" numberOfLines={1}>
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
    </Swipeable>
  );
}

export function HistoryDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const sourceId = params.sourceId as string;
  const mangaId = params.mangaId as string;
  const mangaTitle = params.mangaTitle as string;
  const mangaCover = params.mangaCover as string;
  const mangaUrl = params.mangaUrl as string;

  const chapters = useMangaHistoryDetails(sourceId, mangaId);
  const removeEntry = useRemoveHistoryEntry();
  const removeMangaHistory = useRemoveMangaHistory();

  const foregroundColor = useCSSVariable("--color-foreground");
  const foreground =
    typeof foregroundColor === "string" ? foregroundColor : "#fff";
  const mutedColor = useCSSVariable("--color-muted");
  const muted = typeof mutedColor === "string" ? mutedColor : "#71717a";

  const handleContinueReading = (item: ChapterHistoryItemProps["item"]) => {
    router.push({
      pathname: "/(main)/reader/[chapterId]",
      params: {
        chapterId: item.chapterId,
        sourceId: sourceId,
        url: item.chapterUrl,
        mangaUrl: mangaUrl || "",
        mangaId: mangaId,
        mangaTitle: mangaTitle,
        mangaCover: mangaCover || "",
        chapterNumber: item.chapterNumber.toString(),
        chapterTitle: item.chapterTitle || "",
      },
    });
  };

  const handleClearMangaHistory = () => {
    Alert.alert(
      "Delete Manga History",
      `Are you sure you want to delete all reading history for "${mangaTitle}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            removeMangaHistory(sourceId, mangaId);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-background">
      {/* Compact Manga Info Card */}
      <View className="bg-surface border-b border-border px-4 py-3">
        <View className="flex-row items-center">
          {/* Compact Cover */}
          <View className="w-12 h-16 rounded-md bg-background overflow-hidden mr-3">
            {mangaCover ? (
              <Image
                source={{ uri: mangaCover }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Ionicons name="book-outline" size={20} color={muted} />
              </View>
            )}
          </View>

          {/* Info */}
          <View className="flex-1">
            <Text className="text-muted text-xs mb-0.5">
              Source: {sourceId}
            </Text>
            <Text className="text-foreground text-sm font-medium">
              {chapters.length} chapter{chapters.length !== 1 ? "s" : ""} read
            </Text>
          </View>

          {/* Delete Button */}
          <Pressable
            onPress={handleClearMangaHistory}
            hitSlop={8}
            className="p-2 -mr-2"
          >
            <Ionicons name="trash-outline" size={20} color={foreground} />
          </Pressable>
        </View>
      </View>

      {/* Chapter List */}
      {chapters.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <EmptyState
            icon="time-outline"
            title="No chapters"
            description="No reading history for this manga"
          />
        </View>
      ) : (
        <FlatList
          data={chapters}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          renderItem={({ item }) => (
            <ChapterHistoryItem
              item={item}
              onPress={() => handleContinueReading(item)}
              onRemove={() => removeEntry(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}
