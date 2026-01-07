/**
 * usePreloaderV2 Hook
 *
 * Implements Mihon's Stage 3: Preload Buffer (Priority 0)
 * When Page N is visible, prefetch pages N+1 to N+4 in the background.
 */

import { useEffect, useRef, useCallback } from "react";
import { Image } from "expo-image";
import type { ReaderPage } from "../types/reader.types";
import { READER_CONFIG } from "../config";

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
  const prefetchedSet = useRef<Set<string>>(new Set());
  // Maintain a queue of prefetched URLs to limit tracking set size (sliding window)
  const prefetchedQueue = useRef<string[]>([]);
  // Track last page to avoid unnecessary work
  const lastPageRef = useRef<number>(-1);
  // Track chapter ID to clear cache on chapter change
  const lastChapterIdRef = useRef<string>("");

  // Clear tracking when chapter changes (Memory efficiency)
  useEffect(() => {
    if (chapterId && chapterId !== lastChapterIdRef.current) {
      prefetchedSet.current.clear();
      prefetchedQueue.current = [];
      lastPageRef.current = -1;
      lastChapterIdRef.current = chapterId;
    }
  }, [chapterId]);

  useEffect(() => {
    // Skip if no pages or same page
    if (pages.length === 0 || currentPage === lastPageRef.current) {
      return;
    }

    // Only preload when moving forward or making a significant jump
    const diff = currentPage - lastPageRef.current;
    if (diff < 0 && Math.abs(diff) < 3) {
      return; // Skip small backward movements
    }

    lastPageRef.current = currentPage;

    // Calculate preload window: N+1 to N+AHEAD_COUNT
    const startIdx = currentPage + 1;
    const endIdx = Math.min(startIdx + READER_CONFIG.PRELOAD.AHEAD_COUNT, pages.length);
    const pagesToPreload = pages.slice(startIdx, endIdx);

    if (pagesToPreload.length === 0) {
      return;
    }

    // Prefetch each page that hasn't been prefetched recently
    for (const page of pagesToPreload) {
      const uri = page.imageUrl;

      if (!prefetchedSet.current.has(uri)) {
        // Track the prefetch
        prefetchedSet.current.add(uri);
        prefetchedQueue.current.push(uri);

        // Keep the tracking set size manageable (Sliding Window)
        if (prefetchedQueue.current.length > READER_CONFIG.PRELOAD.WINDOW_SIZE) {
          const oldestUri = prefetchedQueue.current.shift();
          if (oldestUri) prefetchedSet.current.delete(oldestUri);
        }

        // expo-image prefetch with headers
        Image.prefetch(uri, {
          headers: headers || page.headers,
        }).catch((error) => {
          // Remove from set so we can retry later if needed
          prefetchedSet.current.delete(uri);
          console.warn(
            `[usePreloaderV2] Failed to prefetch page ${page.index}:`,
            error
          );
        });
      }
    }
  }, [pages, currentPage, headers]);

  /**
   * Clear the prefetch tracking (useful when changing chapters)
   */
  const clearPrefetchCache = useCallback(() => {
    prefetchedSet.current.clear();
    prefetchedQueue.current = [];
    lastPageRef.current = -1;
  }, []);

  return { clearPrefetchCache };
}
