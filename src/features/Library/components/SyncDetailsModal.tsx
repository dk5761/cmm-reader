import { useState } from "react";
import { Modal, View, Text, Pressable, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import type { SyncResult, MangaSyncUpdate } from "../stores/useSyncStore";

type SyncDetailsModalProps = {
  visible: boolean;
  onClose: () => void;
  mangaId: string;
  syncHistory: SyncResult[];
};

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatChapterNumber(num: number): string {
  return num % 1 === 0 ? num.toString() : num.toFixed(1);
}

export function SyncDetailsModal({
  visible,
  onClose,
  mangaId,
  syncHistory,
}: SyncDetailsModalProps) {
  const [expandedSyncIndex, setExpandedSyncIndex] = useState<number | null>(0);
  const primaryColor = useCSSVariable("--color-primary");
  const primary = typeof primaryColor === "string" ? primaryColor : "#00d9ff";
  const mutedColor = useCSSVariable("--color-muted");
  const muted = typeof mutedColor === "string" ? mutedColor : "#71717a";

  // Filter sync history for this manga
  const mangaSyncHistory: Array<{
    syncTimestamp: number;
    update: MangaSyncUpdate;
  }> = syncHistory
    .map((syncResult) => {
      const update = syncResult.mangaUpdates.find((u) => u.mangaId === mangaId);
      if (!update) return null;
      return {
        syncTimestamp: syncResult.timestamp,
        update,
      };
    })
    .filter(
      (item): item is { syncTimestamp: number; update: MangaSyncUpdate } =>
        item !== null
    );

  if (mangaSyncHistory.length === 0) {
    return null;
  }

  const latestUpdate = mangaSyncHistory[0].update;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="px-4 py-4 border-b border-border flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            {latestUpdate.cover && (
              <Image
                source={{ uri: latestUpdate.cover }}
                className="w-12 h-16 rounded mr-3"
                resizeMode="cover"
              />
            )}
            <View className="flex-1">
              <Text
                className="text-foreground text-lg font-bold"
                numberOfLines={2}
              >
                {latestUpdate.mangaTitle}
              </Text>
              <Text className="text-muted text-sm">
                {latestUpdate.sourceName}
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} className="p-2" hitSlop={8}>
            <Ionicons name="close" size={24} color={muted} />
          </Pressable>
        </View>

        <ScrollView className="flex-1">
          {/* Sync History List */}
          {mangaSyncHistory.map((item, index) => {
            const isExpanded = expandedSyncIndex === index;
            const isLatest = index === 0;

            return (
              <View key={index} className="border-b border-border">
                {/* Sync Header */}
                <Pressable
                  onPress={() =>
                    setExpandedSyncIndex(isExpanded ? null : index)
                  }
                  className="px-4 py-4 flex-row items-center justify-between active:bg-surface/30"
                >
                  <View className="flex-1">
                    <View className="flex-row items-center mb-1">
                      {isLatest && (
                        <View
                          className="px-2 py-0.5 rounded mr-2"
                          style={{ backgroundColor: `${primary}20` }}
                        >
                          <Text
                            style={{ color: primary }}
                            className="text-xs font-medium"
                          >
                            Latest
                          </Text>
                        </View>
                      )}
                      <Text className="text-foreground font-medium">
                        {formatDateTime(item.syncTimestamp)}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Text
                        style={{ color: primary }}
                        className="text-sm font-medium"
                      >
                        +{item.update.newChapters.length} chapter
                        {item.update.newChapters.length > 1 ? "s" : ""}
                      </Text>
                      <Text className="text-muted text-xs ml-2">
                        • {item.update.previousChapterCount} →{" "}
                        {item.update.currentChapterCount} total
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={muted}
                  />
                </Pressable>

                {/* Expanded Chapter List */}
                {isExpanded && (
                  <View className="px-4 pb-3 bg-surface/30">
                    {item.update.newChapters
                      .sort((a, b) => b.chapterNumber - a.chapterNumber)
                      .map((chapter, chIndex) => (
                        <View
                          key={chIndex}
                          className="py-2 border-b border-border/50 last:border-b-0"
                        >
                          <Text className="text-foreground font-medium">
                            Chapter {formatChapterNumber(chapter.chapterNumber)}
                          </Text>
                          {chapter.chapterTitle && (
                            <Text
                              className="text-muted text-sm mt-0.5"
                              numberOfLines={1}
                            >
                              {chapter.chapterTitle}
                            </Text>
                          )}
                        </View>
                      ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}
