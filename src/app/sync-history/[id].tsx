import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { useSyncStore } from "@/features/Library/stores/useSyncStore";
import { MangaSyncListItem } from "@/features/Library/components/MangaSyncListItem";
import { useState } from "react";

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

export default function SyncHistoryDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { syncHistory } = useSyncStore();
  const [selectedMangaId, setSelectedMangaId] = useState<string | null>(null);

  const syncIndex = parseInt(id || "0");

  if (isNaN(syncIndex) || syncIndex < 0 || syncIndex >= syncHistory.length) {
    return (
      <View className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#71717a" />
          <Text className="text-foreground mt-4 font-medium">Sync not found</Text>
          <Text className="text-muted text-sm mt-2 text-center">
            The sync operation you're looking for doesn't exist.
          </Text>
        </View>
      </View>
    );
  }

  const sync = syncHistory[syncIndex];
  const primaryColor = useCSSVariable("--color-primary");
  const primary = typeof primaryColor === "string" ? primaryColor : "#00d9ff";

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Summary Section */}
        <View className="px-4 py-4 bg-surface/50">
          <Text className="text-foreground font-medium mb-2">
            {formatTimeAgo(sync.timestamp)}
          </Text>
          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text style={{ color: primary }} className="text-2xl font-bold">
                {sync.updated}
              </Text>
              <Text className="text-muted text-xs">Updated manga</Text>
            </View>
            <View className="flex-1">
              <Text style={{ color: primary }} className="text-2xl font-bold">
                {sync.newChapters}
              </Text>
              <Text className="text-muted text-xs">New chapters</Text>
            </View>
          </View>
        </View>

        {/* Updated Manga */}
        {sync.mangaUpdates.length > 0 && (
          <View className="mt-2">
            <Text className="px-4 py-2 text-muted text-xs font-bold uppercase">
              Updated Manga ({sync.mangaUpdates.length})
            </Text>
            {sync.mangaUpdates.map((update) => (
              <MangaSyncListItem
                key={update.mangaId}
                update={update}
                onPress={() => setSelectedMangaId(update.mangaId)}
              />
            ))}
          </View>
        )}

        {/* Failed Items */}
        {sync.failed.length > 0 && (
          <View className="mt-4 px-4 py-3 ml-4 mr-4 bg-red-500/10 rounded-lg">
            <Text className="text-red-500 text-sm font-bold mb-2">
              Failed Syncs ({sync.failed.length})
            </Text>
            {sync.failed.map((failure, idx) => (
              <View key={idx} className="mb-2 last:mb-0">
                <Text className="text-foreground text-sm font-medium">
                  {failure.mangaTitle}
                </Text>
                <Text className="text-red-400 text-xs">{failure.error}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Skipped Sources */}
        {sync.skippedSources.length > 0 && (
          <View className="mt-4 px-4 py-3 ml-4 mr-4 bg-yellow-500/10 rounded-lg">
            <Text className="text-yellow-500 text-sm font-bold mb-2">
              Skipped Sources ({sync.skippedSources.length})
            </Text>
            {sync.skippedSources.map((source, idx) => (
              <Text key={idx} className="text-muted text-xs mb-1 last:mb-0">
                • {source} (session expired)
              </Text>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Details Modal */}
      {selectedMangaId && (
        <Pressable
          className="absolute inset-0 bg-black/60"
          onPress={() => setSelectedMangaId(null)}
        >
          <View
            className="rounded-t-3xl bg-card border-t border-border p-6 mt-auto"
            style={{ paddingBottom: insets.bottom + 16 }}
          >
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-foreground font-bold text-lg">Sync Details</Text>
              <Pressable onPress={() => setSelectedMangaId(null)}>
                <Ionicons name="close" size={24} color="#71717a" />
              </Pressable>
            </View>
            <Text className="text-muted text-sm text-center">
              Manga sync details modal would be shown here.
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}