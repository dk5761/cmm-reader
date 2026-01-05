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
  isInitialized: boolean;
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
  setNextChapterError: (error: string) => void;
  setPrevChapterError: (error: string) => void;
  retryNextChapter: () => void;
  retryPrevChapter: () => void;

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

  console.log("[buildAdapterItems] 🏗️ Building items from ViewerChapters:", {
    prevChapterId: prevChapter?.chapter.id,
    prevChapterState: prevChapter?.state,
    prevChapterPages: prevChapter?.pages.length ?? 0,
    currChapterId: currChapter.chapter.id,
    currChapterState: currChapter.state,
    currChapterPages: currChapter.pages.length,
    nextChapterId: nextChapter?.chapter.id,
    nextChapterState: nextChapter?.state,
    nextChapterPages: nextChapter?.pages.length ?? 0,
    isLoadingPrev,
    isLoadingNext,
  });

  let prevItemsCount = 0;
  let currStartIndex = 0;

  if (prevChapter) {
    if (prevChapter.state === "loaded" && prevChapter.pages.length > 0) {
      for (const page of prevChapter.pages) {
        items.push(createPageItem(page, prevChapter.chapter.id, 0));
      }
      // Add Separator between Prev and Curr
      items.push(createTransitionItem("prev", prevChapter, isLoadingPrev));
      prevItemsCount = prevChapter.pages.length + 1;
    } else {
      items.push(createTransitionItem("prev", prevChapter, isLoadingPrev));
      prevItemsCount = 1;
    }
  }

  currStartIndex = items.length;

  // Current Chapter Pages
  for (const page of currChapter.pages) {
    items.push(createPageItem(page, currChapter.chapter.id, 0));
  }

  const currEndIndex = items.length - 1;

  // Next Chapter
  let nextStartIndex = items.length;
  if (nextChapter) {
    if (nextChapter.state === "loaded" && nextChapter.pages.length > 0) {
      // Add Separator between Curr and Next
      items.push(createTransitionItem("next", nextChapter, isLoadingNext));
      for (const page of nextChapter.pages) {
        items.push(createPageItem(page, nextChapter.chapter.id, 0));
      }
    } else {
      items.push(createTransitionItem("next", nextChapter, isLoadingNext));
    }
  }

  console.log("[buildAdapterItems] 📊 Items built:", {
    totalItems: items.length,
    prevItemsCount,
    currStartIndex,
    currEndIndex,
    currPagesCount: currChapter.pages.length,
    nextTransitionIndex: nextChapter ? currEndIndex + 1 : null,
    nextStartIndex: nextChapter?.state === "loaded" ? nextStartIndex + 1 : null,
  });

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

/**
 * Format chapter title for display
 */
export function formatChapterTitle(
  chapter: Chapter | null | undefined
): string {
  if (!chapter) return "Unknown Chapter";

  const number = chapter.number;

  // If we have a valid number, always show it
  if (number && !isNaN(number)) {
    return `Chapter ${number}`;
  }

  // Fallback to title only if number is invalid
  return chapter.title?.trim() || "Unknown Chapter";
}
