import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useCSSVariable } from "uniwind";
import { WebViewImage, CollapsibleText } from "@/shared/components";
import { ChapterCard, GenreChip } from "../components";
import { useMangaDetails, useChapterList } from "../api/manga.queries";
import { getSource } from "@/sources";

export function MangaDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, sourceId, url } = useLocalSearchParams<{
    id: string;
    sourceId: string;
    url: string;
  }>();

  console.log("[MangaDetailScreen] Params:", { id, sourceId, url });

  const source = getSource(sourceId || "");
  const {
    data: manga,
    isLoading: isMangaLoading,
    error: mangaError,
  } = useMangaDetails(sourceId || "", url || "");
  const {
    data: chapters,
    isLoading: isChaptersLoading,
    error: chaptersError,
  } = useChapterList(sourceId || "", url || "");

  const fgColor = useCSSVariable("--color-foreground");
  const foreground = typeof fgColor === "string" ? fgColor : "#fff";

  // Loading state
  if (isMangaLoading || isChaptersLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={foreground} />
        <Text className="text-muted mt-4">Loading details...</Text>
      </View>
    );
  }

  // Error state
  if (mangaError || !manga) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-6">
        <Text className="text-destructive text-lg font-bold">
          Error loading manga
        </Text>
        <Text className="text-muted text-center mt-2">
          {(mangaError as Error)?.message || "Unknown error"}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-6 bg-surface px-6 py-3 rounded-lg border border-border"
        >
          <Text className="text-foreground">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const handleChapterPress = (chapterId: string, chapterUrl: string) => {
    // Navigate to reader with chapter info
    router.push({
      pathname: "/reader/[chapterId]",
      params: {
        chapterId, // This is just the ID (number usually)
        sourceId,
        url: chapterUrl, // The full URL to fetch pages
        mangaUrl: url, // Pass manga URL to fetch chapter list for navigation
      },
    });
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4"
        style={{ paddingTop: insets.top + 8, paddingBottom: 8 }}
      >
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color={foreground} />
        </Pressable>
        <Pressable className="p-2 -mr-2">
          <Ionicons name="ellipsis-vertical" size={24} color={foreground} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Info Section - Centered Layout */}
        <View className="items-start px-4 mb-6">
          <View className="flex-row w-full gap-5">
            {/* Cover Image - Left Side */}
            <View className="w-[120px] aspect-2/3 rounded-lg bg-surface shadow-md overflow-hidden">
              <WebViewImage
                uri={manga.cover}
                baseUrl={source?.baseUrl}
                resizeMode="cover"
                style={{ width: "100%", height: "100%" }}
              />
            </View>

            {/* Right Side Info */}
            <View className="flex-1 pt-1">
              <Text className="text-foreground text-2xl font-bold leading-tight">
                {manga.title}
              </Text>
              <Text className="text-primary text-sm font-medium mt-1">
                by {manga.author}
              </Text>

              {/* Genre Chips - Stacked */}
              <View className="flex-row flex-wrap gap-2 mt-3">
                {manga.genres?.map((genre) => (
                  <GenreChip key={genre} genre={genre} />
                ))}
              </View>
            </View>
          </View>

          {/* Description */}
          <CollapsibleText
            text={manga.description || ""}
            numberOfLines={3}
            className="mt-5"
          />

          {/* Add to Library Button - Full Width */}
          <Pressable
            className="w-full mt-6 bg-primary rounded-lg py-3 items-center justify-center shadow-lg active:opacity-90"
            onPress={() => console.log("Add to Library")}
          >
            <Text className="text-black font-bold text-xs uppercase tracking-widest">
              Add to Library
            </Text>
          </Pressable>
        </View>

        {/* Chapter List Header */}
        <View className="bg-surface/50 px-4 py-3 border-t border-b border-border/50">
          <Text className="text-foreground font-bold text-sm">
            {chapters?.length || 0} Chapters
          </Text>
        </View>

        {/* Chapters */}
        <View className="pb-4">
          {chapters?.map((chapter) => (
            <ChapterCard
              key={chapter.id}
              chapter={chapter}
              onPress={() => handleChapterPress(chapter.id, chapter.url)}
              onOptions={() => console.log("Options:", chapter.id)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
