/**
 * MangaDetailScreen - Container component orchestrating manga detail display
 * Uses split components for separation of concerns
 */

import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useCSSVariable } from "uniwind";

import { useMangaData } from "../hooks";
import { CollapsibleText } from "@/shared/components";
import {
  MangaHeader,
  StatusBanners,
  MangaActions,
  ChapterListSection,
  DownloadSheet,
  type DownloadOption,
} from "../components";
import type { ReadingStatus } from "@/core/database";
import { useDownloadManager } from "@/shared/contexts/DownloadContext";

export function MangaDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, sourceId, url, preloaded } = useLocalSearchParams<{
    id: string;
    sourceId: string;
    url: string;
    preloaded?: string;
  }>();

  // Theme colors
  const fgColor = useCSSVariable("--color-foreground");
  const foreground = typeof fgColor === "string" ? fgColor : "#fff";

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [downloadSheetVisible, setDownloadSheetVisible] = useState(false);

  const { queueDownload } = useDownloadManager();

  // Consolidated data hook
  const {
    displayManga,
    displayChapters,
    libraryManga,
    source,
    manga,
    chapters,
    isLoading,
    isRefreshing,
    hasLocalData,
    isWaitingForSession,
    isInLibrary,
    isTracked,
    error,
    refetch,
    libraryId,
  } = useMangaData({
    id: id || "",
    sourceId: sourceId || "",
    url: url || "",
    preloaded,
  });

  // Get image headers from source
  const imageHeaders = source?.getImageHeaders() ?? {};

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Download handler
  const handleDownloadSelect = useCallback(
    (option: DownloadOption) => {
      if (!chapters || chapters.length === 0) return;

      const chaptersToDownload = chapters.filter((chapter) => {
        if (option === "all") return true;
        // Check if chapter is read
        const isRead =
          libraryManga?.chapters?.find((c) => c.id === chapter.id)?.isRead ??
          false;
        return !isRead;
      });

      // Queue downloads
      // We reverse to download oldest first (optional, but usually better UX)
      // Actually chapters are usually Newest -> Oldest. Reversing makes them Oldest -> Newest.
      // Let's keep existing order or reverse? Let's just queue them.
      chaptersToDownload.forEach((chapter) => {
        queueDownload(chapter, libraryId, sourceId || "");
      });
    },
    [chapters, libraryManga, libraryId, sourceId, queueDownload]
  );

  // Loading state (only for non-library manga)
  if (isLoading) {
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
  if ((error || !displayManga) && !hasLocalData) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-6">
        <Text className="text-destructive text-lg font-bold">
          Error loading manga
        </Text>
        <Text className="text-muted text-center mt-2">
          {(error as Error)?.message || "Unknown error"}
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

  // Final null check
  if (!displayManga) return null;

  return (
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
        {/* Header Section */}
        <View className="items-start px-4 mb-6">
          <MangaHeader
            title={displayManga.title}
            author={displayManga.author}
            cover={displayManga.cover}
            localCover={libraryManga?.localCover}
            genres={displayManga.genres}
            sourceName={source?.name}
            sourceBaseUrl={source?.baseUrl}
            headers={imageHeaders}
            isRefreshing={!!isRefreshing}
            onDownload={() => setDownloadSheetVisible(true)}
          />

          {/* Description */}
          <CollapsibleText
            text={displayManga.description || ""}
            numberOfLines={3}
            className="mt-5"
          />

          {/* Actions (Library Toggle + Status) */}
          <MangaActions
            mangaId={libraryId}
            sourceId={sourceId || ""}
            manga={manga ?? null}
            chapters={chapters ?? null}
            isInLibrary={isInLibrary}
            readingStatus={
              (libraryManga?.readingStatus as ReadingStatus) || "reading"
            }
          />
        </View>

        {/* Status Banners */}
        <StatusBanners
          isRefreshing={!!isRefreshing}
          hasError={!!error}
          hasLocalData={!!hasLocalData}
        />

        {/* Chapter List */}
        <ChapterListSection
          chapters={displayChapters}
          mangaId={libraryId}
          mangaTitle={displayManga?.title || ""}
          mangaCover={displayManga?.cover}
          sourceId={sourceId || ""}
          mangaUrl={url || ""}
        />
      </ScrollView>

      <DownloadSheet
        visible={downloadSheetVisible}
        onSelect={handleDownloadSelect}
        onClose={() => setDownloadSheetVisible(false)}
      />
    </View>
  );
}
