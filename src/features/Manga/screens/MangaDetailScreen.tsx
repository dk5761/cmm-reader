import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useCSSVariable } from "uniwind";
import { WebViewImage, CollapsibleText } from "@/shared/components";
import {
  ChapterCard,
  GenreChip,
  ReadingStatusSheet,
  getStatusLabel,
} from "../components";
import { useMangaDetails, useChapterList } from "../api/manga.queries";
import { getSource } from "@/sources";
import {
  useAddToLibrary,
  useRemoveFromLibrary,
  useLibraryMangaById,
  useMarkChapterRead,
  useMarkChapterUnread,
  useMarkPreviousAsRead,
  useMarkPreviousAsUnread,
  useUpdateReadingStatus,
} from "@/features/Library/hooks";
import { useSession } from "@/shared/contexts/SessionContext";
import type { ReadingStatus } from "@/core/database";

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

  // Session warmup for CF-protected sources (needed when coming from Library)
  const { isSessionReady, warmupSession } = useSession();
  const sessionReady = source?.needsCloudflareBypass
    ? isSessionReady(source.baseUrl)
    : true;

  // Trigger warmup if needed
  useEffect(() => {
    if (source?.needsCloudflareBypass && source?.baseUrl) {
      warmupSession(source.baseUrl, true);
    }
  }, [source?.baseUrl, source?.needsCloudflareBypass, warmupSession]);

  // Only fetch data when session is ready
  const {
    data: manga,
    isLoading: isMangaLoading,
    error: mangaError,
    refetch: refetchManga,
  } = useMangaDetails(sourceId || "", url || "", sessionReady);
  const {
    data: chapters,
    isLoading: isChaptersLoading,
    error: chaptersError,
    refetch: refetchChapters,
  } = useChapterList(sourceId || "", url || "", sessionReady);

  // Pull to refresh state
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchManga(), refetchChapters()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchManga, refetchChapters]);

  // Library hooks
  const libraryId = `${sourceId}_${id}`;
  const libraryManga = useLibraryMangaById(libraryId);
  const isInLibrary = !!libraryManga;
  const addToLibrary = useAddToLibrary();
  const removeFromLibrary = useRemoveFromLibrary();

  // Reading progress hooks
  const markChapterRead = useMarkChapterRead();
  const markChapterUnread = useMarkChapterUnread();
  const markPreviousAsRead = useMarkPreviousAsRead();
  const updateReadingStatus = useUpdateReadingStatus();

  // Optimistic state for immediate UI updates
  const [optimisticReadIds, setOptimisticReadIds] = useState<Set<string>>(
    new Set()
  );
  const [optimisticUnreadIds, setOptimisticUnreadIds] = useState<Set<string>>(
    new Set()
  );
  const [statusSheetVisible, setStatusSheetVisible] = useState(false);

  // Combine Realm data with optimistic updates
  const readChapterIds = useMemo(() => {
    const realmReadIds = new Set(
      libraryManga?.chapters?.filter((ch) => ch.isRead)?.map((ch) => ch.id) ||
        []
    );
    // Add optimistic reads, remove optimistic unreads
    optimisticReadIds.forEach((id) => realmReadIds.add(id));
    optimisticUnreadIds.forEach((id) => realmReadIds.delete(id));
    return realmReadIds;
  }, [libraryManga?.chapters, optimisticReadIds, optimisticUnreadIds]);

  // Optimistic handlers
  const handleMarkAsRead = useCallback(
    (chapterId: string) => {
      // Optimistic update
      setOptimisticReadIds((prev) => new Set(prev).add(chapterId));
      setOptimisticUnreadIds((prev) => {
        const next = new Set(prev);
        next.delete(chapterId);
        return next;
      });
      // Background DB update
      setTimeout(() => markChapterRead(libraryId, chapterId), 0);
    },
    [libraryId, markChapterRead]
  );

  const handleMarkAsUnread = useCallback(
    (chapterId: string) => {
      // Optimistic update
      setOptimisticUnreadIds((prev) => new Set(prev).add(chapterId));
      setOptimisticReadIds((prev) => {
        const next = new Set(prev);
        next.delete(chapterId);
        return next;
      });
      // Background DB update
      setTimeout(() => markChapterUnread(libraryId, chapterId), 0);
    },
    [libraryId, markChapterUnread]
  );

  const handleMarkPreviousAsRead = useCallback(
    (chapterNumber: number) => {
      // Find all chapters with lower number and optimistically mark them
      const chapterIdsToMark =
        chapters
          ?.filter((ch) => ch.number < chapterNumber)
          ?.map((ch) => ch.id) || [];

      // Optimistic update for all
      setOptimisticReadIds((prev) => {
        const next = new Set(prev);
        chapterIdsToMark.forEach((id) => next.add(id));
        return next;
      });
      setOptimisticUnreadIds((prev) => {
        const next = new Set(prev);
        chapterIdsToMark.forEach((id) => next.delete(id));
        return next;
      });
      // Background DB update
      setTimeout(() => markPreviousAsRead(libraryId, chapterNumber), 0);
    },
    [libraryId, chapters, markPreviousAsRead]
  );

  const markPreviousUnread = useMarkPreviousAsUnread();

  const handleMarkPreviousAsUnread = useCallback(
    (chapterNumber: number) => {
      // Find all chapters with lower number and optimistically mark them
      const chapterIdsToMark =
        chapters
          ?.filter((ch) => ch.number < chapterNumber)
          ?.map((ch) => ch.id) || [];

      // Optimistic update for all
      setOptimisticUnreadIds((prev) => {
        const next = new Set(prev);
        chapterIdsToMark.forEach((id) => next.add(id));
        return next;
      });
      setOptimisticReadIds((prev) => {
        const next = new Set(prev);
        chapterIdsToMark.forEach((id) => next.delete(id));
        return next;
      });
      // Background DB update
      setTimeout(() => markPreviousUnread(libraryId, chapterNumber), 0);
    },
    [libraryId, chapters, markPreviousUnread]
  );

  const fgColor = useCSSVariable("--color-foreground");
  const foreground = typeof fgColor === "string" ? fgColor : "#fff";

  const handleLibraryToggle = () => {
    if (!manga || !chapters || !sourceId || !id) return;

    const libraryId = `${sourceId}_${id}`;

    if (isInLibrary) {
      removeFromLibrary(libraryId);
    } else {
      addToLibrary(manga, chapters, sourceId);
    }
  };

  // Instant preview: validate local data for library manga
  const isLocalDataValid =
    libraryManga?.title && (libraryManga?.chapters?.length ?? 0) > 0;
  const hasLocalData = !!libraryManga && isLocalDataValid;

  // Only show loader if NOT in library AND waiting for data
  const isWaitingForSession = source?.needsCloudflareBypass && !sessionReady;
  const shouldShowLoader =
    !hasLocalData &&
    (isWaitingForSession || isMangaLoading || isChaptersLoading);

  // Show refreshing indicator for library manga (subtle, not blocking)
  const isRefreshing =
    hasLocalData &&
    (isMangaLoading || isChaptersLoading || isWaitingForSession);

  // Use local data as fallback, fresh data as primary
  const displayManga =
    manga ||
    (hasLocalData
      ? {
          title: libraryManga!.title,
          cover: libraryManga!.cover,
          author: libraryManga!.author || "Unknown",
          description: libraryManga!.description,
          genres: libraryManga!.genres || [],
          url: url || "",
        }
      : null);

  const displayChapters =
    chapters ||
    libraryManga?.chapters?.map((ch) => ({
      id: ch.id,
      mangaId: libraryId,
      title: ch.title || "",
      number: ch.number,
      url: ch.url,
      date: undefined,
    })) ||
    [];

  // Loading state (only for non-library manga)
  if (shouldShowLoader) {
    const loadingText = isWaitingForSession
      ? `Warming up session... (${source?.name})`
      : "Loading details...";
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={foreground} />
        <Text className="text-muted mt-4">{loadingText}</Text>
      </View>
    );
  }

  // Error state (only if no local data to fall back on)
  if ((mangaError || !displayManga) && !hasLocalData) {
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

  // Final null check (shouldn't happen)
  if (!displayManga) return null;

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
    <>
      <View className="flex-1 bg-background">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={foreground}
              colors={[foreground]}
            />
          }
        >
          {/* Info Section - Centered Layout */}
          <View className="items-start px-4 mb-6">
            <View className="flex-row w-full gap-5">
              {/* Cover Image - Left Side */}
              <View className="w-[120px] aspect-2/3 rounded-lg bg-surface shadow-md overflow-hidden">
                {libraryManga?.localCover ? (
                  <Image
                    source={{ uri: libraryManga.localCover }}
                    contentFit="cover"
                    style={{ width: "100%", height: "100%" }}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <WebViewImage
                    uri={displayManga.cover || ""}
                    baseUrl={source?.baseUrl}
                    resizeMode="cover"
                    style={{ width: "100%", height: "100%" }}
                  />
                )}
              </View>

              {/* Right Side Info */}
              <View className="flex-1 pt-1">
                {/* Refreshing indicator */}
                {isRefreshing && (
                  <View className="absolute top-0 right-0">
                    <ActivityIndicator size="small" color="#00d9ff" />
                  </View>
                )}
                <Text className="text-foreground text-2xl font-bold leading-tight">
                  {displayManga.title}
                </Text>
                <Text className="text-primary text-sm font-medium mt-1">
                  by {displayManga.author}
                </Text>
                <Text className="text-muted text-xs mt-0.5">
                  {source?.name || "Unknown Source"}
                </Text>

                {/* Genre Chips - Stacked */}
                <View className="flex-row flex-wrap gap-2 mt-3">
                  {displayManga.genres?.map((genre) => (
                    <GenreChip key={genre} genre={genre} />
                  ))}
                </View>
              </View>
            </View>

            {/* Description */}
            <CollapsibleText
              text={displayManga.description || ""}
              numberOfLines={3}
              className="mt-5"
            />

            {/* Add to Library Button - Full Width */}
            <Pressable
              className={`w-full mt-6 rounded-lg py-3 items-center justify-center shadow-lg active:opacity-90 ${
                isInLibrary ? "bg-surface border border-primary" : "bg-primary"
              }`}
              onPress={handleLibraryToggle}
            >
              <View className="flex-row items-center gap-2">
                <Ionicons
                  name={isInLibrary ? "checkmark-circle" : "add-circle-outline"}
                  size={18}
                  color={isInLibrary ? "#00d9ff" : "#000"}
                />
                <Text
                  className={`font-bold text-xs uppercase tracking-widest ${
                    isInLibrary ? "text-primary" : "text-black"
                  }`}
                >
                  {isInLibrary ? "In Library" : "Add to Library"}
                </Text>
              </View>
            </Pressable>

            {/* Reading Status Button - Only when in library */}
            {isInLibrary && (
              <Pressable
                className="w-full mt-3 rounded-lg py-3 bg-surface border border-border items-center justify-center active:opacity-90"
                onPress={() => setStatusSheetVisible(true)}
              >
                <View className="flex-row items-center gap-2">
                  <Ionicons
                    name="bookmark-outline"
                    size={18}
                    color={foreground}
                  />
                  <Text className="text-foreground font-medium">
                    {getStatusLabel(
                      (libraryManga?.readingStatus as ReadingStatus) ||
                        "reading"
                    )}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={foreground} />
                </View>
              </Pressable>
            )}
          </View>

          {/* Loading Banner */}
          {isRefreshing && (
            <View className="bg-primary/10 border border-primary/30 mx-4 mt-2 mb-4 px-4 py-3 rounded-lg flex-row items-center">
              <ActivityIndicator size="small" color="#00d9ff" />
              <Text className="text-primary text-sm ml-3">
                Loading new data...
              </Text>
            </View>
          )}

          {/* Error Banner (if refresh failed but showing cached data) */}
          {hasLocalData && mangaError && (
            <View className="bg-destructive/10 border border-destructive/30 mx-4 mt-2 mb-4 px-4 py-3 rounded-lg">
              <Text className="text-destructive text-sm">
                Failed to refresh - showing cached data
              </Text>
            </View>
          )}

          {/* Chapter List Header */}
          <View className="bg-surface/50 px-4 py-3 border-t border-b border-border/50">
            <Text className="text-foreground font-bold text-sm">
              {displayChapters.length} Chapters
            </Text>
          </View>

          {/* Chapters */}
          <View className="pb-4">
            {displayChapters.map((chapter) => (
              <ChapterCard
                key={chapter.id}
                chapter={chapter}
                isRead={readChapterIds.has(chapter.id)}
                onPress={() => handleChapterPress(chapter.id, chapter.url)}
                onMarkAsRead={() => handleMarkAsRead(chapter.id)}
                onMarkAsUnread={() => handleMarkAsUnread(chapter.id)}
                onMarkPreviousAsRead={() =>
                  handleMarkPreviousAsRead(chapter.number)
                }
                onMarkPreviousAsUnread={() =>
                  handleMarkPreviousAsUnread(chapter.number)
                }
              />
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Reading Status Sheet Modal */}
      <ReadingStatusSheet
        visible={statusSheetVisible}
        currentStatus={
          (libraryManga?.readingStatus as ReadingStatus) || "reading"
        }
        onSelect={(status) => {
          if (libraryManga) {
            updateReadingStatus(libraryId, status);
          }
        }}
        onClose={() => setStatusSheetVisible(false)}
      />
    </>
  );
}
