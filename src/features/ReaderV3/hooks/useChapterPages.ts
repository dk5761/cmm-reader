/**
 * useChapterPages - React Query hook to fetch pages for a chapter
 */

import { useQuery } from "@tanstack/react-query";
import { getSource } from "@/sources";
import type { Page } from "@/sources";

export function useChapterPages(
  sourceId: string | null,
  chapterUrl: string | null,
  enabled: boolean = true
) {
  return useQuery<Page[]>({
    queryKey: ["chapter-pages", sourceId, chapterUrl],
    queryFn: async () => {
      if (!sourceId || !chapterUrl) {
        throw new Error("Missing sourceId or chapterUrl");
      }

      const source = getSource(sourceId);
      if (!source) {
        throw new Error(`Source ${sourceId} not found`);
      }

      const pages = await source.getPageList(chapterUrl);

      // Attach headers from source
      const headers = source.getImageHeaders();
      return pages.map((p) => ({ ...p, headers }));
    },
    enabled: enabled && !!sourceId && !!chapterUrl,
    staleTime: Infinity,
    refetchOnMount: false,
  });
}
