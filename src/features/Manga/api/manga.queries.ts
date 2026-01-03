import { useQuery } from "@tanstack/react-query";
import { getSource } from "@/sources";
import { isCfError } from "@/core/http/utils/cfErrorHandler";

/**
 * Get manga details
 */
export function useMangaDetails(
  sourceId: string,
  mangaUrl: string,
  enabled: boolean = true
) {
  const source = getSource(sourceId);

  return useQuery({
    queryKey: ["manga", sourceId, mangaUrl],
    queryFn: async () => {
      console.log(
        `[useMangaDetails] Fetching details for ${mangaUrl.substring(0, 60)}`
      );
      if (!source) throw new Error(`Source ${sourceId} not found`);

      try {
        const result = await source.getMangaDetails(mangaUrl);
        console.log(`[useMangaDetails] Success: ${result.title}`);
        return result;
      } catch (error) {
        console.error(`[useMangaDetails] Error:`, error);
        throw error;
      }
    },
    retry: (failureCount, error) => {
      // Don't auto-retry CF errors - wait for manual retry
      if (isCfError(error)) {
        console.log("[useMangaDetails] CF error detected, disabling retry");
        return false;
      }
      return failureCount < 3;
    },
    enabled: enabled && !!source && !!mangaUrl,
    staleTime: Infinity, // Never auto-stale - use cached data
    refetchOnMount: false, // Don't refetch on navigation
  });
}

/**
 * Get chapter list for manga
 */
export function useChapterList(
  sourceId: string,
  mangaUrl: string,
  enabled: boolean = true
) {
  const source = getSource(sourceId);

  return useQuery({
    queryKey: ["chapters", sourceId, mangaUrl],
    queryFn: async () => {
      console.log(
        `[useChapterList] Fetching chapters for ${mangaUrl.substring(0, 60)}`
      );
      if (!source) throw new Error(`Source ${sourceId} not found`);

      try {
        const result = await source.getChapterList(mangaUrl);
        console.log(`[useChapterList] Success: ${result.length} chapters`);
        return result;
      } catch (error) {
        console.error(`[useChapterList] Error:`, error);
        throw error;
      }
    },
    retry: (failureCount, error) => {
      // Don't auto-retry CF errors - wait for manual retry
      if (isCfError(error)) {
        console.log("[useChapterList] CF error detected, disabling retry");
        return false;
      }
      return failureCount < 3;
    },
    enabled: enabled && !!source && !!mangaUrl,
    staleTime: Infinity, // Never auto-stale - use cached data
    refetchOnMount: false, // Don't refetch on navigation
  });
}
