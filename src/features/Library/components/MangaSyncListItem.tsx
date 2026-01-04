import { Pressable, View, Text, Image } from "react-native";
import { useCSSVariable } from "uniwind";
import type { MangaSyncUpdate } from "../stores/useSyncStore";

type MangaSyncListItemProps = {
  update: MangaSyncUpdate;
  onPress: () => void;
};

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function MangaSyncListItem({ update, onPress }: MangaSyncListItemProps) {
  const primaryColor = useCSSVariable("--color-primary");
  const primary = typeof primaryColor === "string" ? primaryColor : "#00d9ff";

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 active:bg-surface/50"
    >
      {/* Cover */}
      <View className="w-12 h-16 bg-surface rounded overflow-hidden mr-3">
        {update.cover ? (
          <Image
            source={{ uri: update.cover }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Text className="text-muted text-xs">No cover</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View className="flex-1">
        <Text className="text-foreground font-medium" numberOfLines={1}>
          {update.mangaTitle}
        </Text>
        <Text className="text-muted text-xs mt-0.5">{update.sourceName}</Text>
        <View className="flex-row items-center mt-1">
          <Text style={{ color: primary }} className="text-sm font-medium">
            +{update.newChapters.length} chapter
            {update.newChapters.length > 1 ? "s" : ""}
          </Text>
          <Text className="text-muted text-xs ml-2">
            • {formatTimeAgo(update.syncedAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
