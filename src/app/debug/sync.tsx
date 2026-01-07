import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { SyncService } from "@/core/sync";
import type { SyncEvent } from "@/core/sync/SyncTypes";

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleString();
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  return `${hours}h ago`;
}

function getEventTypeColor(type: string): string {
  switch (type) {
    case "manga_added":
      return "#22c55e"; // green
    case "manga_removed":
      return "#ef4444"; // red
    case "manga_updated":
      return "#3b82f6"; // blue
    case "chapter_read":
      return "#a855f7"; // purple
    case "chapter_unread":
      return "#f59e0b"; // amber
    case "progress_updated":
      return "#06b6d4"; // cyan
    case "history_added":
      return "#8b5cf6"; // violet
    default:
      return "#71717a"; // muted
  }
}

export default function DebugSyncScreen() {
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadEvents = () => {
    setEvents(SyncService.getQueue());
  };

  useEffect(() => {
    loadEvents();
    // Subscribe to state changes to refresh
    const unsubscribe = SyncService.subscribe(() => {
      loadEvents();
    });
    return unsubscribe;
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleFlush = async () => {
    Alert.alert(
      "Flush Sync Queue",
      "This will immediately sync all pending events to Firebase.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Flush",
          onPress: async () => {
            setSyncing(true);
            try {
              await SyncService.flush();
              loadEvents();
              Alert.alert("Success", "Sync queue flushed successfully.");
            } catch (e) {
              Alert.alert("Error", (e as Error).message);
            } finally {
              setSyncing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 border-b border-border">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-foreground text-xl font-bold">
              Sync Debug
            </Text>
            <Text className="text-muted text-xs mt-1">
              {events.length} pending event{events.length !== 1 ? "s" : ""}
            </Text>
          </View>
          {events.length > 0 && (
            <Pressable
              onPress={handleFlush}
              disabled={syncing}
              className="bg-primary px-3 py-2 rounded-lg"
              style={{ opacity: syncing ? 0.6 : 1 }}
            >
              <Text className="text-background font-medium text-sm">
                {syncing ? "Syncing..." : "Flush Now"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {events.length === 0 ? (
          <View className="p-4 items-center mt-8">
            <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
            <Text className="text-muted text-center mt-4">
              No pending sync events
            </Text>
            <Text className="text-muted text-xs text-center mt-1">
              All changes have been synced to Firebase
            </Text>
          </View>
        ) : (
          events.map((event) => (
            <View key={event.id} className="border-b border-border/30">
              {/* Event Header */}
              <Pressable
                onPress={() => toggleExpand(event.id)}
                className="p-4 flex-row items-center justify-between"
              >
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <View
                      className="px-2 py-0.5 rounded"
                      style={{ backgroundColor: getEventTypeColor(event.type) }}
                    >
                      <Text className="text-white text-xs font-bold">
                        {event.type.replace("_", " ").toUpperCase()}
                      </Text>
                    </View>
                    <Text className="text-muted text-xs">
                      {formatTimeAgo(event.timestamp)}
                    </Text>
                  </View>
                  <Text
                    className="text-foreground text-sm mt-1"
                    numberOfLines={1}
                  >
                    {event.entityId}
                  </Text>
                </View>
                <Ionicons
                  name={expandedId === event.id ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#71717a"
                />
              </Pressable>

              {/* Expanded Details */}
              {expandedId === event.id && (
                <View className="px-4 pb-4 bg-surface/30">
                  <Text className="text-primary text-xs font-bold">
                    EVENT DETAILS
                  </Text>
                  <View className="mt-2">
                    <Text className="text-muted text-xs">ID: {event.id}</Text>
                    <Text className="text-muted text-xs">
                      Timestamp: {formatTimestamp(event.timestamp)}
                    </Text>
                  </View>

                  {event.data && (
                    <>
                      <Text className="text-primary text-xs font-bold mt-3">
                        DATA PAYLOAD
                      </Text>
                      <View className="bg-surface p-2 rounded mt-1">
                        <Text className="text-muted text-xs font-mono">
                          {JSON.stringify(event.data, null, 2)}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          ))
        )}

        {/* Refresh Button */}
        <Pressable onPress={loadEvents} className="mx-4 mt-4 py-3 items-center">
          <Text className="text-primary text-sm">Refresh</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
