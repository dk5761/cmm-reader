import { create } from "zustand";

interface BrowseState {
  // Browse state
  selectedSourceId: string | null;
  searchQuery: string;
  isSearching: boolean;

  // Actions
  setSelectedSource: (sourceId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setIsSearching: (searching: boolean) => void;
  clearSearch: () => void;
}

export const useBrowseStore = create<BrowseState>()((set) => ({
  // Initial state
  selectedSourceId: null,
  searchQuery: "",
  isSearching: false,

  // Actions
  setSelectedSource: (sourceId) => set({ selectedSourceId: sourceId }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setIsSearching: (searching) => set({ isSearching: searching }),
  clearSearch: () => set({ searchQuery: "", isSearching: false }),
}));
