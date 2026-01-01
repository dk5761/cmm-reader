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

export type PreloadedManga = {
  title: string;
  cover?: string;
  localCover?: string;
  author?: string;
  description?: string;
  genres: string[];
  chapterCount: number;
  readingStatus?: string;
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
  const libraryId = `${sourceId}_${id}`;

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

  // // Only warmup if we're ready to fetch
  // useEffect(() => {
  //   if (shouldFetch && source?.needsCloudflareBypass && source?.baseUrl) {
  //     warmupSession(source.baseUrl, true);
  //   }
  // }, [
  //   shouldFetch,
  //   source?.baseUrl,
  //   source?.needsCloudflareBypass,
  //   warmupSession,
  // ]);

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

  // [DEBUG] Log when fresh chapters data arrives
  useEffect(() => {
    if (chapters) {
      const localChapterCount = libraryManga?.chapters?.length ?? 0;
      console.log("[DEBUG useMangaData] Fresh chapters received:", {
        mangaTitle: manga?.title || libraryManga?.title || "Unknown",
        freshChapterCount: chapters.length,
        localChapterCount,
        isInLibrary: hasLocalData,
        libraryId,
        diff: chapters.length - localChapterCount,
      });
    }
  }, [chapters, libraryManga, manga, hasLocalData, libraryId]);

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
    // [DEBUG] Log sync decision
    console.log("[DEBUG useMangaData] Sync decision:", {
      hasChapters: !!chapters,
      hasLocalData,
      inLibrary: libraryManga?.inLibrary,
      shouldSync: chapters && hasLocalData && libraryManga?.inLibrary,
    });

    // Only sync chapters if manga is actually in library
    if (chapters && hasLocalData && libraryManga?.inLibrary) {
      console.log("[useMangaData] Auto-syncing chapters to Realm:", {
        libraryId,
        freshCount: chapters.length,
        localCount: libraryManga.chapters?.length ?? 0,
      });
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
      console.log("[useMangaData] CF error detected, showing toast");

      toast.error("Failed to load manga details", {
        description: "Cloudflare verification needed",
        action: {
          label: "Retry",
          onClick: () => {
            console.log("[useMangaData] Retry clicked");
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

  const displayChapters: DisplayChapter[] =
    chapters?.map((ch) => ({
      id: ch.id,
      mangaId: ch.mangaId,
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
    [];

  // [DEBUG] Log display chapters source
  useEffect(() => {
    const source = chapters
      ? "FRESH API"
      : libraryManga?.chapters
      ? "LOCAL REALM"
      : "NONE";
    console.log("[DEBUG useMangaData] Display chapters source:", {
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
