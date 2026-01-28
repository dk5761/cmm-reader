/**
 * Sync Status Indicator
 *
 * Displays the current sync state to the user.
 * Shows different states: syncing, synced, error, paused.
 */

import { View, Text, ActivityIndicator } from "react-native";
import { useCSSVariable } from "uniwind";
import { Ionicons } from "@expo/vector-icons";
import { useSyncStatus } from "@/core/sync";

export function SyncStatusIndicator() {
  const { isSyncing, lastSyncTime } = useSyncStatus();
  const mutedColor = useCSSVariable("--color-muted");
  const muted = typeof mutedColor === "string" ? mutedColor : "#71717a";

  if (!isSyncing && !lastSyncTime) {
    return null; // Don't show if never synced
  }

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <View className="flex-row items-center gap-2 px-3 py-1.5 bg-surface/50 rounded-full">
      {isSyncing ? (
        <>
          <ActivityIndicator size="small" color={muted} />
          <Text className="text-xs text-muted">Syncing...</Text>
        </>
      ) : lastSyncTime ? (
        <>
          <Ionicons name="checkmark-circle" size={16} color={muted} />
          <Text className="text-xs text-muted">Synced {formatTimeAgo(lastSyncTime)}</Text>
        </>
      ) : null}
    </View>
  );
}
