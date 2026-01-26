import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useCSSVariable } from "uniwind";
import { MangaCard } from "@/shared/components";
import { useLibraryManga } from "@/features/Library/hooks";
import type { SourceSearchResult } from "../hooks/useGlobalSearch";
import { getSource } from "@/sources";
import type { Manga } from "@/sources";

interface GlobalSearchResultSectionProps {
  result: SourceSearchResult;
}

export function GlobalSearchResultSection({
  result,
}: GlobalSearchResultSectionProps) {
  const router = useRouter();
  const fgColor = useCSSVariable("--color-foreground");
  const foreground = typeof fgColor === "string" ? fgColor : "#fff";

  const source = getSource(result.sourceId);
  const imageHeaders = source?.getImageHeaders() ?? {};

  // Get library manga to check if items are in library
  const libraryManga = useLibraryManga();
  const libraryIds = new Set(libraryManga.map((m) => m.id));

  const handleMangaPress = (manga: Manga) => {
    router.push({
      pathname: "/(main)/manga/[id]",
      params: {
        id: manga.id,
        sourceId: result.sourceId,
        url: manga.url,
      },
    });
  };

  const handleViewMore = () => {
    router.push(`/(main)/(tabs)/browse/${result.sourceId}`);
  };

  // Don't render if no results and not loading/error
  if (
    !result.isLoading &&
    !result.isError &&
    (!result.data || result.data.manga.length === 0)
  ) {
    return null;
  }

  return (
    <View className="mb-6">
      {/* Source Header */}
      <View className="flex-row items-center justify-between px-4 mb-3">
        <Text className="text-foreground text-base font-semibold">
          {result.sourceName}
        </Text>
        {result.data && result.data.manga.length > 0 && (
          <Pressable onPress={handleViewMore}>
            <Text className="text-primary text-sm font-medium">View More</Text>
          </Pressable>
        )}
      </View>

      {/* Loading State */}
      {result.isLoading && (
        <View className="py-8 items-center">
          <ActivityIndicator size="small" color={foreground} />
          <Text className="text-muted text-sm mt-2">Searching...</Text>
        </View>
      )}

      {/* Error State */}
      {result.isError && !result.isLoading && (
        <View className="py-4 px-4">
          <Text className="text-muted text-sm">
            ⚠️ Failed to search {result.sourceName}
          </Text>
        </View>
      )}

      {/* Results */}
      {result.data && result.data.manga.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        >
          {result.data.manga.slice(0, 10).map((manga) => {
            const libraryId = `${result.sourceId}_${manga.id}`;
            const isInLibrary = libraryIds.has(libraryId);

            return (
              <View key={manga.id} style={{ width: 120 }}>
                <MangaCard
                  id={manga.id}
                  title={manga.title}
                  coverUrl={manga.cover}
                  baseUrl={source?.baseUrl}
                  headers={imageHeaders}
                  onPress={() => handleMangaPress(manga)}
                  badge={isInLibrary ? "IN LIBRARY" : undefined}
                />
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
