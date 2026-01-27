import { useMemo, useState, useEffect, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import {
  LibraryGrid,
  LibraryHeaderRight,
} from "../components";
import { EmptyState, SearchBar } from "@/shared/components";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useAppSettingsStore } from "@/shared/stores";
import { isNsfwSource } from "@/sources";
import { useLibraryStore } from "../stores/useLibraryStore";
import { useLibraryManga } from "../hooks";
import { parseChapterDate } from "@/core/utils/dateParser";

export function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fgColor = useCSSVariable("--color-foreground");
  const foreground = typeof fgColor === "string" ? fgColor : "#fff";

  // Get store state
  const libraryState = useLibraryStore();
  const storeSearchQuery = libraryState.searchQuery;
  const activeCategory = libraryState.activeCategory;
  const activeSource = libraryState.activeSource;
  const sortBy = libraryState.sortBy;
  const sortAscending = libraryState.sortAscending;

  // Local search state for immediate UI feedback
  const [localSearchQuery, setLocalSearchQuery] = useState(storeSearchQuery);
  const [debouncedSearchQuery] = useDebounce(localSearchQuery, 300);

  // Update store with debounced search query
  useEffect(() => {
    if (debouncedSearchQuery !== storeSearchQuery) {
      libraryState.setSearchQuery(debouncedSearchQuery);
    }
  }, [debouncedSearchQuery, storeSearchQuery, libraryState]);

  // Sync local state when store changes externally
  useEffect(() => {
    setLocalSearchQuery(storeSearchQuery);
  }, [storeSearchQuery]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setLocalSearchQuery("");
    libraryState.setSearchQuery("");
  }, [libraryState]);
  const { showNsfwSources } = useAppSettingsStore();

  // Fetch from Realm database
  const libraryManga = useLibraryManga();

  // Filter manga based on search, source, category, and NSFW setting
  const filteredManga = useMemo(() => {
    let result = [...libraryManga];

    // NSFW source filter
    if (!showNsfwSources) {
      result = result.filter((manga) => !isNsfwSource(manga.sourceId));
    }

    // Search filter (case-insensitive title match)
    if (storeSearchQuery.trim()) {
      const query = storeSearchQuery.toLowerCase();
      result = result.filter((manga) =>
        manga.title.toLowerCase().includes(query)
      );
    }

    // Source filter
    if (activeSource !== "all") {
      result = result.filter((manga) => manga.sourceId === activeSource);
    }

    // Category/status filter
    if (activeCategory !== "All") {
      const statusMap: Record<string, string> = {
        Reading: "reading",
        Completed: "completed",
        "Plan to Read": "plan_to_read",
        "On Hold": "on_hold",
        Dropped: "dropped",
      };
      result = result.filter(
        (manga) => manga.readingStatus === statusMap[activeCategory]
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "dateAdded":
          cmp = (b.addedAt ?? 0) - (a.addedAt ?? 0);
          break;
        case "lastRead":
          cmp = (b.progress?.timestamp ?? 0) - (a.progress?.timestamp ?? 0);
          break;
        case "unread": {
          const unreadA =
            a.chapters.length - a.chapters.filter((ch) => ch.isRead).length;
          const unreadB =
            b.chapters.length - b.chapters.filter((ch) => ch.isRead).length;
          cmp = unreadB - unreadA;
          break;
        }
        case "latestChapter": {
          const latestA = Math.max(
            ...a.chapters.map((ch) => parseChapterDate(ch.date)),
            0
          );
          const latestB = Math.max(
            ...b.chapters.map((ch) => parseChapterDate(ch.date)),
            0
          );
          cmp = latestB - latestA;
          break;
        }
      }
      return sortAscending ? -cmp : cmp;
    });

    return result;
  }, [
    libraryManga,
    storeSearchQuery,
    activeSource,
    activeCategory,
    showNsfwSources,
    sortBy,
    sortAscending,
  ]);

  // Transform Realm objects to grid format
  const gridData = useMemo(() => {
    return filteredManga.map((manga) => {
      const readChapters = manga.chapters.filter((ch) => ch.isRead).length;
      const totalChapters = manga.chapters.length;
      const lastReadChapter = manga.progress?.lastChapterNumber;
      const lastPage = manga.progress?.lastPage;

      return {
        id: manga.id,
        title: manga.title,
        cover: manga.cover || "",
        localCover: manga.localCover,
        sourceId: manga.sourceId,
        readingStatus: (manga.readingStatus || "reading") as
          | "reading"
          | "completed"
          | "plan_to_read"
          | "on_hold"
          | "dropped",
        totalChapters,
        currentChapter: lastReadChapter,
        lastPage,
        unreadCount: totalChapters - readChapters,
      };
    });
  }, [filteredManga]);

  const handleMangaPress = (id: string) => {
    const manga = libraryManga.find((m) => m.id === id);
    if (manga) {
      // Serialize data for instant render on destination screen
      // Include chapters to avoid race condition with Realm query timing
      const preloadedData = {
        title: manga.title,
        cover: manga.cover,
        localCover: manga.localCover,
        author: manga.author,
        description: manga.description,
        genres: [...manga.genres],
        chapterCount: manga.chapters.length,
        readingStatus: manga.readingStatus,
        chapters: [...manga.chapters].map((ch) => ({
          id: ch.id,
          number: ch.number,
          title: ch.title,
          url: ch.url,
          date: ch.date,
        })),
      };

      router.push({
        pathname: "/(main)/manga/[id]",
        params: {
          id: manga.id.replace(`${manga.sourceId}_`, ""),
          sourceId: manga.sourceId,
          url: manga.url,
          preloaded: JSON.stringify(preloadedData),
        },
      });
    }
  };

  // Empty state message based on active filters
  const emptyMessage = useMemo(() => {
    if (storeSearchQuery.trim()) {
      return `No manga matching "${storeSearchQuery}"`;
    }
    if (activeCategory === "All") {
      return "Add manga from Browse tab";
    }
    return `No titles in "${activeCategory}"`;
  }, [storeSearchQuery, activeCategory]);

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 border-b border-border"
        style={{ paddingTop: insets.top + 8, paddingBottom: 12 }}
      >
        <View>
          <Text className="text-foreground text-2xl font-bold">Library</Text>
          <Text className="text-muted text-sm mt-1">Your collection</Text>
        </View>
        <LibraryHeaderRight />
      </View>

      {/* Grid with search bar and banners as list header */}
      <LibraryGrid
        manga={gridData}
        onMangaPress={handleMangaPress}
        ListHeaderComponent={
          <View className="pt-2">
            {/* Search bar with clear button */}

            <SearchBar
              placeholder="Search library..."
              value={localSearchQuery}
              onChangeText={setLocalSearchQuery}
            />
          </View>
        }
      />

      {/* Empty State Overlay */}
      {gridData.length === 0 && (
        <View className="absolute inset-x-0 top-1/3">
          <EmptyState
            icon="book-outline"
            title="No manga found"
            description={emptyMessage}
          />
        </View>
      )}
    </View>
  );
}
