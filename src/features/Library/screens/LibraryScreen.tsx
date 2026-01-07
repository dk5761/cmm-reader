import { useMemo } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import {
  LibraryGrid,
  SyncProgressBanner,
  SyncCompletionToast,
  LibrarySearchBar,
  CloudSyncBanner,
} from "../components";
import { EmptyState } from "@/shared/components";
import { useAppSettingsStore } from "@/shared/stores";
import { isNsfwSource } from "@/sources";
import { useLibraryStore } from "../stores/useLibraryStore";
import { useLibraryManga } from "../hooks";
import { parseChapterDate } from "@/core/utils/dateParser";

export function LibraryScreen() {
  const router = useRouter();
  const { activeCategory, searchQuery, activeSource, sortBy, sortAscending } =
    useLibraryStore();
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
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
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
    searchQuery,
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
        unreadCount: totalChapters - readChapters,
      };
    });
  }, [filteredManga]);

  const handleMangaPress = (id: string) => {
    const manga = libraryManga.find((m) => m.id === id);
    if (manga) {
      // Serialize minimal data for instant render on destination screen
      const preloadedData = {
        title: manga.title,
        cover: manga.cover,
        localCover: manga.localCover,
        author: manga.author,
        description: manga.description,
        genres: [...manga.genres],
        chapterCount: manga.chapters.length,
        readingStatus: manga.readingStatus,
      };

      router.push({
        pathname: "/manga/[id]",
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
    if (searchQuery.trim()) {
      return `No manga matching "${searchQuery}"`;
    }
    if (activeCategory === "All") {
      return "Add manga from Browse tab";
    }
    return `No titles in "${activeCategory}"`;
  }, [searchQuery, activeCategory]);

  return (
    <View className="flex-1 bg-background">
      {/* Grid with search as list header */}
      <LibraryGrid
        manga={gridData}
        onMangaPress={handleMangaPress}
        ListHeaderComponent={
          <View className="pb-4">
            <LibrarySearchBar />
            <CloudSyncBanner />
            <SyncProgressBanner />
            <SyncCompletionToast />
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
