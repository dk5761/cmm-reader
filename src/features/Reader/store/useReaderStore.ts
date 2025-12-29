import { create } from "zustand";
import type { Page, Chapter } from "@/sources";
import type { ChapterSegment } from "../types";

export interface ReaderState {
  // Core reading state
  currentPage: number;
  totalPages: number;
  initialPage: number;

  // UI state
  isControlsVisible: boolean;
  isSliderDragging: boolean;

  // Current chapter metadata
  mangaId: string;
  chapterId: string;
  chapterNumber: number;
  chapterIndex: number; // Index in chapters array
  sourceId: string;

  // Infinite scroll state
  loadedSegments: ChapterSegment[];
  isLoadingPrev: boolean;
  isLoadingNext: boolean;

  // Flags
  isInitialized: boolean;
  markedAsRead: boolean;
}

export interface ReaderActions {
  // Core actions
  setPage: (page: number) => void;
  toggleControls: () => void;
  setMarkedAsRead: () => void;
  setSliderDragging: (value: boolean) => void;

  // Infinite scroll actions
  addSegment: (segment: ChapterSegment) => void;
  updateSegment: (chapterId: string, updates: Partial<ChapterSegment>) => void;
  setLoadingPrev: (value: boolean) => void;
  setLoadingNext: (value: boolean) => void;
  setCurrentChapter: (
    chapterId: string,
    chapterIndex: number,
    chapterNumber: number
  ) => void;

  // Lifecycle
  initialize: (data: InitData) => void;
  reset: () => void;
}

export interface InitData {
  initialPage: number;
  totalPages: number;
  mangaId: string;
  chapterId: string;
  chapterNumber: number;
  chapterIndex: number;
  sourceId: string;
  initialSegment?: ChapterSegment;
}

const initialState: ReaderState = {
  currentPage: 1,
  totalPages: 0,
  initialPage: 1,
  isControlsVisible: true,
  isSliderDragging: false,
  mangaId: "",
  chapterId: "",
  chapterNumber: 0,
  chapterIndex: -1,
  sourceId: "",
  loadedSegments: [],
  isLoadingPrev: false,
  isLoadingNext: false,
  isInitialized: false,
  markedAsRead: false,
};

export const useReaderStore = create<ReaderState & ReaderActions>(
  (set, get) => ({
    ...initialState,

    setPage: (page) => set({ currentPage: page }),

    toggleControls: () =>
      set((state) => ({ isControlsVisible: !state.isControlsVisible })),

    setMarkedAsRead: () => set({ markedAsRead: true }),

    setSliderDragging: (value) => set({ isSliderDragging: value }),

    // Add a new chapter segment
    addSegment: (segment) =>
      set((state) => {
        // Check if already exists
        if (
          state.loadedSegments.some((s) => s.chapterId === segment.chapterId)
        ) {
          return state;
        }
        // Insert in order by chapterIndex (descending - higher index = earlier chapter)
        const newSegments = [...state.loadedSegments, segment].sort(
          (a, b) => b.chapterIndex - a.chapterIndex
        );
        return { loadedSegments: newSegments };
      }),

    // Update existing segment
    updateSegment: (chapterId, updates) =>
      set((state) => ({
        loadedSegments: state.loadedSegments.map((s) =>
          s.chapterId === chapterId ? { ...s, ...updates } : s
        ),
      })),

    setLoadingPrev: (value) => set({ isLoadingPrev: value }),
    setLoadingNext: (value) => set({ isLoadingNext: value }),

    // Update current chapter (when scrolling to different chapter)
    setCurrentChapter: (chapterId, chapterIndex, chapterNumber) =>
      set({
        chapterId,
        chapterIndex,
        chapterNumber,
        markedAsRead: false, // Reset for new chapter
      }),

    initialize: (data) => {
      console.log("[useReaderStore] Initialize called with:", {
        hasInitialSegment: !!data.initialSegment,
        segmentPagesCount: data.initialSegment?.pages.length,
        chapterId: data.chapterId,
      });

      set({
        initialPage: data.initialPage,
        currentPage: data.initialPage,
        totalPages: data.totalPages,
        mangaId: data.mangaId,
        chapterId: data.chapterId,
        chapterNumber: data.chapterNumber,
        chapterIndex: data.chapterIndex,
        sourceId: data.sourceId,
        loadedSegments: data.initialSegment ? [data.initialSegment] : [],
        isInitialized: true,
        markedAsRead: false,
        isLoadingPrev: false,
        isLoadingNext: false,
      });

      console.log("[useReaderStore] After initialize, loadedSegments:", {
        count: data.initialSegment ? 1 : 0,
      });
    },

    reset: () => set(initialState),
  })
);
