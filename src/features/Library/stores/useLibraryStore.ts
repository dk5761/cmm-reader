import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LIBRARY_FILTERS } from "../data/mockData";

export type LibraryCategory = (typeof LIBRARY_FILTERS)[number];
export type ViewMode = "grid" | "list";
export type SortBy =
  | "title"
  | "lastRead"
  | "dateAdded"
  | "unread"
  | "latestChapter";

interface LibraryState {
  // View preferences
  activeCategory: LibraryCategory;
  viewMode: ViewMode;
  sortBy: SortBy;
  sortAscending: boolean;

  // Filter state (not persisted)
  searchQuery: string;
  activeSource: string; // 'all' | sourceId

  // Actions
  setActiveCategory: (category: LibraryCategory) => void;
  setViewMode: (mode: ViewMode) => void;
  setSortBy: (sortBy: SortBy) => void;
  toggleSortOrder: () => void;
  setSearchQuery: (query: string) => void;
  setActiveSource: (source: string) => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      // Initial state
      activeCategory: "All",
      viewMode: "grid",
      sortBy: "lastRead",
      sortAscending: false,
      searchQuery: "",
      activeSource: "all",

      // Actions
      setActiveCategory: (category) => set({ activeCategory: category }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setSortBy: (sortBy) => set({ sortBy }),
      toggleSortOrder: () =>
        set((state) => ({ sortAscending: !state.sortAscending })),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setActiveSource: (source) => set({ activeSource: source }),
    }),
    {
      name: "library-store",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist view preferences, not filter state
      partialize: (state) => ({
        activeCategory: state.activeCategory,
        viewMode: state.viewMode,
        sortBy: state.sortBy,
        sortAscending: state.sortAscending,
      }),
    }
  )
);
