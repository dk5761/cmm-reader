/**
 * useMangaData - Consolidated data fetching for manga details
 * Handles session warmup, fetching from source, and local data fallback
 */

import { useEffect, useCallback, useState } from "react";
import { toast } from "sonner-native";
import { useSession } from "@/shared/contexts/SessionContext";
import { useMangaDetails, useChapterList } from "../api/manga.queries";
import {
  useLibraryMangaById,
  useUpdateLibraryChapters,
  useGetOrCreateManga,
} from "@/features/Library/hooks";
import { getSource } from "@/sources";
import type { MangaDetails, Chapter } from "@/sources";
import { isCfError } from "@/core/http/utils/cfErrorHandler";
import { resetCfRetryState } from "@/core/http/utils/resetCfRetryState";
import { logger } from "@/utils/logger";

export type PreloadedManga = {
  title: string;
  cover?: string;
  localCover?: string;
  author?: string;
  description?: string;
  genres: string[];
  chapterCount: number;
  readingStatus?: string;
  chapters?: Array<{
    id: string;
    number: number;
    title?: string;
    url: string;
    date?: string;
  }>;
};

export type MangaDataParams = {
  id: string;
  sourceId: string;
  url: string;
  preloaded?: string; // JSON stringified PreloadedManga
};

export type DisplayManga = {
  title: string;
  cover: string;
  author: string;
  description?: string;
  genres: string[];
  url: string;
};

export type DisplayChapter = {
  id: string;
  mangaId: string;
  title: string;
  number: number;
  url: string;
  date?: string;
};

export function useMangaData(params: MangaDataParams) {
  const { id, sourceId, url, preloaded } = params;
  const libraryId = id.startsWith(`${sourceId}_`) ? id : `${sourceId}_${id}`;

  // Parse preloaded data (passed from LibraryScreen for instant render)
  const preloadedData: PreloadedManga | null = preloaded
    ? JSON.parse(preloaded)
    : null;

  // Get source config
  const source = getSource(sourceId);

  const sessionReady = true;

  // Local data from Realm
  const libraryManga = useLibraryMangaById(libraryId);
  const isLocalDataValid =
    libraryManga?.title && (libraryManga?.chapters?.length ?? 0) > 0;
  const hasLocalData = !!libraryManga && isLocalDataValid;

  // Has ANY instant data (preloaded OR local)
  const hasInstantData = !!preloadedData || hasLocalData;

  // Defer heavy operations for library manga (instant navigation)
  const [shouldFetch, setShouldFetch] = useState(!hasInstantData);

  useEffect(() => {
    if (hasInstantData && !shouldFetch) {
      // Defer fetching until after navigation animation completes
      const timeout = setTimeout(() => {
        setShouldFetch(true);
      }, 500); // Allow 500ms for screen to render
      return () => clearTimeout(timeout);
    }
  }, [hasInstantData, shouldFetch]);

  // Fetch from source (only when session is ready AND we should fetch)
  const fetchEnabled = shouldFetch && sessionReady;
  const {
    data: manga,
    isLoading: isMangaLoading,
    error: mangaError,
    refetch: refetchManga,
  } = useMangaDetails(sourceId, url, fetchEnabled);

  const {
    data: chapters,
    isLoading: isChaptersLoading,
    error: chaptersError,
    refetch: refetchChapters,
  } = useChapterList(sourceId, url, fetchEnabled);

  // Auto-sync: Persist fresh chapters to Realm when they arrive
  const updateLibraryChapters = useUpdateLibraryChapters();
  const getOrCreateManga = useGetOrCreateManga();

  useEffect(() => {
    // Auto-track: Create/update manga entry for progress tracking
    if (manga && chapters) {
      getOrCreateManga(manga, chapters, sourceId);
    }
  }, [manga, chapters, sourceId, getOrCreateManga]);

  useEffect(() => {
    // Only sync chapters if manga is actually in library
    if (chapters && hasLocalData && libraryManga?.inLibrary) {
      // Always sync to update chapter dates and other metadata
      updateLibraryChapters(libraryId, chapters);
    }
  }, [chapters, hasLocalData, libraryManga, libraryId, updateLibraryChapters]);

  // Handle CF errors with toast notification
  useEffect(() => {
    const error = mangaError || chaptersError;

    if (
      error &&
      isCfError(error) &&
      fetchEnabled &&
      !isMangaLoading &&
      !isChaptersLoading
    ) {
      logger.manga.log("CF error detected, showing toast");

      toast.error("Failed to load manga details", {
        description: "Cloudflare verification needed",
        action: {
          label: "Retry",
          onClick: () => {
            toast.dismiss();

            // Reset CF retry state
            if (url) {
              resetCfRetryState(url);
            }

            // Refetch both queries
            refetchManga();
            refetchChapters();
          },
        },
        duration: Infinity,
      });
    }
  }, [
    mangaError,
    chaptersError,
    fetchEnabled,
    isMangaLoading,
    isChaptersLoading,
    url,
    refetchManga,
    refetchChapters,
  ]);

  // Build display data: preloaded -> fresh -> local (priority order)
  const displayManga: DisplayManga | null = manga
    ? {
        title: manga.title,
        cover: manga.cover,
        author: manga.author || "Unknown",
        description: manga.description,
        genres: manga.genres || [],
        url: manga.url,
      }
    : preloadedData
    ? {
        title: preloadedData.title,
        cover: preloadedData.localCover || preloadedData.cover || "",
        author: preloadedData.author || "Unknown",
        description: preloadedData.description,
        genres: preloadedData.genres || [],
        url: url || "",
      }
    : hasLocalData
    ? {
        title: libraryManga!.title,
        cover: libraryManga!.cover || "",
        author: libraryManga!.author || "Unknown",
        description: libraryManga!.description,
        genres: [...(libraryManga!.genres || [])],
        url: url || "",
      }
    : null;

  const displayChapters: DisplayChapter[] = (
    chapters?.map((ch) => ({
      id: ch.id,
      mangaId: ch.mangaId,
      title: ch.title || "",
      number: ch.number,
      url: ch.url,
      date: ch.date,
    })) ||
    preloadedData?.chapters?.map((ch) => ({
      id: ch.id,
      mangaId: libraryId,
      title: ch.title || "",
      number: ch.number,
      url: ch.url,
      date: ch.date,
    })) ||
    libraryManga?.chapters?.map((ch) => ({
      id: ch.id,
      mangaId: libraryId,
      title: ch.title || "",
      number: ch.number,
      url: ch.url,
      date: ch.date,
    })) ||
    []
  ).sort((a, b) => b.number - a.number);

  // [DEBUG] Log display chapters source
  useEffect(() => {
    const source = chapters
      ? "FRESH API"
      : preloadedData?.chapters
      ? "PRELOADED"
      : libraryManga?.chapters
      ? "LOCAL REALM"
      : "NONE";
    logger.manga.log("Display chapters source", {
      source,
      count: displayChapters.length,
      isInLibrary: hasLocalData,
    });
  }, [displayChapters.length, chapters, libraryManga, hasLocalData]);

  // Loading states
  const isWaitingForSession = source?.needsCloudflareBypass && !sessionReady;
  const isLoading =
    !hasLocalData &&
    (isWaitingForSession || isMangaLoading || isChaptersLoading);
  const isRefreshing =
    hasLocalData &&
    (isMangaLoading || isChaptersLoading || isWaitingForSession);

  // Refetch handler
  const refetch = useCallback(async () => {
    await Promise.all([refetchManga(), refetchChapters()]);
  }, [refetchManga, refetchChapters]);

  // Tracking states
  const isInLibrary = libraryManga?.inLibrary === true;
  const isTracked = !!libraryManga; // Exists in DB (library OR tracked)

  return {
    // Data
    displayManga,
    displayChapters,
    libraryManga,
    source,

    // Raw data for add-to-library
    manga,
    chapters,

    // State
    isLoading,
    isRefreshing,
    hasLocalData,
    isWaitingForSession,
    isInLibrary,
    isTracked,

    // Errors
    error: mangaError || chaptersError,

    // Actions
    refetch,

    // IDs
    libraryId,
  };
}
