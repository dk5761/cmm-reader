import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SyncFailure = {
  mangaId: string;
  mangaTitle: string;
  error: string;
};

export type SyncResult = {
  timestamp: number;
  updated: number;
  newChapters: number;
  failed: SyncFailure[];
  skippedSources: string[];
};

type SyncState = {
  isSyncing: boolean;
  progress: { current: number; total: number };
  currentSource: string | null;
  currentManga: string | null;
  lastSync: SyncResult | null;
  syncHistory: SyncResult[]; // Keep last 10
};

type SyncActions = {
  startSync: (total: number) => void;
  updateProgress: (current: number, source: string, manga: string) => void;
  completeSync: (result: SyncResult) => void;
  clearHistory: () => void;
};

type SyncStore = SyncState & SyncActions;

const initialState: SyncState = {
  isSyncing: false,
  progress: { current: 0, total: 0 },
  currentSource: null,
  currentManga: null,
  lastSync: null,
  syncHistory: [],
};

export const useSyncStore = create<SyncStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      startSync: (total: number) => {
        set({
          isSyncing: true,
          progress: { current: 0, total },
          currentSource: null,
          currentManga: null,
        });
      },

      updateProgress: (current: number, source: string, manga: string) => {
        set({
          progress: { current, total: get().progress.total },
          currentSource: source,
          currentManga: manga,
        });
      },

      completeSync: (result: SyncResult) => {
        const history = [result, ...get().syncHistory].slice(0, 10);
        set({
          isSyncing: false,
          progress: { current: 0, total: 0 },
          currentSource: null,
          currentManga: null,
          lastSync: result,
          syncHistory: history,
        });
      },

      clearHistory: () => {
        set({ syncHistory: [], lastSync: null });
      },
    }),
    {
      name: "sync-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        lastSync: state.lastSync,
        syncHistory: state.syncHistory,
      }),
    }
  )
);
