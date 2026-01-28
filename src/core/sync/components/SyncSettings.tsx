/**
 * Sync Settings
 *
 * Settings section for controlling sync behavior.
 * Displays sync status, last sync time, and provides manual controls.
 */

import { useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { useSyncManager, useSyncStatus } from "@/core/sync";
import { isFirebaseConfigured } from "@/core/sync";
import type { SyncQueueStats } from "@/core/sync/types/events.types";

export function SyncSettings() {
  const { isSyncing, isPaused, lastSyncTime, syncStats, syncNow, pauseSync, resumeSync, clearQueue } = useSyncManager();
  const [syncing, setSyncing] = useState(false);

  const isConfigured = isFirebaseConfigured();

  const handleSyncNow = async () => {
    if (syncing || isSyncing) return;
    setSyncing(true);
    try {
      await syncNow();
    } finally {
      setSyncing(false);
    }
  };

  const handleClearQueue = async () => {
    Alert.alert(
      "Clear Sync Queue",
      "This will clear all pending sync events. Any unsynced changes will be lost. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await clearQueue();
          },
        },
      ]
    );
  };

  const formatTimeAgo = (timestamp: number | null): string => {
    if (!timestamp) return "Never";
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

  // Firebase config warning
  if (!isConfigured) {
    return (
      <View className="px-4 py-6">
        <View className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
          <Text className="text-yellow-500 text-sm font-medium mb-1">⚠️ Firebase Not Configured</Text>
          <Text className="text-muted text-xs">
            Cloud sync is disabled. To enable sync, add your Firebase config to{" "}
            <Text className="text-yellow-500 font-medium">src/core/sync/firebase/firebaseConfig.ts</Text>
          </Text>
        </View>

        <View className="items-center py-8">
          <Ionicons name="cloud-offline" size={48} color="#71717a" />
          <Text className="text-muted mt-4 text-center">Cloud sync is not available</Text>
        </View>
      </View>
    );
  }

  // Configured - show sync controls
  return (
    <View className="px-4 py-2">
      {/* Sync Status */}
      <View className="mb-6">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-foreground font-medium">Sync Status</Text>
          {isPaused ? (
            <Text className="text-yellow-500 text-xs">Paused</Text>
          ) : isSyncing ? (
            <Text className="text-primary text-xs">Syncing...</Text>
          ) : (
            <Text className="text-green-500 text-xs">Synced</Text>
          )}
        </View>

        {lastSyncTime && (
          <Text className="text-muted text-xs mb-3">
            Last synced: {formatTimeAgo(lastSyncTime)}
          </Text>
        )}

        {/* Action Buttons */}
        {isPaused ? (
          <Pressable onPress={resumeSync} className="bg-primary px-4 py-3 rounded-lg mb-3">
            <Text className="text-black font-semibold text-center text-sm">Resume Sync</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSyncNow}
            disabled={isSyncing || syncing}
            className="bg-surface border border-border px-4 py-3 rounded-lg mb-3"
            style={{ opacity: (isSyncing || syncing) ? 0.6 : 1 }}
          >
            <Text className="text-foreground font-semibold text-center text-sm">
              {syncing ? "Syncing..." : "Sync Now"}
            </Text>
          </Pressable>
        )}

        <Pressable onPress={pauseSync} className="px-4 py-2">
          <Text className="text-muted text-xs text-center">
            {isPaused ? "Resume automatic sync" : "Pause automatic sync"}
          </Text>
        </Pressable>
      </View>

      {/* Sync Queue Stats */}
      {syncStats && syncStats.total > 0 && (
        <View className="mb-6 p-4 bg-surface/50 rounded-lg">
          <Text className="text-muted text-xs font-bold uppercase mb-2">Pending Sync Events</Text>

          <View className="grid grid-cols-2 gap-3 mb-3">
            <View>
              <Text className="text-2xl font-bold text-foreground">{syncStats.total}</Text>
              <Text className="text-muted text-xs">Total</Text>
            </View>
            <View>
              <Text className="text-2xl font-bold text-primary">{syncStats.byPriority.high}</Text>
              <Text className="text-muted text-xs">High Priority</Text>
            </View>
          </View>

          <View className="h-px bg-border mb-3" />

          <View className="grid grid-cols-2 gap-3">
            <View>
              <Text className="text-lg font-semibold text-foreground">{syncStats.byType.manga}</Text>
              <Text className="text-muted text-xs">Manga</Text>
            </View>
            <View>
              <Text className="text-lg font-semibold text-foreground">{syncStats.byType.chapter}</Text>
              <Text className="text-muted text-xs">Chapters</Text>
            </View>
          </View>

          <Pressable onPress={handleClearQueue} className="mt-2">
            <Text className="text-red-500 text-xs text-center">Clear Queue</Text>
          </Pressable>
        </View>
      )}

      {/* Info Section */}
      <View className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <Text className="text-blue-500 text-xs font-medium mb-1">About Sync</Text>
        <Text className="text-muted text-xs leading-relaxed">
          Cloud sync keeps your library, reading progress, and categories synchronized across all your devices. Changes are automatically synced when connected to the internet.
        </Text>
      </View>
    </View>
  );
}

/**
 * Sync Status Pill
 * Compact badge showing sync state
 */
export function SyncStatusPill() {
  const { isSyncing } = useSyncStatus();

  return (
    <>
      {isSyncing ? (
        <View className="flex-row items-center gap-1 px-2 py-1 bg-primary/20 rounded-full">
          <ActivityIndicator size={12} />
          <Text className="text-xs text-primary font-medium">Syncing</Text>
        </View>
      ) : null}
    </>
  );
}
