import {
  View,
  Text,
  Pressable,
  FlatList,
  Alert,
  Animated as RNAnimated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useCSSVariable } from "uniwind";
import { Swipeable, RectButton } from "react-native-gesture-handler";
import { useRef } from "react";
import {
  useGroupedMangaHistory,
  useRemoveMangaHistory,
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

type MangaHistoryItemProps = {
  item: {
    uniqueKey: string;
    sourceId: string;
    mangaId: string;
    mangaTitle: string;
    mangaCover?: string;
    mangaUrl?: string;
    latestChapterNumber: number;
    latestChapterTitle?: string;
    latestTimestamp: number;
    chaptersReadCount: number;
    latestPageReached: number;
    latestTotalPages?: number;
  };
  onPress: () => void;
  onRemove: () => void;
};

function MangaHistoryItem({ item, onPress, onRemove }: MangaHistoryItemProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const mutedColor = useCSSVariable("--color-muted");
  const muted = typeof mutedColor === "string" ? mutedColor : "#71717a";
  const primaryColor = useCSSVariable("--color-primary");
  const primary = typeof primaryColor === "string" ? primaryColor : "#00d9ff";

  const isCompleted =
    item.latestTotalPages && item.latestPageReached >= item.latestTotalPages;

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
        className="flex-row px-4 py-3 active:bg-surface/50 border-b border-border bg-background"
        android_ripple={{ color: "rgba(255,255,255,0.1)" }}
      >
        {/* Cover */}
        <View className="w-14 h-20 rounded-lg bg-surface overflow-hidden mr-3">
          {item.mangaCover ? (
            <Image
              source={{ uri: item.mangaCover }}
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
        <View className="flex-1 justify-center">
          <Text className="text-foreground font-medium" numberOfLines={1}>
            {item.mangaTitle}
          </Text>
          <Text className="text-muted text-sm mt-0.5" numberOfLines={1}>
            Source: {item.sourceId}
          </Text>
          <View className="flex-row items-center gap-2 mt-1">
            <Text className="text-muted text-xs">
              Last: Ch. {item.latestChapterNumber}
            </Text>
            <Text className="text-muted text-xs">•</Text>
            <View className="flex-row items-center gap-1">
              <Ionicons name="book" size={12} color={muted} />
              <Text className="text-muted text-xs">
                {item.chaptersReadCount} read
              </Text>
            </View>
            <Text className="text-muted text-xs">•</Text>
            <Text className="text-muted text-xs">
              {formatTimeAgo(item.latestTimestamp)}
            </Text>
          </View>
        </View>

        {/* Continue Arrow */}
        <View className="justify-center">
          <Ionicons name="chevron-forward" size={24} color={muted} />
        </View>
      </Pressable>
    </Swipeable>
  );
}

export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const groupedManga = useGroupedMangaHistory();
  const removeMangaHistory = useRemoveMangaHistory();
  const clearHistory = useClearHistory();

  const foregroundColor = useCSSVariable("--color-foreground");
  const foreground =
    typeof foregroundColor === "string" ? foregroundColor : "#fff";

  const handleMangaPress = (item: MangaHistoryItemProps["item"]) => {
    router.push({
      pathname: "/history/[mangaId]",
      params: {
        mangaId: item.mangaId,
        sourceId: item.sourceId,
        mangaTitle: item.mangaTitle,
        mangaCover: item.mangaCover || "",
        mangaUrl: item.mangaUrl || "",
      },
    });
  };

  const handleClearAllHistory = () => {
    Alert.alert(
      "Clear All History",
      "Are you sure you want to delete all reading history? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: clearHistory,
        },
      ]
    );
  };

  const isEmpty = groupedManga.length === 0;

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
          <Pressable
            onPress={handleClearAllHistory}
            hitSlop={8}
            className="p-2"
          >
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
        <FlatList
          data={groupedManga}
          keyExtractor={(item) => item.uniqueKey}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          renderItem={({ item }) => (
            <MangaHistoryItem
              item={item}
              onPress={() => handleMangaPress(item)}
              onRemove={() => removeMangaHistory(item.sourceId, item.mangaId)}
            />
          )}
        />
      )}
    </View>
  );
}
