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
  error: null,
  flashListRef: null,
  mangaId: "",
  sourceId: "",
};

// Extended actions for V2 store
interface ReaderStoreActionsV2 extends ReaderStoreActions {
  // Accept pre-loaded chapter data (from react-query hook)
  setCurrentChapterData: (chapterData: ReaderChapter) => void;
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
    // This can be called before or after initialize - handles both cases
    setCurrentChapterData: (chapterData: ReaderChapter) => {
      const { allChapters, currentChapterIndex } = get();

      // Build prev/next only if we have chapters list
      let prevChapter: ReaderChapter | null = null;
      let nextChapter: ReaderChapter | null = null;

      if (allChapters.length > 0 && currentChapterIndex >= 0) {
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
        hasPrevNext: allChapters.length > 0,
      });
    },

    // ========================================================================
    // Page Navigation
    // ========================================================================

    setCurrentPage: (page: number) => {
      const { isSeeking } = get();
      // Prevent jitter: don't update if actively seeking
      if (!isSeeking) {
        set({ currentPage: page });
      }
    },

    seekToPage: (page: number) => {
      const { flashListRef } = get();

      set({ isSeeking: true });

      // Add 1 to account for the "prev" transition item at index 0
      const listIndex = page + 1;

      flashListRef?.current?.scrollToIndex({
        index: listIndex,
        animated: false, // Instant jump like Mihon
      });

      // Reset seeking flag after a short delay
      setTimeout(() => {
        set({ isSeeking: false, currentPage: page });
      }, 100);
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
      )
        return;

      console.log("[ReaderStoreV2] Loading next chapter...");

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
  })
);
