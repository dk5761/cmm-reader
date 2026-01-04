/**
 * ReaderV2 Store (Zustand)
 *
 * Single source of truth for reader state.
 * Implements Mihon's unidirectional data flow pattern.
 */

import { create } from "zustand";
import type { FlashListRef } from "@shopify/flash-list";
import type { RefObject } from "react";
import type { Chapter, Page } from "@/sources";
import type {
  ReaderStoreState,
  ReaderStoreActions,
  InitializeParams,
  ReaderChapter,
  ViewerChapters,
  AdapterItem,
  ReaderPage,
} from "../types/reader.types";
import { toReaderPage } from "../types/reader.types";

const initialState: ReaderStoreState = {
  viewerChapters: null,
  allChapters: [],
  currentChapterIndex: -1,
  currentPage: 0,
  totalPages: 0,
  isOverlayVisible: false,
  isSeeking: false,
  isLoading: false,
  isInitialized: false,
  error: null,
  flashListRef: null,
  mangaId: "",
  sourceId: "",
};

// Extended actions for V2 store
interface ReaderStoreActionsV2 extends ReaderStoreActions {
  // Accept pre-loaded chapter data (from react-query hook)
  setCurrentChapterData: (chapterData: ReaderChapter) => void;
  // Chapter transitions for infinite scroll
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

        console.log("[ReaderStoreV2] Initialized metadata:", {
          chapterId,
          currentIndex,
          chaptersCount: chapters.length,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to initialize";
        set({ error: message, isLoading: false });
        console.error("[ReaderStoreV2] Initialize error:", error);
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
        console.warn(
          "[ReaderStoreV2] setCurrentChapterData called before initialize - using fallback",
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

      console.log("[ReaderStoreV2] Chapter data set:", {
        chapterId: chapterData.chapter.id,
        totalPages: chapterData.pages.length,
        hasPrev: !!prevChapter,
        hasNext: !!nextChapter,
      });
    },

    // ========================================================================
    // Page Navigation
    // ========================================================================

    setCurrentPage: (page: number) => {
      const { isSeeking, currentPage, totalPages, viewerChapters, currentChapterIndex } = get();
      // Prevent jitter: don't update if actively seeking
      if (!isSeeking) {
        // DEBUG: Log page updates
        if (page !== currentPage) {
          console.log("[ReaderStoreV2] 📖 setCurrentPage:", {
            newPage: page,
            oldPage: currentPage,
            totalPages,
            currChapterId: viewerChapters?.currChapter?.chapter.id,
            currChapterNumber: viewerChapters?.currChapter?.chapter.number,
            currentChapterIndex,
          });
        }
        set({ currentPage: page });
      } else {
        console.log("[ReaderStoreV2] ⏭️  setCurrentPage SKIPPED (isSeeking):", {
          requestedPage: page,
          currentPage,
        });
      }
    },

    seekToPage: (page: number) => {
      const { flashListRef, viewerChapters, totalPages } = get();

      set({ isSeeking: true });

      // Calculate offset dynamically based on actual list structure
      let offset = 0;
      if (viewerChapters?.prevChapter) {
        if (viewerChapters.prevChapter.state === "loaded") {
          // Previous chapter pages + transition item between prev and curr
          offset = viewerChapters.prevChapter.pages.length + 1;
        } else {
          // Just the transition item (loading or wait state)
          offset = 1;
        }
      }

      const listIndex = page + offset;

      // Bounds check before scrolling
      if (page < 0 || page >= totalPages) {
        console.warn("[ReaderStoreV2] seekToPage: page out of bounds", {
          page,
          totalPages,
        });
        set({ isSeeking: false });
        return;
      }

      try {
        flashListRef?.current?.scrollToIndex({
          index: listIndex,
          animated: false, // Instant jump like Mihon
        });
      } catch (error) {
        console.warn("[ReaderStoreV2] scrollToIndex failed:", error);
      }

      // Reset seeking flag after a short delay
      setTimeout(() => {
        set({ isSeeking: false, currentPage: page });
      }, 100);
    },

    // ========================================================================
    // Chapter Loading (handled by react-query useChapterLoaderV2)
    // ========================================================================

    loadNextChapter: async () => {
      const { viewerChapters, currentPage } = get();

      if (!viewerChapters?.nextChapter) {
        console.warn("[ReaderStoreV2] loadNextChapter: No next chapter");
        return;
      }
      if (
        viewerChapters.nextChapter.state === "loading" ||
        viewerChapters.nextChapter.state === "loaded"
      ) {
        console.log("[ReaderStoreV2] loadNextChapter: Already loading/loaded", {
          state: viewerChapters.nextChapter.state,
          chapterId: viewerChapters.nextChapter.chapter.id,
          currentPage,
        });
        return;
      }

      console.log("[ReaderStoreV2] 📥 Loading next chapter...", {
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
      console.log("[ReaderStoreV2] setNextChapterLoaded() called:", {
        pagesCount: pages.length,
        currentPage: get().currentPage,
        currentChapterId: get().viewerChapters?.currChapter?.chapter.id,
        nextChapterId: get().viewerChapters?.nextChapter?.chapter.id,
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
    },

    loadPrevChapter: async () => {
      const { viewerChapters } = get();
      if (!viewerChapters?.prevChapter) return;
      if (
        viewerChapters.prevChapter.state === "loading" ||
        viewerChapters.prevChapter.state === "loaded"
      )
        return;

      console.log("[ReaderStoreV2] Loading previous chapter...");
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
      console.error("[ReaderStoreV2] Next chapter load failed:", error);
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
      console.error("[ReaderStoreV2] Previous chapter load failed:", error);
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

      console.log("[ReaderStoreV2] Retrying next chapter...");
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

      console.log("[ReaderStoreV2] Retrying previous chapter...");
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
      const { viewerChapters, allChapters, currentChapterIndex, currentPage } = get();

      if (!viewerChapters?.nextChapter) {
        console.warn("[ReaderStoreV2] transitionToNextChapter: No next chapter");
        return;
      }
      if (viewerChapters.nextChapter.state !== "loaded") {
        console.warn(
          "[ReaderStoreV2] transitionToNextChapter: Next chapter not loaded",
          { state: viewerChapters.nextChapter.state },
        );
        return;
      }

      // The next chapter becomes the current chapter
      const newCurrChapter = viewerChapters.nextChapter;
      const newChapterIndex = currentChapterIndex - 1; // Moving to newer chapter (lower index)

      // The current chapter becomes the previous chapter
      const newPrevChapter: ReaderChapter = {
        ...viewerChapters.currChapter,
        // Keep it loaded so user can scroll back
      };

      // Set up the NEW next chapter (if available)
      const newNextChapter: ReaderChapter | null =
        newChapterIndex > 0
          ? {
              chapter: allChapters[newChapterIndex - 1],
              state: "wait",
              pages: [],
            }
          : null;

      console.log("[ReaderStoreV2] 🔄 Transitioning to next chapter:", {
        fromChapterId: viewerChapters.currChapter.chapter.id,
        fromChapterNumber: viewerChapters.currChapter.chapter.number,
        fromCurrentPage: currentPage,
        toChapterId: newCurrChapter.chapter.id,
        toChapterNumber: newCurrChapter.chapter.number,
        toPagesCount: newCurrChapter.pages.length,
        newChapterIndex,
        hasNewNext: !!newNextChapter,
      });

      set({
        viewerChapters: {
          prevChapter: newPrevChapter,
          currChapter: newCurrChapter,
          nextChapter: newNextChapter,
        },
        currentChapterIndex: newChapterIndex,
        totalPages: newCurrChapter.pages.length,
        currentPage: 0, // Reset to first page of new chapter
      });

      console.log("[ReaderStoreV2] ✅ Next chapter transition complete:", {
        newCurrentPage: 0,
        newTotalPages: newCurrChapter.pages.length,
      });
    },

    transitionToPrevChapter: () => {
      const { viewerChapters, allChapters, currentChapterIndex, currentPage } = get();

      if (!viewerChapters?.prevChapter) {
        console.warn("[ReaderStoreV2] transitionToPrevChapter: No prev chapter");
        return;
      }
      if (viewerChapters.prevChapter.state !== "loaded") {
        console.warn(
          "[ReaderStoreV2] transitionToPrevChapter: Prev chapter not loaded",
          { state: viewerChapters.prevChapter.state },
        );
        return;
      }

      // The prev chapter becomes the current chapter
      const newCurrChapter = viewerChapters.prevChapter;
      const newChapterIndex = currentChapterIndex + 1; // Moving to older chapter (higher index)

      // The current chapter becomes the next chapter
      const newNextChapter: ReaderChapter = {
        ...viewerChapters.currChapter,
        // Keep it loaded so user can scroll forward
      };

      // Set up the NEW prev chapter (if available)
      const newPrevChapter: ReaderChapter | null =
        newChapterIndex < allChapters.length - 1
          ? {
              chapter: allChapters[newChapterIndex + 1],
              state: "wait",
              pages: [],
            }
          : null;

      console.log("[ReaderStoreV2] 🔄 Transitioning to previous chapter:", {
        fromChapterId: viewerChapters.currChapter.chapter.id,
        fromChapterNumber: viewerChapters.currChapter.chapter.number,
        fromCurrentPage: currentPage,
        toChapterId: newCurrChapter.chapter.id,
        toChapterNumber: newCurrChapter.chapter.number,
        toPagesCount: newCurrChapter.pages.length,
        newChapterIndex,
        hasNewPrev: !!newPrevChapter,
      });

      set({
        viewerChapters: {
          prevChapter: newPrevChapter,
          currChapter: newCurrChapter,
          nextChapter: newNextChapter,
        },
        currentChapterIndex: newChapterIndex,
        totalPages: newCurrChapter.pages.length,
        currentPage: newCurrChapter.pages.length - 1, // Last page of new chapter
      });

      console.log("[ReaderStoreV2] ✅ Previous chapter transition complete:", {
        newCurrentPage: newCurrChapter.pages.length - 1,
        newTotalPages: newCurrChapter.pages.length,
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

    // ========================================================================
    // Refs
    // ========================================================================

    setFlashListRef: (ref: RefObject<FlashListRef<AdapterItem>>) => {
      set({ flashListRef: ref });
    },
  }),
);
