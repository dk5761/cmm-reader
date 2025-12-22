import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ReaderMode = "webtoon" | "paged" | "horizontal";
export type ReadingDirection = "ltr" | "rtl";

interface ReaderState {
  // Reader preferences
  readerMode: ReaderMode;
  readingDirection: ReadingDirection;
  showPageNumber: boolean;
  keepScreenOn: boolean;

  // Current reading state
  currentChapterId: string | null;
  currentPage: number;

  // Actions
  setReaderMode: (mode: ReaderMode) => void;
  setReadingDirection: (direction: ReadingDirection) => void;
  setShowPageNumber: (show: boolean) => void;
  setKeepScreenOn: (keep: boolean) => void;
  setCurrentChapter: (chapterId: string, page?: number) => void;
  setCurrentPage: (page: number) => void;
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      // Initial state
      readerMode: "webtoon",
      readingDirection: "ltr",
      showPageNumber: true,
      keepScreenOn: true,
      currentChapterId: null,
      currentPage: 1,

      // Actions
      setReaderMode: (mode) => set({ readerMode: mode }),
      setReadingDirection: (direction) => set({ readingDirection: direction }),
      setShowPageNumber: (show) => set({ showPageNumber: show }),
      setKeepScreenOn: (keep) => set({ keepScreenOn: keep }),
      setCurrentChapter: (chapterId, page = 1) =>
        set({ currentChapterId: chapterId, currentPage: page }),
      setCurrentPage: (page) => set({ currentPage: page }),
    }),
    {
      name: "reader-store",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist preferences, not current reading state
      partialize: (state) => ({
        readerMode: state.readerMode,
        readingDirection: state.readingDirection,
        showPageNumber: state.showPageNumber,
        keepScreenOn: state.keepScreenOn,
      }),
    }
  )
);
