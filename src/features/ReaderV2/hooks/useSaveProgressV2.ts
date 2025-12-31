/**
 * useSaveProgressV2 Hook
 *
 * Saves reading progress (history) with debounce.
 * Prevents excessive DB writes during rapid page changes.
 */

import { useCallback, useRef, useEffect } from "react";
import {
  useAddHistoryEntry,
  useMarkChapterRead,
} from "@/features/Library/hooks";
import { useReaderStoreV2 } from "../store/useReaderStoreV2";
import type { Chapter } from "@/sources";

interface ProgressData {
  mangaId: string;
  mangaTitle: string;
  mangaCover?: string;
  mangaUrl?: string;
  chapter: Chapter;
  sourceId: string;
}

const DEBOUNCE_MS = 10000; // Save at most every 10 seconds
const READ_THRESHOLD = 0.95; // Mark as read at 95%

/**
 * Hook for saving reading progress with debounce
 */
export function useSaveProgressV2(data: ProgressData | null) {
  const addHistoryEntry = useAddHistoryEntry();
  const markChapterRead = useMarkChapterRead();
  const lastSavedRef = useRef<number>(0);
  const lastChapterIdRef = useRef<string>("");
  const markedAsReadRef = useRef<string>(""); // Track which chapter was marked

  const currentPage = useReaderStoreV2((s) => s.currentPage);
  const totalPages = useReaderStoreV2((s) => s.totalPages);

  const save = useCallback(
    (forceUpdate = false) => {
      if (!data) return;

      const now = Date.now();
      const isNewChapter = data.chapter.id !== lastChapterIdRef.current;

      // Force save on chapter change or if forceUpdate is true
      const shouldForce = forceUpdate || isNewChapter;

      // Debounce: save min every 10s unless forced
      if (!shouldForce && now - lastSavedRef.current < DEBOUNCE_MS) {
        return;
      }

      lastSavedRef.current = now;
      lastChapterIdRef.current = data.chapter.id;

      console.log("[useSaveProgressV2] Saving:", {
        manga: data.mangaTitle,
        chapter: data.chapter.number,
        page: currentPage + 1,
        forced: shouldForce,
      });

      addHistoryEntry({
        mangaId: data.mangaId,
        mangaTitle: data.mangaTitle,
        mangaCover: data.mangaCover,
        mangaUrl: data.mangaUrl,
        chapterId: data.chapter.id,
        chapterNumber: data.chapter.number,
        chapterTitle: data.chapter.title,
        chapterUrl: data.chapter.url,
        pageReached: currentPage + 1, // 1-indexed for display
        totalPages,
        sourceId: data.sourceId,
      });
    },
    [data, currentPage, totalPages, addHistoryEntry]
  );

  // Auto-save on page change (debounced)
  useEffect(() => {
    if (currentPage > 0 && totalPages > 0) {
      save(false);
    }
  }, [currentPage, save]);

  // Define markRead callback first
  const markRead = useCallback(() => {
    if (!data) return;

    // Smart libraryId construction: handle both raw mangaId and already-prefixed formats
    const libraryId = data.mangaId.startsWith(data.sourceId + "_")
      ? data.mangaId // Already in libraryId format
      : `${data.sourceId}_${data.mangaId}`; // Construct it

    markedAsReadRef.current = data.chapter.id;

    console.log("[useSaveProgressV2] Marking as read (95%):", {
      manga: data.mangaTitle,
      chapter: data.chapter.number,
      libraryId,
      chapterId: data.chapter.id,
      progress: (((currentPage + 1) / totalPages) * 100).toFixed(1) + "%",
    });

    markChapterRead(libraryId, data.chapter.id, totalPages);
  }, [data, currentPage, totalPages, markChapterRead]);

  // Auto-mark as read at 95% threshold
  useEffect(() => {
    if (!data || totalPages === 0) return;

    const progress = (currentPage + 1) / totalPages;
    const chapterId = data.chapter.id;
    const alreadyMarked = markedAsReadRef.current === chapterId;

    console.log("[useSaveProgressV2] Auto-read check:", {
      chapter: data.chapter.number,
      page: `${currentPage + 1}/${totalPages}`,
      progress: (progress * 100).toFixed(1) + "%",
      meetsThreshold: progress >= READ_THRESHOLD,
      alreadyMarked,
    });

    // Check if we crossed 95% and haven't marked this chapter yet
    if (progress >= READ_THRESHOLD && !alreadyMarked) {
      console.log("[useSaveProgressV2] ✓ Triggering mark as read!");
      markRead();
    } else if (alreadyMarked && progress < READ_THRESHOLD) {
      // Reset if user goes back below threshold (e.g., seeks backward)
      console.log("[useSaveProgressV2] Reset mark flag");
      markedAsReadRef.current = "";
    }
  }, [currentPage, totalPages, data, markRead]);

  // Force save on unmount
  useEffect(() => {
    return () => {
      save(true);
    };
  }, [save]);

  return { save };
}
