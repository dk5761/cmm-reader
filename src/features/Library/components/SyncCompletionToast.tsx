/**
 * SyncCompletionToast - Shows sync completion summary
 * Auto-dismisses after a few seconds
 */

import { useEffect, useState } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSyncStore } from "../stores/useSyncStore";

export function SyncCompletionToast() {
  const { lastSync, isSyncing } = useSyncStore();
  const [visible, setVisible] = useState(false);
  const [wasJustSyncing, setWasJustSyncing] = useState(false);
  const fadeAnim = useState(() => new Animated.Value(0))[0];

  // Track if we were syncing
  useEffect(() => {
    if (isSyncing) {
      setWasJustSyncing(true);
    }
  }, [isSyncing]);

  // Show toast when sync completes (isSyncing goes from true to false)
  useEffect(() => {
    if (wasJustSyncing && !isSyncing && lastSync) {
      console.log("[Toast] Sync completed, showing toast");
      setWasJustSyncing(false);
      setVisible(true);

      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isSyncing, wasJustSyncing, lastSync, fadeAnim]);

  // Auto-dismiss after 5 seconds when visible
  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }, 5000);

    return () => clearTimeout(timer);
  }, [visible, fadeAnim]);

  const dismissToast = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  if (!visible || !lastSync) return null;

  const hasNewChapters = lastSync.newChapters > 0;
  const hasFailures = lastSync.failed.length > 0;
  const hasSkipped = lastSync.skippedSources.length > 0;

  return (
    <Animated.View
      style={{ opacity: fadeAnim }}
      className="mx-4 mb-4 rounded-lg overflow-hidden"
    >
      <View
        className={`p-3 rounded-lg ${
          hasNewChapters
            ? "bg-green-500/15 border border-green-500/30"
            : hasFailures
            ? "bg-destructive/15 border border-destructive/30"
            : "bg-primary/15 border border-primary/30"
        }`}
      >
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Ionicons
                name={hasNewChapters ? "checkmark-circle" : "sync-circle"}
                size={18}
                color={hasNewChapters ? "#22c55e" : "#00d9ff"}
              />
              <Text
                className={`font-semibold ${
                  hasNewChapters ? "text-green-500" : "text-primary"
                }`}
              >
                {hasNewChapters ? "New chapters found!" : "Sync complete"}
              </Text>
            </View>

            <Text className="text-muted text-xs mt-1">
              {lastSync.updated > 0
                ? `${lastSync.updated} updated • ${lastSync.newChapters} new chapters`
                : "Library is up to date"}
            </Text>

            {hasSkipped && (
              <Text className="text-muted text-xs mt-0.5">
                ⚠️ Skipped: {lastSync.skippedSources.join(", ")}
              </Text>
            )}

            {hasFailures && (
              <Text className="text-destructive text-xs mt-0.5">
                ❌ {lastSync.failed.length} failed
              </Text>
            )}
          </View>

          <Pressable onPress={dismissToast} hitSlop={8} className="p-1">
            <Ionicons name="close" size={18} color="#888" />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
