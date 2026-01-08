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
  seekTarget: null,
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
        resumePage: get().currentPage,
      });

      // Resume logic: if we have a saved page from initialization, scroll to it
      if (get().currentPage > 0) {
        logger.reader.log("Resuming at page", { currentPage: get().currentPage });
        // We use a slight delay to ensure FlashList is ready to receive the scroll
        setTimeout(() => {
          get().seekToPage(get().currentPage);
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
      const { isSeeking, seekTarget, currentPage } = get();

      // Prevent jitter: don't update if actively seeking
      if (isSeeking) return;

      // Stale Event Guard:
      // If we recently seeked, ignore updates that don't match the target
      if (seekTarget !== null) {
        if (page === seekTarget) {
          logger.reader.log("Seek confirmed", { page });
          set({ seekTarget: null, currentPage: page });
        }
        return;
      }

      // Normal update
      if (page !== currentPage) {
        set({ currentPage: page });
      }
    },

    seekToPage: (page: number) => {
      const { totalPages } = get();

      set({
        isSeeking: true,
        seekTarget: page,
      });

      // Bounds check before scrolling
      if (page < 0 || page >= totalPages) {
        logger.reader.warn("seekToPage rejected: Out of bounds", {
          page,
          totalPages,
        });
        set({ isSeeking: false, seekTarget: null });
        return;
      }

      // Dispatch Scroll Signal
      const signal = {
        pageIndex: page,
        animated: false,
        timestamp: Date.now(),
      };
      
      set({
        scrollSignal: signal,
      });

      // Reset seeking flag after a short delay
      setTimeout(() => {
        const { currentPage } = get();
        
        // If we are already at the target page release the guard immediately.
        if (currentPage === page) {
           set({ isSeeking: false, seekTarget: null });
        } else {
           set({ isSeeking: false, currentPage: page });
        }
      }, READER_CONFIG.SEEK_DEBOUNCE_MS);

      // Safety: Clear seekTarget after 1s
      setTimeout(() => {
        const { seekTarget, currentPage } = get();
        if (seekTarget !== null) {
          logger.reader.warn("Seek confirmation timeout", {
            target: seekTarget,
            current: currentPage,
          });
          set({ seekTarget: null });
        }
      }, 1000);
    },

    // ========================================================================
    // Chapter Loading (handled by react-query useChapterLoaderV2)
    // ========================================================================

    loadNextChapter: async () => {
      const { viewerChapters } = get();

      if (!viewerChapters?.nextChapter) return;
      if (
        viewerChapters.nextChapter.state === "loading" ||
        viewerChapters.nextChapter.state === "loaded"
      ) return;

      logger.reader.log("Loading next chapter", {
        chapter: viewerChapters.nextChapter.chapter.number,
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

      logger.reader.log("Next chapter loaded", { pages: pages.length });
    },

    loadPrevChapter: async () => {
      const { viewerChapters } = get();
      if (!viewerChapters?.prevChapter) return;
      if (
        viewerChapters.prevChapter.state === "loading" ||
        viewerChapters.prevChapter.state === "loaded"
      )
        return;

      logger.reader.log("Loading previous chapter");
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
      logger.reader.log("Previous chapter loaded", { pages: pages.length });
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

      if (!viewerChapters) return;

      const result = shiftWindowNext(viewerChapters, allChapters, currentChapterIndex);

      if (!result) {
        logger.reader.warn("transitionToNextChapter: shift failed");
        return;
      }

      logger.reader.log("Shifting window to next chapter");

      set({
        viewerChapters: result.newViewer,
      });
    },

    transitionToPrevChapter: () => {
      const { viewerChapters, allChapters, currentChapterIndex } = get();

      if (!viewerChapters) return;

      const result = shiftWindowPrev(viewerChapters, allChapters, currentChapterIndex);

      if (!result) {
        logger.reader.warn("transitionToPrevChapter: shift failed");
        return;
      }

      logger.reader.log("Shifting window to previous chapter");

      set({
        viewerChapters: result.newViewer,
      });
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