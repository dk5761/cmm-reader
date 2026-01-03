/**
 * usePreloaderV2 Hook
 *
 * Implements Mihon's Stage 3: Preload Buffer (Priority 0)
 * When Page N is visible, prefetch pages N+1 to N+4 in the background.
 */

import { useEffect, useRef, useCallback } from "react";
import { Image } from "expo-image";
import type { ReaderPage } from "../types/reader.types";

const PRELOAD_COUNT = 4;

/**
 * Preload upcoming pages for smoother reading experience.
 * Uses expo-image's prefetch which handles disk/memory caching.
 */
export function usePreloaderV2(
  pages: ReaderPage[],
  currentPage: number,
  chapterId?: string,
  headers?: Record<string, string>
) {
  // Track which URLs we've already started prefetching
  const prefetchedRef = useRef<Set<string>>(new Set());
  // Track last page to avoid unnecessary work
  const lastPageRef = useRef<number>(-1);
  // Track chapter ID to clear cache on chapter change
  const lastChapterIdRef = useRef<string>("");

  // Clear cache when chapter changes (Fix #5: Memory leak)
  useEffect(() => {
    if (chapterId && chapterId !== lastChapterIdRef.current) {
      if (lastChapterIdRef.current !== "") {
        // Only log if this is a chapter switch, not initial load
        console.log(
          `[usePreloaderV2] Chapter changed, clearing prefetch cache`
        );
      }
      prefetchedRef.current.clear();
      lastPageRef.current = -1;
      lastChapterIdRef.current = chapterId;
    }
  }, [chapterId]);

  useEffect(() => {
    // Skip if no pages or same page
    if (pages.length === 0 || currentPage === lastPageRef.current) {
      return;
    }

    // Only preload when moving forward or making a big jump
    const diff = currentPage - lastPageRef.current;
    if (diff < 0 && Math.abs(diff) < 3) {
      return; // Skip small backward movements
    }

    lastPageRef.current = currentPage;

    // Calculate preload window: N+1 to N+PRELOAD_COUNT
    const startIdx = currentPage + 1;
    const endIdx = Math.min(startIdx + PRELOAD_COUNT, pages.length);
    const pagesToPreload = pages.slice(startIdx, endIdx);

    if (pagesToPreload.length === 0) {
      return;
    }

    // Prefetch each page that hasn't been prefetched yet
    for (const page of pagesToPreload) {
      const uri = page.imageUrl;

      if (!prefetchedRef.current.has(uri)) {
        prefetchedRef.current.add(uri);

        // expo-image prefetch with headers if needed
        Image.prefetch(uri, {
          headers: headers || page.headers,
        }).catch((error) => {
          // Remove from set so we can retry later
          prefetchedRef.current.delete(uri);
          console.warn(
            `[usePreloaderV2] Failed to prefetch page ${page.index}:`,
            error
          );
        });
      }
    }

    console.log(
      `[usePreloaderV2] Prefetching pages ${startIdx} to ${endIdx - 1}`
    );
  }, [pages, currentPage, headers]);

  /**
   * Clear the prefetch tracking (useful when changing chapters)
   */
  const clearPrefetchCache = useCallback(() => {
    prefetchedRef.current.clear();
    lastPageRef.current = -1;
  }, []);

  return { clearPrefetchCache };
}
