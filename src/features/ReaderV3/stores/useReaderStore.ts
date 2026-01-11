/**
 * ReaderV3 Zustand Store
 * Manages reader state: chapters, pages, navigation, overlay
 */

import { create } from "zustand";
import { getSource } from "@/sources";
import type { Page, Chapter } from "@/sources";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ChapterWithPages {
  id: string;
  number: number;
  title: string;
  url: string;
  pages: Page[];
}

export interface FlatPage {
  /** Unique key for FlashList */
  key: string;
  /** Index in flat array */
  flatIndex: number;
  /** Image URL */
  imageUrl: string;
  /** Headers for image loading */
  headers?: Record<string, string>;
  /** Chapter info */
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  /** Page index within chapter (0-based) */
  pageIndex: number;
  /** Total pages in this chapter */
  totalPagesInChapter: number;
}

export interface ChapterInfo {
  id: string;
  number: number;
  title: string;
}

interface InitParams {
  chapterId: string;
  chapterUrl: string;
  sourceId: string;
  mangaId: string;
  mangaUrl: string;
  /** All chapters for the manga (for next/prev navigation) */
  allChapters: Chapter[];
}

interface ReaderState {
  // Init params
  sourceId: string | null;
  mangaId: string | null;
  mangaUrl: string | null;
  allChapters: Chapter[];

  // Data
  chapters: ChapterWithPages[];
  flatPages: FlatPage[];

  // Navigation
  currentFlatIndex: number;
  isLoadingChapter: boolean;
  error: string | null;

  // UI
  isOverlayVisible: boolean;

  // Derived getters (computed in selectors)
  // currentChapter, currentPageInChapter, totalPages

  // Actions
  initReader: (params: InitParams) => Promise<void>;
  setCurrentFlatIndex: (index: number) => void;
  toggleOverlay: () => void;
  hideOverlay: () => void;
  loadNextChapter: () => Promise<void>;
  loadPreviousChapter: () => Promise<void>;
  saveProgress: () => void;
  reset: () => void;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function flattenChapters(chapters: ChapterWithPages[]): FlatPage[] {
  const flat: FlatPage[] = [];
  let flatIndex = 0;

  for (const chapter of chapters) {
    for (let i = 0; i < chapter.pages.length; i++) {
      flat.push({
        key: `${chapter.id}-${i}`,
        flatIndex,
        imageUrl: chapter.pages[i].imageUrl,
        headers: chapter.pages[i].headers,
        chapterId: chapter.id,
        chapterNumber: chapter.number,
        chapterTitle: chapter.title,
        pageIndex: i,
        totalPagesInChapter: chapter.pages.length,
      });
      flatIndex++;
    }
  }

  return flat;
}

async function fetchChapterPages(
  sourceId: string,
  chapterUrl: string,
  chapter: Chapter
): Promise<ChapterWithPages> {
  const source = getSource(sourceId);
  if (!source) throw new Error(`Source ${sourceId} not found`);

  const pages = await source.getPageList(chapterUrl);
  const headers = source.getImageHeaders();

  return {
    id: chapter.id,
    number: chapter.number,
    title: chapter.title || `Chapter ${chapter.number}`,
    url: chapter.url,
    pages: pages.map((p) => ({ ...p, headers })),
  };
}

// ─────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────

const initialState = {
  sourceId: null,
  mangaId: null,
  mangaUrl: null,
  allChapters: [],
  chapters: [],
  flatPages: [],
  currentFlatIndex: 0,
  isLoadingChapter: false,
  error: null,
  isOverlayVisible: false,
};

export const useReaderStore = create<ReaderState>((set, get) => ({
  ...initialState,

  initReader: async (params) => {
    const { chapterId, chapterUrl, sourceId, mangaId, mangaUrl, allChapters } =
      params;

    set({
      sourceId,
      mangaId,
      mangaUrl,
      allChapters,
      isLoadingChapter: true,
      error: null,
    });

    try {
      // Find chapter in allChapters
      const chapter = allChapters.find((c) => c.id === chapterId);
      if (!chapter) throw new Error(`Chapter ${chapterId} not found`);

      const chapterWithPages = await fetchChapterPages(
        sourceId,
        chapterUrl,
        chapter
      );

      const chapters = [chapterWithPages];
      const flatPages = flattenChapters(chapters);

      set({
        chapters,
        flatPages,
        currentFlatIndex: 0,
        isLoadingChapter: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load",
        isLoadingChapter: false,
      });
    }
  },

  setCurrentFlatIndex: (index) => {
    set({ currentFlatIndex: index });
  },

  toggleOverlay: () => {
    set((state) => ({ isOverlayVisible: !state.isOverlayVisible }));
  },

  hideOverlay: () => {
    set({ isOverlayVisible: false });
  },

  loadNextChapter: async () => {
    const { chapters, allChapters, sourceId, isLoadingChapter } = get();
    if (isLoadingChapter || !sourceId || chapters.length === 0) return;

    // Get last loaded chapter
    const lastChapter = chapters[chapters.length - 1];
    // Find next chapter (lower number = newer, so we want higher number = older = next)
    // Chapters are typically sorted desc by number, so next is lower index
    const currentIdx = allChapters.findIndex((c) => c.id === lastChapter.id);
    if (currentIdx <= 0) return; // No next chapter

    const nextChapter = allChapters[currentIdx - 1];

    set({ isLoadingChapter: true });

    try {
      const chapterWithPages = await fetchChapterPages(
        sourceId,
        nextChapter.url,
        nextChapter
      );

      set((state) => {
        const newChapters = [...state.chapters, chapterWithPages];
        return {
          chapters: newChapters,
          flatPages: flattenChapters(newChapters),
          isLoadingChapter: false,
        };
      });
    } catch (error) {
      console.error("[ReaderStore] Failed to load next chapter:", error);
      set({ isLoadingChapter: false });
    }
  },

  loadPreviousChapter: async () => {
    const { chapters, allChapters, sourceId, isLoadingChapter } = get();
    if (isLoadingChapter || !sourceId || chapters.length === 0) return;

    // Get first loaded chapter
    const firstChapter = chapters[0];
    // Find previous chapter (higher number = older = previous)
    const currentIdx = allChapters.findIndex((c) => c.id === firstChapter.id);
    if (currentIdx >= allChapters.length - 1) return; // No previous chapter

    const prevChapter = allChapters[currentIdx + 1];

    set({ isLoadingChapter: true });

    try {
      const chapterWithPages = await fetchChapterPages(
        sourceId,
        prevChapter.url,
        prevChapter
      );

      set((state) => {
        const newChapters = [chapterWithPages, ...state.chapters];
        const prevChapterPageCount = chapterWithPages.pages.length;
        return {
          chapters: newChapters,
          flatPages: flattenChapters(newChapters),
          // Adjust index to maintain position
          currentFlatIndex: state.currentFlatIndex + prevChapterPageCount,
          isLoadingChapter: false,
        };
      });
    } catch (error) {
      console.error("[ReaderStore] Failed to load previous chapter:", error);
      set({ isLoadingChapter: false });
    }
  },

  saveProgress: () => {
    const { flatPages, currentFlatIndex, mangaId } = get();
    if (flatPages.length === 0 || !mangaId) return;

    const currentPage = flatPages[currentFlatIndex];
    if (!currentPage) return;

    // Progress will be saved by the component using Library hooks
  },

  reset: () => {
    set(initialState);
  },
}));

// ─────────────────────────────────────────────────────────────
// Selectors (for derived state without re-renders)
// ─────────────────────────────────────────────────────────────

export const selectCurrentChapter = (
  state: ReaderState
): ChapterInfo | null => {
  const page = state.flatPages[state.currentFlatIndex];
  if (!page) return null;
  return {
    id: page.chapterId,
    number: page.chapterNumber,
    title: page.chapterTitle,
  };
};

export const selectCurrentPageInChapter = (state: ReaderState): number => {
  const page = state.flatPages[state.currentFlatIndex];
  return page ? page.pageIndex + 1 : 0;
};

export const selectTotalPagesInChapter = (state: ReaderState): number => {
  const page = state.flatPages[state.currentFlatIndex];
  return page ? page.totalPagesInChapter : 0;
};

export const selectTotalPages = (state: ReaderState): number => {
  return state.flatPages.length;
};
