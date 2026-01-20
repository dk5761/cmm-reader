import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@realm/react";
import { MangaSchema } from "@/core/database";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";

export default function RealmDebugScreen() {
  const insets = useSafeAreaInsets();
  const allManga = useQuery(MangaSchema);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <>
      <Stack.Screen options={{ title: "Realm Database" }} />
      <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 100 }}
      >
        <View className="px-4 mb-4 bg-surface rounded-lg py-3">
          <Text className="text-muted text-xs font-bold uppercase">Database Info</Text>
          <View className="flex-row items-center gap-2 mt-2">
            <Ionicons name="information-circle" size={16} color="#00d9ff" />
            <Text className="text-foreground font-semibold">
              {allManga.length} manga in library
            </Text>
          </View>
        </View>

        {allManga.length === 0 ? (
          <View className="p-4">
            <Text className="text-muted text-center">No data in Realm</Text>
          </View>
        ) : (
          allManga.map((manga) => (
            <View key={manga.id} className="border-b border-border/30">
              <Pressable
                onPress={() => toggleExpand(manga.id)}
                className="p-4 flex-row items-center justify-between"
              >
                <View className="flex-1">
                  <Text className="text-foreground font-bold" numberOfLines={1}>
                    {manga.title}
                  </Text>
                  <Text className="text-muted text-xs mt-1">
                    ID: {manga.id}
                  </Text>
                  <Text className="text-muted text-xs">
                    Source: {manga.sourceId} | Status: {manga.readingStatus}
                  </Text>
                  <Text className="text-muted text-xs">
                    Chapters: {manga.chapters.length} | Read:{" "}
                    {manga.chapters.filter((c) => c.isRead).length}
                  </Text>
                </View>
                <Ionicons
                  name={expandedId === manga.id ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#71717a"
                />
              </Pressable>

              {expandedId === manga.id && (
                <View className="px-4 pb-4 bg-surface/30">
                  <Text className="text-primary text-xs font-bold mt-2">
                    PROGRESS
                  </Text>
                  <Text className="text-muted text-xs">
                    {manga.progress
                      ? `Last: Ch.${manga.progress.lastChapterNumber} P.${manga.progress.lastPage}`
                      : "No progress"}
                  </Text>

                  <Text className="text-primary text-xs font-bold mt-3">
                    CHAPTERS ({manga.chapters.length})
                  </Text>
                  <View className="mt-1">
                    {manga.chapters.slice(0, 20).map((ch, idx) => (
                      <View
                        key={ch.id}
                        className="flex-row items-center py-1 border-b border-border/20"
                      >
                        <Text
                          className={`text-xs flex-1 ${
                            ch.isRead ? "text-muted" : "text-foreground"
                          }`}
                        >
                          Ch.{ch.number} {ch.title ? `- ${ch.title}` : ""}
                        </Text>
                        <View className="flex-row gap-2">
                          {ch.isRead && (
                            <Text className="text-green-500 text-xs">✓</Text>
                          )}
                          {ch.lastPageRead > 0 && (
                            <Text className="text-muted text-xs">
                              P.{ch.lastPageRead}
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                    {manga.chapters.length > 20 && (
                      <Text className="text-muted text-xs mt-2 italic">
                        + {manga.chapters.length - 20} more chapters...
                      </Text>
                    )}
                  </View>

                  <Text className="text-primary text-xs font-bold mt-3">
                    RAW DATA
                  </Text>
                  <View className="bg-surface p-2 rounded mt-1">
                    <Text className="text-muted text-xs font-mono">
                      {JSON.stringify(
                        {
                          id: manga.id,
                          sourceId: manga.sourceId,
                          title: manga.title,
                          url: manga.url,
                          cover: manga.cover?.substring(0, 50) + "...",
                          author: manga.author,
                          status: manga.status,
                          readingStatus: manga.readingStatus,
                          addedAt: new Date(manga.addedAt).toISOString(),
                          lastUpdated: manga.lastUpdated
                            ? new Date(manga.lastUpdated).toISOString()
                            : null,
                          chaptersCount: manga.chapters.length,
                          readCount: manga.chapters.filter((c) => c.isRead)
                            .length,
                        },
                        null,
                        2
                      )}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ))
        )}
</ScrollView>
      </View>
    </>
  );
}