/**
 * ReaderV2 Store (Zustand)
 *
 * Single source of truth for reader state.
 * Implements Mihon's unidirectional data flow pattern.
 */

import { create } from "zustand";
import type { Chapter } from "@/sources";
import type {
  ReaderStoreState,
  ReaderStoreActions,
  InitializeParams,
  ReaderChapter,
  ViewerChapters,
  ReaderPage,
} from "../types/reader.types";
import { logger } from "@/utils/logger";
import { READER_CONFIG } from "../config";
import { shiftWindowNext, shiftWindowPrev } from "../utils/readerWindowUtils";

const initialState: ReaderStoreState = {
  viewerChapters: null,
  allChapters: [],
  currentChapterIndex: -1,
  currentPage: 0,
  totalPages: 0,
  isOverlayVisible: false,
  isSeeking: false,
  scrollSignal: null,
  isLoading: false,
  isInitialized: false,
  error: null,
  mangaId: "",
  sourceId: "",
};

// Extended actions for V2 store
interface ReaderStoreActionsV2 extends ReaderStoreActions {
  // Accept pre-loaded chapter data (from react-query hook)
  setCurrentChapterData: (chapterData: ReaderChapter) => void;
  // Update active chapter metadata (for overlay/slider) - called immediately when entering new chapter
  updateActiveChapter: (chapterId: string, pageIndex: number) => void;
  // Chapter transitions for infinite scroll - called when safe to remove old pages from adapter
  transitionToNextChapter: () => void;
  transitionToPrevChapter: () => void;
  // Get current chapter info (for components that need actual visible chapter)
  getCurrentChapter: () => Chapter | null;
}

export const useReaderStoreV2 = create<ReaderStoreState & ReaderStoreActionsV2>(
  (set, get) => ({
    ...initialState,

    // ========================================================================
    // Initialization
    // ========================================================================

    initialize: async (params: InitializeParams) => {
      const {
        mangaId,
        sourceId,
        chapterId,
        chapters,
        initialPage = 0,
      } = params;

      try {
        // Find the current chapter index
        const currentIndex = chapters.findIndex((c) => c.id === chapterId);
        if (currentIndex === -1) {
          throw new Error(`Chapter ${chapterId} not found`);
        }

        // Only set metadata - setCurrentChapterData handles the actual pages
        set({
          mangaId,
          sourceId,
          allChapters: chapters,
          currentChapterIndex: currentIndex,
          currentPage: initialPage,
          isLoading: false,
          isInitialized: true,
          error: null,
        });

        logger.reader.log("Initialized metadata", {
          chapterId,
          currentIndex,
          chaptersCount: chapters.length,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to initialize";
        set({ error: message, isLoading: false });
        logger.reader.error("Initialize error", { error });
      }
    },

    reset: () => set(initialState),

    // Accept pre-loaded chapter data from react-query
    // Guards against race condition: waits for initialize if needed
    setCurrentChapterData: (chapterData: ReaderChapter) => {
      const { allChapters, currentChapterIndex, isInitialized } = get();

      // Guard: If not initialized and no chapters, this was called too early
      // The data will be set correctly when initialize() runs and triggers a re-render
      if (!isInitialized && allChapters.length === 0) {
        logger.reader.warn(
          "setCurrentChapterData called before initialize - using fallback",
        );
      }

      // Build prev/next only if we have chapters list
      let prevChapter: ReaderChapter | null = null;
      let nextChapter: ReaderChapter | null = null;

      if (allChapters.length > 0 && currentChapterIndex >= 0) {
        // Note: Chapter list is in reverse-chronological order
        // prevChapter = older chapter (higher index in array)
        // nextChapter = newer chapter (lower index in array)
        prevChapter =
          currentChapterIndex < allChapters.length - 1
            ? {
                chapter: allChapters[currentChapterIndex + 1],
                state: "wait",
                pages: [],
              }
            : null;

        nextChapter =
          currentChapterIndex > 0
            ? {
                chapter: allChapters[currentChapterIndex - 1],
                state: "wait",
                pages: [],
              }
            : null;
      }

      const viewerChapters: ViewerChapters = {
        prevChapter,
        currChapter: chapterData,
        nextChapter,
      };

      set({
        viewerChapters,
        totalPages: chapterData.pages.length,
        isLoading: false,
      });

      logger.reader.log("Chapter data set", {
        chapterId: chapterData.chapter.id,
        totalPages: chapterData.pages.length,
        hasPrev: !!prevChapter,
        hasNext: !!nextChapter,
        resumePage: currentPage,
      });

      // Resume logic: if we have a saved page from initialization, scroll to it
      if (currentPage > 0) {
        logger.reader.log("Resuming at page", { currentPage });
        // We use a slight delay to ensure FlashList is ready to receive the scroll
        setTimeout(() => {
          get().seekToPage(currentPage);
        }, 100);
      }
    },

    // Update active chapter metadata (for overlay/slider)
    // Called immediately when user scrolls to page 1 of a different chapter
    // This updates the UI without modifying the adapter structure
    updateActiveChapter: (chapterId: string, pageIndex: number) => {
      const { allChapters, currentChapterIndex, viewerChapters } = get();

      // Find the chapter in allChapters
      const newChapterIndex = allChapters.findIndex((c) => c.id === chapterId);
      if (newChapterIndex === -1) {
        logger.reader.warn("updateActiveChapter: Chapter not found", { chapterId });
        return;
      }

      // Skip if already on this chapter
      if (newChapterIndex === currentChapterIndex) {
        return;
      }

      // Find the chapter data in viewerChapters to get totalPages
      let totalPages = 0;
      if (viewerChapters?.nextChapter?.chapter.id === chapterId) {
        totalPages = viewerChapters.nextChapter.pages.length;
      } else if (viewerChapters?.prevChapter?.chapter.id === chapterId) {
        totalPages = viewerChapters.prevChapter.pages.length;
      } else if (viewerChapters?.currChapter?.chapter.id === chapterId) {
        totalPages = viewerChapters.currChapter.pages.length;
      }

      logger.reader.log("updateActiveChapter", {
        fromChapterIndex: currentChapterIndex,
        toChapterIndex: newChapterIndex,
        chapterId,
        pageIndex,
        totalPages,
      });

      set({
        currentChapterIndex: newChapterIndex,
        currentPage: pageIndex,
        totalPages,
      });
    },

    // ========================================================================
    // Page Navigation
    // ========================================================================

    setCurrentPage: (page: number) => {
      const { isSeeking, currentPage, totalPages, viewerChapters, currentChapterIndex } = get();

      // Always log page changes for debugging
      logger.reader.log("setCurrentPage called", {
        requestedPage: page,
        currentPage,
        totalPages,
        isSeeking,
        currChapterId: viewerChapters?.currChapter?.chapter.id,
        currChapterNumber: viewerChapters?.currChapter?.chapter.number,
        currentChapterIndex,
        willUpdate: !isSeeking && page !== currentPage,
      });

      // Prevent jitter: don't update if actively seeking
      if (!isSeeking) {
        if (page !== currentPage) {
          logger.reader.log("Page updated", {
            from: currentPage,
            to: page,
          });
        }
        set({ currentPage: page });
      } else {
        logger.reader.log("setCurrentPage SKIPPED (isSeeking)", {
          requestedPage: page,
          currentPage,
        });
      }
    },

    seekToPage: (page: number) => {
      const { totalPages } = get();

      set({ isSeeking: true });

      // Bounds check before scrolling
      if (page < 0 || page >= totalPages) {
        logger.reader.warn("seekToPage: page out of bounds", {
          page,
          totalPages,
        });
        set({ isSeeking: false });
        return;
      }

      // Dispatch Scroll Signal
      // The UI component (ReaderScreen/FlashList) will listen to this and handle the actual scrolling
      set({
        scrollSignal: {
          pageIndex: page,
          animated: false, // Instant jump like Mihon
          timestamp: Date.now(),
        },
      });

      // Reset seeking flag after a short delay
      setTimeout(() => {
        set({ isSeeking: false, currentPage: page });
      }, READER_CONFIG.SEEK_DEBOUNCE_MS);
    },

    // ========================================================================
    // Chapter Loading (handled by react-query useChapterLoaderV2)
    // ========================================================================

    loadNextChapter: async () => {
      const { viewerChapters, currentPage } = get();

      if (!viewerChapters?.nextChapter) {
        logger.reader.warn("loadNextChapter: No next chapter");
        return;
      }
      if (
        viewerChapters.nextChapter.state === "loading" ||
        viewerChapters.nextChapter.state === "loaded"
      ) {
        logger.reader.log("loadNextChapter: Already loading/loaded", {
          state: viewerChapters.nextChapter.state,
          chapterId: viewerChapters.nextChapter.chapter.id,
          currentPage,
        });
        return;
      }

      logger.reader.log("Loading next chapter...", {
        chapterId: viewerChapters.nextChapter.chapter.id,
        chapterNumber: viewerChapters.nextChapter.chapter.number,
        currentState: viewerChapters.nextChapter.state,
        currentPage,
      });

      // Update state to loading
      set((state) => ({
        viewerChapters: state.viewerChapters
          ? {
              ...state.viewerChapters,
              nextChapter: {
                ...state.viewerChapters.nextChapter!,
                state: "loading",
              },
            }
          : null,
      }));
    },

    setNextChapterLoaded: (pages: ReaderPage[]) => {
      const state = get();
      logger.reader.log("setNextChapterLoaded() called", {
        pagesCount: pages.length,
        currentPage: state.currentPage,
        totalPages: state.totalPages,
        currentChapterId: state.viewerChapters?.currChapter?.chapter.id,
        currentChapterNumber: state.viewerChapters?.currChapter?.chapter.number,
        nextChapterId: state.viewerChapters?.nextChapter?.chapter.id,
        nextChapterNumber: state.viewerChapters?.nextChapter?.chapter.number,
        currentChapterIndex: state.currentChapterIndex,
      });

      set((state) => ({
        viewerChapters: state.viewerChapters
          ? {
              ...state.viewerChapters,
              nextChapter: {
                ...state.viewerChapters.nextChapter!,
                state: "loaded",
                pages: pages,
              },
            }
          : null,
      }));

      logger.reader.log("Next chapter marked as loaded");
    },

    loadPrevChapter: async () => {
      const { viewerChapters } = get();
      if (!viewerChapters?.prevChapter) return;
      if (
        viewerChapters.prevChapter.state === "loading" ||
        viewerChapters.prevChapter.state === "loaded"
      )
        return;

      logger.reader.log("Loading previous chapter...");
      // Update state to loading
      set((state) => ({
        viewerChapters: state.viewerChapters
          ? {
              ...state.viewerChapters,
              prevChapter: {
                ...state.viewerChapters.prevChapter!,
                state: "loading",
              },
            }
          : null,
      }));
    },

    setPrevChapterLoaded: (pages: ReaderPage[]) => {
      set((state) => ({
        viewerChapters: state.viewerChapters
          ? {
              ...state.viewerChapters,
              prevChapter: {
                ...state.viewerChapters.prevChapter!,
                state: "loaded",
                pages: pages,
              },
            }
          : null,
      }));
    },

    setNextChapterError: (error: string) => {
      logger.reader.error("Next chapter load failed", { error });
      set((state) => ({
        viewerChapters: state.viewerChapters
          ? {
              ...state.viewerChapters,
              nextChapter: state.viewerChapters.nextChapter
                ? {
                    ...state.viewerChapters.nextChapter,
                    state: "error",
                    error,
                  }
                : null,
            }
          : null,
      }));
    },

    setPrevChapterError: (error: string) => {
      logger.reader.error("Previous chapter load failed", { error });
      set((state) => ({
        viewerChapters: state.viewerChapters
          ? {
              ...state.viewerChapters,
              prevChapter: state.viewerChapters.prevChapter
                ? {
                    ...state.viewerChapters.prevChapter,
                    state: "error",
                    error,
                  }
                : null,
            }
          : null,
      }));
    },

    retryNextChapter: () => {
      const { viewerChapters } = get();
      if (!viewerChapters?.nextChapter) return;
      if (viewerChapters.nextChapter.state !== "error") return;

      logger.reader.log("Retrying next chapter...");
      // Reset to wait state so it can be loaded again
      set((state) => ({
        viewerChapters: state.viewerChapters
          ? {
              ...state.viewerChapters,
              nextChapter: {
                ...state.viewerChapters.nextChapter!,
                state: "wait",
                error: undefined,
              },
            }
          : null,
      }));
    },

    retryPrevChapter: () => {
      const { viewerChapters } = get();
      if (!viewerChapters?.prevChapter) return;
      if (viewerChapters.prevChapter.state !== "error") return;

      logger.reader.log("Retrying previous chapter...");
      // Reset to wait state so it can be loaded again
      set((state) => ({
        viewerChapters: state.viewerChapters
          ? {
              ...state.viewerChapters,
              prevChapter: {
                ...state.viewerChapters.prevChapter!,
                state: "wait",
                error: undefined,
              },
            }
          : null,
      }));
    },

    // ========================================================================
    // Chapter Transitions (for infinite scroll)
    // ========================================================================

    transitionToNextChapter: () => {
      const { viewerChapters, allChapters, currentChapterIndex } = get();

      if (!viewerChapters) {
        logger.reader.warn("transitionToNextChapter: No viewer chapters");
        return;
      }

      logger.reader.log("transitionToNextChapter (adapter cleanup)", {
        currentChapterIndex,
      });

      const result = shiftWindowNext(viewerChapters, allChapters, currentChapterIndex);

      if (!result) {
        logger.reader.warn("transitionToNextChapter: shift failed (next not loaded?)");
        return;
      }

      logger.reader.log("Adapter cleanup (next) - shifting ViewerChapters");

      set({
        viewerChapters: result.newViewer,
        // Note: we don't set currentChapterIndex here because updateActiveChapter 
        // should have already been called by the UI when scrolling.
        // However, shiftWindowNext logic assumes we are moving to what was 'next'.
      });

      logger.reader.log("Adapter cleanup (next) complete");
    },

    transitionToPrevChapter: () => {
      const { viewerChapters, allChapters, currentChapterIndex } = get();

      if (!viewerChapters) {
        logger.reader.warn("transitionToPrevChapter: No viewer chapters");
        return;
      }

      logger.reader.log("transitionToPrevChapter (adapter cleanup)", {
        currentChapterIndex,
      });

      const result = shiftWindowPrev(viewerChapters, allChapters, currentChapterIndex);

      if (!result) {
        logger.reader.warn("transitionToPrevChapter: shift failed (prev not loaded?)");
        return;
      }

      logger.reader.log("Adapter cleanup (prev) - shifting ViewerChapters");

      set({
        viewerChapters: result.newViewer,
      });

      logger.reader.log("Adapter cleanup (prev) complete");
    },

    getCurrentChapter: () => {
      const { viewerChapters } = get();
      return viewerChapters?.currChapter?.chapter ?? null;
    },

    // ========================================================================
    // UI
    // ========================================================================

    toggleOverlay: () =>
      set((s) => ({ isOverlayVisible: !s.isOverlayVisible })),

    setIsSeeking: (value: boolean) => set({ isSeeking: value }),
  }),
);