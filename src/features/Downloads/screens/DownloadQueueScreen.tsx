
import { View, Text, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { useDownloadManager, DownloadStatus } from "@/shared/contexts/DownloadContext";
import { useRealm, useQuery } from "@realm/react";
import { MangaSchema } from "@/core/database";
import { DownloadQueueItem } from "../components/DownloadQueueItem";

export function DownloadQueueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fgColor = useCSSVariable("--color-foreground");
  const foreground = typeof fgColor === "string" ? fgColor : "#fff";

  const { cancelDownload, pauseDownloads, resumeDownloads, isDownloading } = useDownloadManager();
  const realm = useRealm();
  
  // Query all mangas that have queued or downloading chapters
  // Note: filtering nested objects is limited in Realm React hooks, might need manual filtering
  // Actually, we can't easily query "all chapters" flatly because they are embedded.
  // We have to query Mangas and flatten.
  const mangas = useQuery(MangaSchema);
  
  // Flatten active downloads
  const queue = mangas.reduce((acc, manga) => {
    const activeChapters = manga.chapters.filter(ch => 
      ch.downloadStatus === DownloadStatus.QUEUED || 
      ch.downloadStatus === DownloadStatus.DOWNLOADING ||
      ch.downloadStatus === DownloadStatus.ERROR
    );
    
    activeChapters.forEach(ch => {
      acc.push({
        chapter: ch,
        mangaTitle: manga.title,
      });
    });
    return acc;
  }, [] as Array<{ chapter: any, mangaTitle: string }>);

  // Sort: Downloading first, then Queued
  queue.sort((a, b) => {
    if (a.chapter.downloadStatus === DownloadStatus.DOWNLOADING) return -1;
    if (b.chapter.downloadStatus === DownloadStatus.DOWNLOADING) return 1;
    return 0; // Maintain insertion order otherwise?
  });

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color={foreground} />
        </Pressable>
        <Text className="text-foreground text-lg font-bold">Downloads</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Queue Actions */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-surface/50">
        <Text className="text-muted font-medium">
          {queue.length} items
        </Text>
        <Pressable 
          onPress={isDownloading ? pauseDownloads : resumeDownloads}
          className="flex-row items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full"
        >
          <Ionicons 
            name={isDownloading ? "pause" : "play"} 
            size={16} 
            color={isDownloading ? "#ef4444" : "#22c55e"} 
          />
          <Text className={isDownloading ? "text-red-500" : "text-green-500"}>
            {isDownloading ? "Pause" : "Resume"}
          </Text>
        </Pressable>
      </View>

      {/* List */}
      <FlatList
        data={queue}
        keyExtractor={(item) => item.chapter.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
        renderItem={({ item }) => (
          <DownloadQueueItem
            chapterTitle={item.chapter.title || `Chapter ${item.chapter.number}`}
            mangaTitle={item.mangaTitle}
            status={item.chapter.downloadStatus}
            progress={item.chapter.downloadedCount}
            total={item.chapter.downloadTotal}
            onCancel={() => cancelDownload(item.chapter.id)}
          />
        )}
        ListEmptyComponent={
          <View className="py-20 items-center justify-center">
            <Ionicons name="download-outline" size={48} color="#3f3f46" />
            <Text className="text-muted mt-4">Queue is empty</Text>
          </View>
        }
      />
    </View>
  );
}
