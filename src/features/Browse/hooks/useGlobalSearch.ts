import { useQueries } from "@tanstack/react-query";
import { getAvailableSources } from "@/sources";
import type { Source, SearchResult } from "@/sources";
import { useAppSettingsStore } from "@/shared/stores";
import { isCfError } from "@/core/http/utils/cfErrorHandler";

export interface SourceSearchResult {
  sourceId: string;
  sourceName: string;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  data: SearchResult | undefined;
}

/**
 * Hook to search across all available sources simultaneously
 */
export function useGlobalSearch(query: string, enabled = true) {
  const { showNsfwSources } = useAppSettingsStore();
  const sources = getAvailableSources(showNsfwSources);

  const queries = useQueries({
    queries: sources.map((source: Source) => ({
      queryKey: ["global-search", source.id, query],
      queryFn: async () => {
        console.log(
          `[useGlobalSearch] Searching ${source.name} for "${query}"`
        );
        try {
          const result = await source.search(query, 1); // Only first page for global search
          console.log(
            `[useGlobalSearch] ${source.name}: ${result.manga.length} results`
          );
          return result;
        } catch (error) {
          console.error(`[useGlobalSearch] ${source.name} error:`, error);
          throw error;
        }
      },
      enabled: enabled && !!query.trim(),
      retry: (failureCount: number, error: Error) => {
        // Don't auto-retry CF errors
        if (isCfError(error)) {
          console.log(
            `[useGlobalSearch] ${source.name}: CF error, disabling retry`
          );
          return false;
        }
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes - avoid re-fetching same query
    })),
  });

  // Transform query results to source-specific results
  const results: SourceSearchResult[] = sources.map((source, index) => ({
    sourceId: source.id,
    sourceName: source.name,
    isLoading: queries[index].isLoading,
    isError: queries[index].isError,
    error: queries[index].error,
    data: queries[index].data,
  }));

  // Overall loading state (true if ANY source is loading)
  const isLoading = queries.some((q) => q.isLoading);

  // Overall error state (true if ALL sources errored)
  const isError = queries.every((q) => q.isError);

  // Total results count
  const totalResults = results.reduce(
    (sum, result) => sum + (result.data?.manga.length || 0),
    0
  );

  return {
    results,
    isLoading,
    isError,
    totalResults,
  };
}
