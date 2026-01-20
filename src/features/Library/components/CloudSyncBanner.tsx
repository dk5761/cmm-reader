/**
 * CloudSyncBanner - Shows cloud sync progress on app startup
 * Displays when syncing with cloud service (for future implementation)
 */

import { View, Text } from "react-native";
import { useSyncStore } from "../stores/useSyncStore";

export function CloudSyncBanner() {
  const { isCloudSyncing, cloudSyncStatus } = useSyncStore();

  if (!isCloudSyncing) return null;

  return (
    <View className="mx-4 mb-4 bg-blue-500/15 border border-blue-500/30 rounded-lg overflow-hidden">
      <View className="p-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-blue-400 text-sm font-semibold">
            ☁️ {cloudSyncStatus || "Syncing with cloud..."}
          </Text>
        </View>
      </View>
    </View>
  );
}
