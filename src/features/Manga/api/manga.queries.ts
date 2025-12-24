import { useQuery } from "@tanstack/react-query";
import { getSource } from "@/sources";

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
      if (!source) throw new Error(`Source ${sourceId} not found`);
      return source.getMangaDetails(mangaUrl);
    },
    enabled: enabled && !!source && !!mangaUrl,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
      if (!source) throw new Error(`Source ${sourceId} not found`);
      return source.getChapterList(mangaUrl);
    },
    enabled: enabled && !!source && !!mangaUrl,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
