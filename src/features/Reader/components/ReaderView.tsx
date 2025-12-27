import { memo, useCallback, useRef, useEffect } from "react";
import { View, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebtoonReader, WebtoonReaderHandle } from "./WebtoonReader";
import { ReaderControls } from "./ReaderControls";
import { useReaderStore } from "../store/useReaderStore";
import {
  useSaveProgress,
  useMarkChapterRead,
  useAddHistoryEntry,
} from "@/features/Library/hooks";
import type { Page, Chapter } from "@/sources";
import type { MangaSchema } from "@/core/database";

interface ReaderViewProps {
  pages: Page[];
  baseUrl?: string;
  chapters?: Chapter[];
  currentChapter?: Chapter;
  libraryManga?: MangaSchema | null;
}

/**
 * ReaderView - Pure UI component for the reader.
 * Uses Tachiyomi-style save-on-exit pattern:
 * - Tracks current page in Zustand store (memory)
 * - Saves to database ONLY on unmount
 */
export const ReaderView = memo(function ReaderView({
  pages,
  baseUrl,
  chapters,
  currentChapter,
  libraryManga,
}: ReaderViewProps) {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<WebtoonReaderHandle>(null);
  const historyLogged = useRef(false);

  // Progress hooks - save functions
  const saveProgress = useSaveProgress();
  const markChapterRead = useMarkChapterRead();
  const addHistoryEntry = useAddHistoryEntry();

  // Get store values
  const initialPage = useReaderStore((s) => s.initialPage);
  const totalPages = useReaderStore((s) => s.totalPages);
  const mangaId = useReaderStore((s) => s.mangaId);
  const chapterId = useReaderStore((s) => s.chapterId);
  const chapterNumber = useReaderStore((s) => s.chapterNumber);
  const sourceId = useReaderStore((s) => s.sourceId);
  const markedAsRead = useReaderStore((s) => s.markedAsRead);

  // ============================================
  // SAVE ON EXIT (Tachiyomi pattern)
  // ============================================
  // Store refs to latest values for cleanup function
  const saveProgressRef = useRef(saveProgress);
  const addHistoryEntryRef = useRef(addHistoryEntry);
  const libraryMangaRef = useRef(libraryManga);
  const currentChapterRef = useRef(currentChapter);

  // Keep refs updated
  useEffect(() => {
    saveProgressRef.current = saveProgress;
    addHistoryEntryRef.current = addHistoryEntry;
    libraryMangaRef.current = libraryManga;
    currentChapterRef.current = currentChapter;
  });

  // Save on unmount - the ONLY place we save to database
  useEffect(() => {
    return () => {
      const state = useReaderStore.getState();
      const manga = libraryMangaRef.current;
      const chapter = currentChapterRef.current;

      if (!state.isInitialized || !manga) {
        console.log(
          "[ReaderView] Skipping save on exit - not initialized or no manga"
        );
        return;
      }

      console.log("[ReaderView] Saving on exit - page:", state.currentPage);

      // Save progress to database
      saveProgressRef.current(
        state.mangaId,
        state.chapterId,
        state.chapterNumber,
        state.currentPage
      );

      // Update history
      addHistoryEntryRef.current({
        mangaId: state.mangaId,
        mangaTitle: manga.title,
        mangaCover: manga.localCover || manga.cover,
        chapterId: state.chapterId,
        chapterNumber: state.chapterNumber,
        chapterTitle: chapter?.title,
        chapterUrl: chapter?.url || "",
        pageReached: state.currentPage,
        totalPages: state.totalPages,
        sourceId: state.sourceId,
      });
    };
  }, []); // Empty deps - runs only on unmount

  // ============================================
  // PAGE CHANGE HANDLER (memory only, no DB save)
  // ============================================
  const handlePageChange = useCallback(
    (page: number) => {
      // Guard: Invalid page
      if (page < 1) return;

      // Update store in memory only - no DB save
      useReaderStore.getState().setPage(page);

      // Log history on first page view (for history screen)
      if (!historyLogged.current && libraryManga && currentChapter) {
        historyLogged.current = true;
        addHistoryEntry({
          mangaId,
          mangaTitle: libraryManga.title,
          mangaCover: libraryManga.localCover || libraryManga.cover,
          chapterId,
          chapterNumber,
          chapterTitle: currentChapter.title,
          chapterUrl: currentChapter.url || "",
          pageReached: page,
          totalPages,
          sourceId,
        });
      }

      // Mark as read when reaching last page (immediate feedback)
      if (page >= totalPages && totalPages > 0 && !markedAsRead) {
        useReaderStore.getState().setMarkedAsRead();
        markChapterRead(mangaId, chapterId, totalPages);
      }
    },
    [
      libraryManga,
      currentChapter,
      mangaId,
      chapterId,
      chapterNumber,
      totalPages,
      sourceId,
      markedAsRead,
      markChapterRead,
      addHistoryEntry,
    ]
  );

  const handleTap = useCallback(() => {
    useReaderStore.getState().toggleControls();
  }, []);

  const handleScrollToPage = useCallback((page: number) => {
    const targetIndex = page - 1;
    scrollViewRef.current?.scrollToIndex(targetIndex, true);
  }, []);

  return (
    <View className="flex-1 bg-black">
      <StatusBar hidden />

      <WebtoonReader
        ref={scrollViewRef}
        pages={pages}
        baseUrl={baseUrl}
        initialPage={initialPage}
        onPageChange={handlePageChange}
        onTap={handleTap}
        paddingBottom={insets.bottom}
      />

      <ReaderControls chapters={chapters} onScrollToPage={handleScrollToPage} />
    </View>
  );
});
