import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { useSyncStore } from "@/features/Library/stores/useSyncStore";
import { EmptyState } from "@/shared/components";

export default function SyncHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { syncHistory } = useSyncStore();

  const handlePressSync = (index: number) => {
    router.push({
      pathname: '/(tabs)/settings/sync/[id]',
      params: { id: index.toString() }
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: "Sync History" }} />
      <View className="flex-1 bg-background">
        {syncHistory.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <EmptyState
              icon="sync"
              title="No sync history"
              description="Sync your library to see updates here"
            />
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingTop: 16,
              paddingBottom: insets.bottom + 32
            }}
          >
            {syncHistory.map((sync, index) => (
              <SyncSummaryCard
                key={sync.timestamp}
                sync={sync}
                index={index}
                onPress={() => handlePressSync(index)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </>
  );
}

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

type SyncSummaryCardProps = {
  sync: {
    timestamp: number;
    updated: number;
    newChapters: number;
    failed: Array<{ mangaTitle: string; error: string }>;
    skippedSources: string[];
  };
  index: number;
  onPress: () => void;
};

function SyncSummaryCard({ sync, index, onPress }: SyncSummaryCardProps) {
  const primaryColor = useCSSVariable("--color-primary");
  const primary = typeof primaryColor === "string" ? primaryColor : "#00d9ff";
  const mutedColor = useCSSVariable("--color-muted");
  const muted = typeof mutedColor === "string" ? mutedColor : "#71717a";

  const hasFailed = sync.failed.length > 0;
  const hasSkipped = sync.skippedSources.length > 0;

  return (
    <Pressable
      onPress={onPress}
      className="mx-4 mt-2 bg-card rounded-xl overflow-hidden active:bg-surface/50"
    >
      <View className="p-4">
        <View className="flex-row justify-between items-start mb-3">
          <View>
            <Text className="text-foreground font-medium">
              Sync #{index + 1}
            </Text>
            <Text className="text-muted text-xs mt-0.5">
              {formatTimeAgo(sync.timestamp)}
            </Text>
          </View>
          <View
            className={`px-2 py-1 rounded-full ${hasFailed
              ? "bg-red-500/20"
              : hasSkipped
                ? "bg-yellow-500/20"
                : "bg-green-500/20"
              }`}
          >
            <Text
              className={`text-xs font-medium ${hasFailed
                ? "text-red-500"
                : hasSkipped
                  ? "text-yellow-500"
                  : "text-green-500"
                }`}
            >
              {hasFailed
                ? "Issues"
                : hasSkipped
                  ? "Partial"
                  : "Success"}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-6">
          <View className="flex-1">
            <Text style={{ color: primary }} className="text-2xl font-bold">
              {sync.updated}
            </Text>
            <Text className="text-muted text-xs">Updated</Text>
          </View>
          <View className="flex-1">
            <Text style={{ color: primary }} className="text-2xl font-bold">
              {sync.newChapters}
            </Text>
            <Text className="text-muted text-xs">New chapters</Text>
          </View>
          <View className="flex-1">
            <Text
              className={`text-2xl font-bold ${hasFailed ? "text-red-500" : "text-muted"}`}
            >
              {sync.failed.length}
            </Text>
            <Text className="text-muted text-xs">Failed</Text>
          </View>
          <View className="flex-1">
            <Text
              className={`text-2xl font-bold ${hasSkipped ? "text-yellow-500" : "text-muted"}`}
            >
              {sync.skippedSources.length}
            </Text>
            <Text className="text-muted text-xs">Skipped</Text>
          </View>
        </View>
      </View>

      <View className="px-4 pb-3 pt-2 border-t border-border">
        <View className="flex-row items-center">
          <Ionicons name="chevron-forward" size={16} color={muted} />
          <Text className="text-muted text-xs ml-1">View details</Text>
        </View>
      </View>
    </Pressable>
  );
}