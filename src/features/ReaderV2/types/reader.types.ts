/**
 * ReaderV2 Type Definitions
 *
 * Based on Mihon's reader architecture:
 * - ReaderChapter: Wraps chapter with state (Wait, Loading, Loaded, Error)
 * - ReaderPage: Wraps page with status and stream
 * - ViewerChapters: Contains prev, current, next chapters
 */

import type { Page, Chapter } from "@/sources";
import type { FlashListRef } from "@shopify/flash-list";
import type { RefObject } from "react";

// ============================================================================
// Page & Chapter Types
// ============================================================================

/**
 * Page loading state (mirrors Mihon's Page.State)
 */
export type PageState = "queue" | "loading" | "ready" | "error";

/**
 * Chapter loading state (mirrors Mihon's ReaderChapter.State)
 */
export type ChapterState = "wait" | "loading" | "loaded" | "error";

/**
 * Extended page with loading state
 */
export interface ReaderPage {
  index: number;
  imageUrl: string;
  headers?: Record<string, string>;
  state: PageState;
  error?: string;
}

/**
 * Extended chapter with loading state and pages
 */
export interface ReaderChapter {
  chapter: Chapter;
  state: ChapterState;
  pages: ReaderPage[];
  error?: string;
}

/**
 * Container for adjacent chapters (mirrors Mihon's ViewerChapters)
 */
export interface ViewerChapters {
  prevChapter: ReaderChapter | null;
  currChapter: ReaderChapter;
  nextChapter: ReaderChapter | null;
}

// ============================================================================
// List Item Types (for FlashList)
// ============================================================================

/**
 * A page item in the list
 */
export interface PageItem {
  type: "page";
  page: ReaderPage;
  chapterId: string;
  chapterIndex: number;
}

/**
 * A transition item between chapters
 */
export interface TransitionItem {
  type: "transition";
  direction: "prev" | "next";
  targetChapter: ReaderChapter | null;
  isLoading: boolean;
}

/**
 * Union type for all list items
 */
export type AdapterItem = PageItem | TransitionItem;

// ============================================================================
// Store Types
// ============================================================================

/**
 * Reader store state
 */
export interface ReaderStoreState {
  // Chapter data
  viewerChapters: ViewerChapters | null;
  allChapters: Chapter[];
  currentChapterIndex: number;

  // Page navigation
  currentPage: number;
  totalPages: number;

  // UI state
  isOverlayVisible: boolean;
  isSeeking: boolean;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Refs
  flashListRef: RefObject<FlashListRef<AdapterItem>> | null;

  // Metadata
  mangaId: string;
  sourceId: string;
}

/**
 * Reader store actions
 */
export interface ReaderStoreActions {
  // Initialization
  initialize: (params: InitializeParams) => Promise<void>;
  reset: () => void;

  // Page navigation
  setCurrentPage: (page: number) => void;
  seekToPage: (page: number) => void;

  // Chapter loading (via react-query, not store)
  loadNextChapter: () => Promise<void>;
  loadPrevChapter: () => Promise<void>;
  setNextChapterLoaded: (pages: ReaderPage[]) => void;
  setPrevChapterLoaded: (pages: ReaderPage[]) => void;

  // UI
  toggleOverlay: () => void;
  setIsSeeking: (value: boolean) => void;

  // Refs
  setFlashListRef: (ref: RefObject<FlashListRef<AdapterItem>>) => void;
}

export interface InitializeParams {
  mangaId: string;
  sourceId: string;
  chapterId: string;
  chapters: Chapter[];
  initialPage?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert source Page to ReaderPage
 */
export function toReaderPage(page: Page): ReaderPage {
  return {
    index: page.index,
    imageUrl: page.imageUrl,
    headers: page.headers,
    state: "queue",
  };
}

/**
 * Create PageItem for FlashList
 */
export function createPageItem(
  page: ReaderPage,
  chapterId: string,
  chapterIndex: number
): PageItem {
  return {
    type: "page",
    page,
    chapterId,
    chapterIndex,
  };
}

/**
 * Create TransitionItem for FlashList
 */
export function createTransitionItem(
  direction: "prev" | "next",
  targetChapter: ReaderChapter | null,
  isLoading = false
): TransitionItem {
  return {
    type: "transition",
    direction,
    targetChapter,
    isLoading,
  };
}

/**
 * Build adapter items from ViewerChapters
 */
export function buildAdapterItems(
  viewerChapters: ViewerChapters,
  isLoadingPrev: boolean,
  isLoadingNext: boolean
): AdapterItem[] {
  const items: AdapterItem[] = [];

  // Previous Chapter
  const { prevChapter, currChapter, nextChapter } = viewerChapters;

  if (prevChapter) {
    if (prevChapter.state === "loaded" && prevChapter.pages.length > 0) {
      // Helper to add prev pages (usually we want to maintain scroll, so maybe keep transition as header?)
      // For now, simpler: If loaded, show pages.
      for (const page of prevChapter.pages) {
        items.push(createPageItem(page, prevChapter.chapter.id, 0));
      }
      // Add a separator/header between chapters?
    } else {
      items.push(createTransitionItem("prev", prevChapter, isLoadingPrev));
    }
  }

  // Current Chapter Pages
  for (const page of currChapter.pages) {
    items.push(createPageItem(page, currChapter.chapter.id, 0));
  }

  // Next Chapter
  if (nextChapter) {
    if (nextChapter.state === "loaded" && nextChapter.pages.length > 0) {
      // Add separator?
      // Add next chapter pages
      for (const page of nextChapter.pages) {
        items.push(createPageItem(page, nextChapter.chapter.id, 0));
      }
      // Note: We don't add a 'next' transition here because we don't have the *next-next* chapter data yet.
      // The user must trigger a "Shift" to load the next-next pointer.
      // This shift should happen automatically when scrolling into the next chapter.
    } else {
      items.push(createTransitionItem("next", nextChapter, isLoadingNext));
    }
  }

  return items;
}

/**
 * Get unique key for adapter item
 */
export function getItemKey(item: AdapterItem): string {
  if (item.type === "page") {
    return `page-${item.chapterId}-${item.page.index}`;
  }
  return `transition-${item.direction}-${
    item.targetChapter?.chapter.id ?? "none"
  }`;
}
