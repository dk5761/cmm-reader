import { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { toast } from "sonner-native";
import { Ionicons } from "@expo/vector-icons";

import { useCSSVariable } from "uniwind";
import { SearchBar, MangaCard, LibraryGridSkeleton } from "@/shared/components";
import {
  useSearchManga,
  usePopularManga,
  useLatestManga,
  useFilteredManga,
  flattenMangaPages,
} from "../api/browse.queries";
import { getSource } from "@/sources";
import { useSession } from "@/shared/contexts/SessionContext";
import { useLibraryManga } from "@/features/Library/hooks";
import type { Manga } from "@/sources";
import type { PublisherFilter, SortOption } from "@/sources/base/types";
import { isCfError } from "@/core/http/utils/cfErrorHandler";
import { resetCfRetryState } from "@/core/http/utils/resetCfRetryState";
import { SourceFilterSheet } from "../components";

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

  // Filter state for ReadComicOnline
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [filters, setFilters] = useState<{
    publisher: PublisherFilter;
    sort: SortOption;
  }>({ publisher: "all", sort: "LatestUpdate" });

  // Check if source supports filtering (ReadComicOnline only)
  const supportsFilters = sourceId === "readcomiconline";

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

  // Debug: Log state transitions
  useEffect(() => {
    console.log("[SourceBrowseScreen] State:", {
      searchQuery,
      debouncedSearchQuery,
      isSearching,
      activeTab,
    });
  }, [searchQuery, debouncedSearchQuery, isSearching, activeTab]);

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
    sessionReady && activeTab === "popular" && !isSearching && !supportsFilters
  );
  const latestQuery = useLatestManga(
    sourceId || "",
    sessionReady && activeTab === "latest" && !isSearching && !supportsFilters
  );
  const searchQueryResult = useSearchManga(
    sourceId || "",
    isSearching ? debouncedSearchQuery : "",
    sessionReady && isSearching
  );
  // Filtered query for ReadComicOnline
  const filteredQuery = useFilteredManga(
    sourceId || "",
    filters,
    sessionReady && supportsFilters && !isSearching
  );

  // Debug: Log search query hook state
  useEffect(() => {
    console.log("[SourceBrowseScreen] Search hook:", {
      enabled: sessionReady && isSearching,
      query: isSearching ? debouncedSearchQuery : "",
      isSearching,
      debouncedSearchQuery,
    });
  }, [sessionReady, isSearching, debouncedSearchQuery]);

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
  const currentQuery = isSearching
    ? searchQueryResult
    : supportsFilters
    ? filteredQuery
    : activeTab === "popular"
    ? popularQuery
    : latestQuery;

  const isLoading = currentQuery.isLoading;
  const isRefetching = currentQuery.isRefetching;
  const refetch = currentQuery.refetch;
  const mangaList = flattenMangaPages(currentQuery.data?.pages);
  const fetchNextPage = currentQuery.fetchNextPage;
  const hasNextPage = currentQuery.hasNextPage;
  const isFetchingNextPage = currentQuery.isFetchingNextPage;
  const error = currentQuery.error;

  // Debug: Log query states
  useEffect(() => {
    console.log("[SourceBrowseScreen] Query states:", {
      activeTab,
      isSearching,
      isLoading,
      isFetchingNextPage,
      hasNextPage,
      mangaCount: mangaList.length,
      queryKey: currentQuery.dataUpdatedAt, // Track query changes
    });
  }, [
    activeTab,
    isSearching,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    mangaList.length,
  ]);

  // Handle CF errors with toast notification
  useEffect(() => {
    if (error && isCfError(error) && !isLoading) {
      console.log("[SourceBrowseScreen] CF error detected, showing toast");

      toast.error(`Failed to load ${source?.name || "manga"}`, {
        description: "Cloudflare verification needed",
        action: {
          label: "Retry",
          onClick: () => {
            console.log("[SourceBrowseScreen] Retry clicked");
            toast.dismiss();

            // Reset CF retry state to allow fresh attempt
            if (source?.baseUrl) {
              resetCfRetryState(source.baseUrl);
            }

            // Refetch the current query
            currentQuery.refetch();
          },
        },
        duration: Infinity, // Stay until user acts
      });
    }
  }, [error, isLoading, source, currentQuery]);

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
      <View className="flex-row px-4 gap-2 mb-3 items-center">
        {!supportsFilters &&
          (["popular", "latest"] as const).map((tab) => (
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
                  activeTab === tab && !isSearching
                    ? "text-black"
                    : "text-muted"
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

        {/* Filter button for ReadComicOnline */}
        {supportsFilters && !isSearching && (
          <Pressable
            onPress={() => setFilterSheetVisible(true)}
            className="flex-row items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border"
          >
            <Ionicons name="filter" size={16} color={foreground} />
            <Text className="text-foreground text-xs font-semibold">
              {filters.publisher !== "all"
                ? filters.publisher.replace("-", " ")
                : "Filters"}
            </Text>
          </Pressable>
        )}

        {/* Spacer */}
        <View className="flex-1" />
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
      ) : error && !isLoading ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-muted text-center mb-2 text-lg">
            {isCfError(error) ? "⚠️ Verification Needed" : "❌ Error"}
          </Text>
          <Text className="text-muted/70 text-center mb-6 text-sm">
            {isCfError(error)
              ? "Cloudflare verification required to access this source"
              : "Failed to load manga from this source"}
          </Text>
          <Pressable
            onPress={() => {
              console.log("[SourceBrowseScreen] Retry button pressed");
              if (source?.baseUrl) {
                resetCfRetryState(source.baseUrl);
              }
              currentQuery.refetch();
            }}
            className="bg-primary px-6 py-3 rounded-full"
          >
            <Text className="text-black font-semibold">Retry</Text>
          </Pressable>
        </View>
      ) : isLoading && !mangaList.length ? (
        <View className="flex-1 px-4">
          <LibraryGridSkeleton />
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
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={foreground}
              colors={[foreground]}
            />
          }
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

      {/* Filter Sheet for ReadComicOnline */}
      {supportsFilters && (
        <SourceFilterSheet
          visible={filterSheetVisible}
          publisher={filters.publisher}
          sort={filters.sort}
          onApply={(newFilters) => setFilters(newFilters)}
          onClose={() => setFilterSheetVisible(false)}
        />
      )}
    </View>
  );
}
