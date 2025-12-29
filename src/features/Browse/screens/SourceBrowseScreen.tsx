import { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";

import { useCSSVariable } from "uniwind";
import { SearchBar, MangaCard } from "@/shared/components";
import {
  useSearchManga,
  usePopularManga,
  useLatestManga,
  flattenMangaPages,
} from "../api/browse.queries";
import { getSource } from "@/sources";
import { useSession } from "@/shared/contexts/SessionContext";
import { useLibraryManga } from "@/features/Library/hooks";
import type { Manga } from "@/sources";

import { useDebounce } from "@/shared/hooks/useDebounce";

type TabType = "popular" | "latest" | "search";

export function SourceBrowseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sourceId } = useLocalSearchParams<{ sourceId: string }>();

  // Default to "latest" tab
  const [activeTab, setActiveTab] = useState<TabType>("latest");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery] = useDebounce(searchQuery, 800);
  const [isSearching, setIsSearching] = useState(false);

  const source = getSource(sourceId || "");
  const fgColor = useCSSVariable("--color-foreground");
  const foreground = typeof fgColor === "string" ? fgColor : "#fff";

  // Get image headers from source for cover images
  const imageHeaders = source?.getImageHeaders() ?? {};

  // No session warmup needed anymore - cookies loaded from CookieManager automatically
  const sessionReady = true; // Always ready now

  // Get library manga to check if items are already in library
  const libraryManga = useLibraryManga();
  const libraryIds = new Set(libraryManga.map((m) => m.id));

  // Handle debounced search
  useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      setIsSearching(true);
      setActiveTab("search");
    } else if (isSearching) {
      setIsSearching(false);
      setActiveTab("latest");
    }
  }, [debouncedSearchQuery]);

  // Queries - only enable the active tab's query
  const popularQuery = usePopularManga(
    sourceId || "",
    sessionReady && activeTab === "popular" && !isSearching
  );
  const latestQuery = useLatestManga(
    sourceId || "",
    sessionReady && activeTab === "latest" && !isSearching
  );
  const searchQueryResult = useSearchManga(
    sourceId || "",
    isSearching ? debouncedSearchQuery : "",
    sessionReady && isSearching
  );

  const handleSearch = useCallback(() => {
    // Manual submit (optional now, but good for UX)
    if (searchQuery.trim()) {
      setIsSearching(true);
      setActiveTab("search");
    }
  }, [searchQuery]);

  const handleMangaPress = useCallback(
    (manga: Manga) => {
      router.push({
        pathname: "/manga/[id]",
        params: {
          id: manga.id,
          sourceId: sourceId,
          url: manga.url,
        },
      });
    },
    [router, sourceId]
  );

  // Determine which data to show
  const currentQuery =
    activeTab === "search"
      ? searchQueryResult
      : activeTab === "popular"
      ? popularQuery
      : latestQuery;

  const isLoading = currentQuery.isLoading;
  const mangaList = flattenMangaPages(currentQuery.data?.pages);
  const fetchNextPage = currentQuery.fetchNextPage;
  const hasNextPage = currentQuery.hasNextPage;
  const isFetchingNextPage = currentQuery.isFetchingNextPage;

  if (!source) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted">Source not found</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Search Bar */}
      <View className="px-4 py-3">
        <SearchBar
          placeholder={`Search ${source.name}...`}
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            if (!text.trim()) {
              setIsSearching(false);
              setActiveTab("latest");
            }
          }}
          onSubmitEditing={handleSearch}
        />
      </View>

      {/* Tab Selector */}
      <View className="flex-row px-4 gap-2 mb-3">
        {(["popular", "latest"] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => {
              setActiveTab(tab);
              setIsSearching(false);
            }}
            className={`px-4 py-2 rounded-full ${
              activeTab === tab && !isSearching
                ? "bg-primary"
                : "bg-surface border border-border"
            }`}
          >
            <Text
              className={`text-xs font-semibold capitalize ${
                activeTab === tab && !isSearching ? "text-black" : "text-muted"
              }`}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
        {isSearching && (
          <View className="px-4 py-2 rounded-full bg-primary">
            <Text className="text-xs font-semibold text-black">
              Search: {searchQuery}
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      {!sessionReady ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={foreground} />
          <Text className="text-muted mt-4">Warming up session...</Text>
          <Text className="text-muted/60 text-xs mt-2">
            Preparing connection to {source.name}
          </Text>
        </View>
      ) : isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={foreground} />
          <Text className="text-muted mt-4">Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={mangaList}
          numColumns={2}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 100,
          }}
          columnWrapperStyle={{ gap: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const libraryId = `${sourceId}_${item.id}`;
            const isInLibrary = libraryIds.has(libraryId);
            return (
              <View style={{ flex: 1 / 2 }}>
                <MangaCard
                  id={item.id}
                  title={item.title}
                  coverUrl={item.cover}
                  baseUrl={source?.baseUrl}
                  headers={imageHeaders}
                  onPress={() => handleMangaPress(item)}
                  badge={isInLibrary ? "IN LIBRARY" : undefined}
                />
              </View>
            );
          }}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color={foreground} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="py-12 items-center">
              <Text className="text-muted">No manga found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
