/**
 * useSaveProgressV2 Hook
 *
 * Saves reading progress (history) with debounce.
 * Prevents excessive DB writes during rapid page changes.
 * Uses current chapter from store (updates during infinite scroll).
 */

import { useCallback, useRef, useEffect } from "react";
import {
  useAddHistoryEntry,
  useMarkChapterRead,
  useSaveProgress,
} from "@/features/Library/hooks";
import { useReaderStoreV2 } from "../store/useReaderStoreV2";
import type { Chapter } from "@/sources";

interface ProgressData {
  mangaId: string;
  mangaTitle: string;
  mangaCover?: string;
  mangaUrl?: string;
  chapter: Chapter; // Initial chapter (fallback only)
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
  const saveMangaProgress = useSaveProgress();
  const lastSavedRef = useRef<number>(0);
  const lastChapterIdRef = useRef<string>("");
  const markedAsReadRef = useRef<string>(""); // Track which chapter was marked

  const currentPage = useReaderStoreV2((s) => s.currentPage);
  const totalPages = useReaderStoreV2((s) => s.totalPages);
  const viewerChapters = useReaderStoreV2((s) => s.viewerChapters);

  // Use the current chapter from store (updates during infinite scroll)
  // Fall back to prop for initial render before store is initialized
  const currentChapter = viewerChapters?.currChapter?.chapter ?? data?.chapter;

  const save = useCallback(
    (forceUpdate = false) => {
      if (!data || !currentChapter) return;

      const now = Date.now();
      const isNewChapter = currentChapter.id !== lastChapterIdRef.current;

      // Force save on chapter change or if forceUpdate is true
      const shouldForce = forceUpdate || isNewChapter;

      // Debounce: save min every 10s unless forced
      if (!shouldForce && now - lastSavedRef.current < DEBOUNCE_MS) {
        return;
      }

      lastSavedRef.current = now;
      lastChapterIdRef.current = currentChapter.id;

      // 1. Update History Collection (for History tab)
      addHistoryEntry({
        mangaId: data.mangaId,
        mangaTitle: data.mangaTitle,
        mangaCover: data.mangaCover,
        mangaUrl: data.mangaUrl,
        chapterId: currentChapter.id,
        chapterNumber: currentChapter.number,
        chapterTitle: currentChapter.title,
        chapterUrl: currentChapter.url,
        pageReached: currentPage + 1, // 1-indexed for display
        totalPages,
        sourceId: data.sourceId,
      });

      // 2. Update Manga Object (for Library/Resume)
      // Note: mangaId here should be the libraryId (source_id)
      const libraryId =
        data.mangaId && data.sourceId
          ? data.mangaId.startsWith(`${data.sourceId}_`)
            ? data.mangaId
            : `${data.sourceId}_${data.mangaId}`
          : data.mangaId;

      saveMangaProgress(
        libraryId,
        currentChapter.id,
        currentChapter.number,
        currentPage // Store 0-indexed for initialization
      );
    },
    [data, currentChapter, currentPage, totalPages, addHistoryEntry, saveMangaProgress],
  );

  // Auto-save on page change (debounced)
  useEffect(() => {
    if (currentPage > 0 && totalPages > 0) {
      save(false);
    }
  }, [currentPage, save]);

  // Define markRead callback first
  const markRead = useCallback(() => {
    if (!data || !currentChapter) return;

    // Smart libraryId construction: handle both raw mangaId and already-prefixed formats
    const libraryId =
      data.mangaId && data.sourceId
        ? data.mangaId.startsWith(`${data.sourceId}_`)
          ? data.mangaId
          : `${data.sourceId}_${data.mangaId}`
        : data.mangaId;

    markedAsReadRef.current = currentChapter.id;

    console.log(`[Progress] Marked chapter ${currentChapter.number} read`);

    markChapterRead(libraryId, currentChapter.id, totalPages);
  }, [data, currentChapter, currentPage, totalPages, markChapterRead]);

  // Auto-mark as read at 95% threshold
  useEffect(() => {
    if (!data || !currentChapter || totalPages === 0) return;

    const progress = (currentPage + 1) / totalPages;
    const chapterId = currentChapter.id;
    const alreadyMarked = markedAsReadRef.current === chapterId;

    // Check if we crossed 95% and haven't marked this chapter yet
    if (progress >= READ_THRESHOLD && !alreadyMarked) {
      markRead();
    } else if (alreadyMarked && progress < READ_THRESHOLD) {
      // Reset if user goes back below threshold (e.g., seeks backward)
      markedAsReadRef.current = "";
    }
  }, [currentPage, totalPages, data, currentChapter, markRead]);

  // Force save on unmount
  useEffect(() => {
    return () => {
      save(true);
    };
  }, [save]);

  return { save };
}
