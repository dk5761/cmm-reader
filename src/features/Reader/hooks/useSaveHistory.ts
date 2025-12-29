import { useCallback, useRef } from "react";
import { useAddHistoryEntry } from "@/features/Library/hooks";

type HistoryData = {
  mangaId: string;
  mangaTitle: string;
  mangaCover?: string;
  mangaUrl?: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle?: string;
  chapterUrl: string;
  pageReached: number;
  totalPages?: number;
  sourceId: string;
};

const DEBOUNCE_MS = 10000; // Save at most every 10 seconds

/**
 * Hook for saving reading history with debounce
 * Prevents excessive DB writes during rapid page changes
 */
export function useSaveHistory() {
  const addHistoryEntry = useAddHistoryEntry();
  const lastSavedRef = useRef<number>(0);
  const lastChapterIdRef = useRef<string>("");

  const save = useCallback(
    (data: HistoryData, forceUpdate = false) => {
      const now = Date.now();
      const isNewChapter = data.chapterId !== lastChapterIdRef.current;

      // Force save on chapter change or if forceUpdate is true
      const shouldForce = forceUpdate || isNewChapter;

      // Debounce: save min every 10s unless forced
      if (!shouldForce && now - lastSavedRef.current < DEBOUNCE_MS) {
        return;
      }

      lastSavedRef.current = now;
      lastChapterIdRef.current = data.chapterId;

      console.log("[useSaveHistory] Saving:", {
        manga: data.mangaTitle,
        chapter: data.chapterNumber,
        page: data.pageReached,
        forced: shouldForce,
      });

      addHistoryEntry(data);
    },
    [addHistoryEntry]
  );

  return save;
}
