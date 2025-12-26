import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { useSyncStore } from "@/features/Library/stores/useSyncStore";

type SettingItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
};

function SettingItem({ icon, title, subtitle, onPress }: SettingItemProps) {
  const mutedColor = useCSSVariable("--color-muted");
  const muted = typeof mutedColor === "string" ? mutedColor : "#71717a";

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-4 active:bg-surface/50"
    >
      <View className="w-10 h-10 bg-surface rounded-lg items-center justify-center mr-3">
        <Ionicons name={icon} size={20} color={muted} />
      </View>
      <View className="flex-1">
        <Text className="text-foreground font-medium">{title}</Text>
        {subtitle && (
          <Text className="text-muted text-xs mt-0.5">{subtitle}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={muted} />
    </Pressable>
  );
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function SyncHistorySection() {
  const { lastSync, syncHistory, clearHistory } = useSyncStore();
  const primaryColor = useCSSVariable("--color-primary");
  const primary = typeof primaryColor === "string" ? primaryColor : "#00d9ff";
  const mutedColor = useCSSVariable("--color-muted");
  const muted = typeof mutedColor === "string" ? mutedColor : "#71717a";

  if (!lastSync) {
    return (
      <View className="px-4 py-4">
        <Text className="text-muted text-sm">No sync history yet</Text>
      </View>
    );
  }

  return (
    <View className="px-4 py-3">
      {/* Last Sync Summary */}
      <View className="bg-surface rounded-lg p-4 mb-3">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-foreground font-medium">Last Sync</Text>
          <Text className="text-muted text-xs">
            {formatTimeAgo(lastSync.timestamp)}
          </Text>
        </View>

        <View className="flex-row gap-4">
          <View className="flex-1">
            <Text style={{ color: primary }} className="text-2xl font-bold">
              {lastSync.updated}
            </Text>
            <Text className="text-muted text-xs">manga updated</Text>
          </View>
          <View className="flex-1">
            <Text style={{ color: primary }} className="text-2xl font-bold">
              {lastSync.newChapters}
            </Text>
            <Text className="text-muted text-xs">new chapters</Text>
          </View>
        </View>

        {/* Failed */}
        {lastSync.failed.length > 0 && (
          <View className="mt-3 pt-3 border-t border-border">
            <Text className="text-red-500 text-sm font-medium mb-1">
              ⚠️ {lastSync.failed.length} failed
            </Text>
            {lastSync.failed.slice(0, 3).map((f, i) => (
              <Text key={i} className="text-muted text-xs">
                • {f.mangaTitle}: {f.error}
              </Text>
            ))}
          </View>
        )}

        {/* Skipped Sources */}
        {lastSync.skippedSources.length > 0 && (
          <View className="mt-3 pt-3 border-t border-border">
            <Text className="text-yellow-500 text-sm font-medium mb-1">
              ⏭️ {lastSync.skippedSources.length} sources skipped
            </Text>
            {lastSync.skippedSources.map((s, i) => (
              <Text key={i} className="text-muted text-xs">
                • {s} (session expired)
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* Clear History */}
      {syncHistory.length > 0 && (
        <Pressable onPress={clearHistory} className="py-2">
          <Text className="text-red-500 text-sm text-center">
            Clear sync history
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      <View
        className="px-4 border-b border-border"
        style={{ paddingTop: insets.top + 8, paddingBottom: 12 }}
      >
        <Text className="text-foreground text-2xl font-bold">More</Text>
        <Text className="text-muted text-sm mt-1">Settings & preferences</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Sync History Section */}
        <View className="mt-4">
          <Text className="text-muted text-xs font-bold uppercase px-4 mb-2">
            Sync History
          </Text>
          <SyncHistorySection />
        </View>

        {/* Debug Section */}
        <View className="mt-4">
          <Text className="text-muted text-xs font-bold uppercase px-4 mb-2">
            Developer
          </Text>
          <SettingItem
            icon="bug-outline"
            title="Debug Realm Database"
            subtitle="View all stored manga and chapters"
            onPress={() => router.push("/(tabs)/debug")}
          />
        </View>
      </ScrollView>
    </View>
  );
}
