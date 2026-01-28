/**
 * Sync Progress Banner
 *
 * Shows a banner when sync is in progress.
 * Displays current sync activity and dismiss action.
 */

import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useCSSVariable } from "uniwind";
import { Ionicons } from "@expo/vector-icons";
import { useSyncManager } from "@/core/sync";
import { useState } from "react";

export function SyncProgressBanner() {
  const { isSyncing, isPaused } = useSyncManager();
  const [dismissed, setDismissed] = useState(false);

  if (!isSyncing || isPaused || dismissed) {
    return null;
  }

  return (
    <View className="mx-4 mb-2 bg-primary/10 border border-primary/30 rounded-lg p-3 flex-row items-center justify-between">
      <View className="flex-row items-center gap-3 flex-1">
        <ActivityIndicator size="small" />
        <View className="flex-1">
          <Text className="text-primary font-medium text-sm">Syncing your library...</Text>
          <Text className="text-muted text-xs">This may take a moment</Text>
        </View>
      </View>

      <Pressable onPress={() => setDismissed(true)} hitSlop={8}>
        <Ionicons name="close-circle" size={20} color="#71717a" />
      </Pressable>
    </View>
  );
}

/**
 * Sync Error Toast
 *
 * Shows an error message when sync fails.
 */
export function SyncErrorToast({ error, onDismiss }: { error: Error; onDismiss: () => void }) {
  return (
    <View className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-2">
      <View className="flex-row items-start gap-3">
        <Ionicons name="warning" size={20} color="#ef4444" />
        <View className="flex-1">
          <Text className="text-red-500 font-medium text-sm mb-1">Sync Error</Text>
          <Text className="text-muted text-xs">{error.message}</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={20} color="#71717a" />
        </Pressable>
      </View>
    </View>
  );
}
