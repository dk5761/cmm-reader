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
import { DownloadStatus } from "@/shared/contexts/DownloadContext";
import * as FileSystem from "expo-file-system/legacy";

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}downloads/`;

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
  chapter: (Chapter & { downloadStatus?: number; mangaId: string }) | null,
  enabled = true
) {
  const source = getSource(sourceId);

  return useQuery({
    queryKey: chapterPagesQueryKey(sourceId, chapter?.url ?? ""),
    queryFn: async (): Promise<ReaderChapter> => {
      if (!source) throw new Error(`Source ${sourceId} not found`);
      if (!chapter) throw new Error("No chapter provided");

      console.log(
        `[useChapterLoaderV2] Loading pages for chapter ${chapter.id} (Status: ${chapter.downloadStatus})`
      );

      let pages: Page[] = [];

      // Check if downloaded
      if (chapter.downloadStatus === DownloadStatus.DOWNLOADED) {
        console.log(`[useChapterLoaderV2] Loading from local storage`);
        const chapterDir = `${DOWNLOADS_DIR}${sourceId}/${chapter.mangaId}/${chapter.id}/`;
        
        try {
          // Read directory to get files (in case page count differs or to verify)
          const files = await FileSystem.readDirectoryAsync(chapterDir);
          // Sort files (000.jpg, 001.jpg)
          const imageFiles = files
            .filter(f => f.endsWith(".jpg") || f.endsWith(".png") || f.endsWith(".webp"))
            .sort();
            
          if (imageFiles.length > 0) {
            pages = imageFiles.map((file, index) => ({
              index,
              imageUrl: `file://${chapterDir}${file}`,
              headers: {}, // No headers needed for local files
            }));
          } else {
             // Fallback to network if folder empty (shouldn't happen if status is DOWNLOADED)
             console.warn("[useChapterLoaderV2] Downloaded folder empty, falling back to network");
             pages = await source.getPageList(chapter.url);
          }
        } catch (e) {
          console.error("[useChapterLoaderV2] Failed to load local files:", e);
          // Fallback
          pages = await source.getPageList(chapter.url);
        }
      } else {
        // Stage 1: Fetch page list (metadata only)
        pages = await source.getPageList(chapter.url);
      }

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

  const fetchChapter = async (sourceId: string, chapter: Chapter & { downloadStatus?: number; mangaId: string }) => {
    const source = getSource(sourceId);
    if (!source) return null;

    return await queryClient.fetchQuery({
      queryKey: chapterPagesQueryKey(sourceId, chapter.url),
      queryFn: async (): Promise<ReaderChapter> => {
        let pages: Page[] = [];

        if (chapter.downloadStatus === DownloadStatus.DOWNLOADED) {
             const chapterDir = `${DOWNLOADS_DIR}${sourceId}/${chapter.mangaId}/${chapter.id}/`;
             try {
                const files = await FileSystem.readDirectoryAsync(chapterDir);
                const imageFiles = files
                    .filter(f => f.endsWith(".jpg") || f.endsWith(".png") || f.endsWith(".webp"))
                    .sort();
                pages = imageFiles.map((file, index) => ({
                    index,
                    imageUrl: `file://${chapterDir}${file}`,
                    headers: {},
                }));
             } catch {
                 pages = await source.getPageList(chapter.url);
             }
        } else {
            pages = await source.getPageList(chapter.url);
        }

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
