/**
 * useChapterLoaderV2 Hook
 *
 * Implements Mihon's Stage 1: Chapter Structure (Immediate)
 * Fetches page list (metadata only, no images) for fast initial render.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSource } from "@/sources";
import type { Chapter, Page } from "@/sources";
import type { ReaderChapter, ReaderPage } from "../types/reader.types";
import { toReaderPage } from "../types/reader.types";

/**
 * Query key factory for chapter pages
 */
export const chapterPagesQueryKey = (sourceId: string, chapterUrl: string) =>
  ["pages", sourceId, chapterUrl] as const;

/**
 * Hook to load chapter pages
 */
export function useChapterLoaderV2(
  sourceId: string,
  chapter: Chapter | null,
  enabled = true
) {
  const source = getSource(sourceId);

  return useQuery({
    queryKey: chapterPagesQueryKey(sourceId, chapter?.url ?? ""),
    queryFn: async (): Promise<ReaderChapter> => {
      if (!source) throw new Error(`Source ${sourceId} not found`);
      if (!chapter) throw new Error("No chapter provided");

      console.log(
        `[useChapterLoaderV2] Loading pages for chapter ${chapter.id}`
      );

      // Stage 1: Fetch page list (metadata only)
      const pages: Page[] = await source.getPageList(chapter.url);

      // Convert to ReaderPage (with loading state)
      const readerPages: ReaderPage[] = pages.map(toReaderPage);

      return {
        chapter,
        state: "loaded",
        pages: readerPages,
      };
    },
    enabled: enabled && !!source && !!chapter,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Function to prefetch a chapter's pages (for adjacent chapters)
 */
export function usePrefetchChapter() {
  const queryClient = useQueryClient();

  const fetchChapter = async (sourceId: string, chapter: Chapter) => {
    const source = getSource(sourceId);
    if (!source) return null;

    return await queryClient.fetchQuery({
      queryKey: chapterPagesQueryKey(sourceId, chapter.url),
      queryFn: async (): Promise<ReaderChapter> => {
        const pages = await source.getPageList(chapter.url);
        const readerPages: ReaderPage[] = pages.map(toReaderPage);
        return {
          chapter,
          state: "loaded",
          pages: readerPages,
        };
      },
      staleTime: 10 * 60 * 1000,
    });
  };

  return { fetchChapter };
}
