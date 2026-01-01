import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { getSource } from "@/sources";
import type { Manga, SearchResult } from "@/sources";
import { isCfError } from "@/core/http/utils/cfErrorHandler";

/**
 * Search manga by query
 */
export function useSearchManga(
  sourceId: string,
  query: string,
  sessionReady = true
) {
  const source = getSource(sourceId);

  return useInfiniteQuery({
    queryKey: ["search", sourceId, query],
    queryFn: async ({ pageParam = 1 }) => {
      console.log(
        `[useSearchManga] Fetching page ${pageParam} for "${query}" from ${sourceId}`
      );
      if (!source) throw new Error(`Source ${sourceId} not found`);
      if (!query.trim()) return { manga: [], hasNextPage: false };

      try {
        const result = await source.search(query, pageParam);
        console.log(
          `[useSearchManga] Success: ${result.manga.length} manga found`
        );
        return result;
      } catch (error) {
        console.error(`[useSearchManga] Error:`, error);
        throw error;
      }
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasNextPage ? allPages.length + 1 : undefined,
    retry: (failureCount, error) => {
      // Don't auto-retry CF errors - wait for manual retry
      if (isCfError(error)) {
        console.log("[useSearchManga] CF error detected, disabling retry");
        return false;
      }
      return failureCount < 3;
    },
    enabled: !!query.trim() && !!source && sessionReady,
    initialPageParam: 1,
  });
}

/**
 * Get popular manga
 */
export function usePopularManga(sourceId: string, sessionReady = true) {
  const source = getSource(sourceId);

  return useInfiniteQuery({
    queryKey: ["popular", sourceId],
    queryFn: async ({ pageParam = 1 }) => {
      console.log(
        `[usePopularManga] Fetching page ${pageParam} for ${sourceId}`
      );
      if (!source) throw new Error(`Source ${sourceId} not found`);

      try {
        const result = await source.getPopular(pageParam);
        console.log(
          `[usePopularManga] Success: ${result.manga.length} manga found`
        );
        return result;
      } catch (error) {
        console.error(`[usePopularManga] Error:`, error);
        throw error;
      }
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasNextPage ? allPages.length + 1 : undefined,
    retry: (failureCount, error) => {
      // Don't auto-retry CF errors - wait for manual retry
      if (isCfError(error)) {
        console.log("[usePopularManga] CF error detected, disabling retry");
        return false;
      }
      return failureCount < 3;
    },
    enabled: !!source && sessionReady,
    initialPageParam: 1,
  });
}

/**
 * Get latest updated manga
 */
export function useLatestManga(sourceId: string, sessionReady = true) {
  const source = getSource(sourceId);

  return useInfiniteQuery({
    queryKey: ["latest", sourceId],
    queryFn: async ({ pageParam = 1 }) => {
      console.log(
        `[useLatestManga] Fetching page ${pageParam} for ${sourceId}`
      );
      if (!source) throw new Error(`Source ${sourceId} not found`);

      try {
        const result = await source.getLatest(pageParam);
        console.log(
          `[useLatestManga] Success: ${result.manga.length} manga found`
        );
        return result;
      } catch (error) {
        console.error(`[useLatestManga] Error:`, error);
        throw error;
      }
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasNextPage ? allPages.length + 1 : undefined,
    retry: (failureCount, error) => {
      // Don't auto-retry CF errors - wait for manual retry
      if (isCfError(error)) {
        console.log("[useLatestManga] CF error detected, disabling retry");
        return false;
      }
      return failureCount < 3;
    },
    enabled: !!source && sessionReady,
    initialPageParam: 1,
  });
}

/**
 * Flatten infinite query pages into single array
 */
export function flattenMangaPages(pages: SearchResult[] | undefined): Manga[] {
  if (!pages) return [];
  return pages.flatMap((page) => page.manga);
}
