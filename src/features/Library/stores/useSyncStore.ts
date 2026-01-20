import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SyncFailure = {
  mangaId: string;
  mangaTitle: string;
  error: string;
};

export type ChapterUpdate = {
  chapterId: string;
  chapterNumber: number;
  chapterTitle?: string;
  addedAt: number;
};

export type MangaSyncUpdate = {
  mangaId: string;
  mangaTitle: string;
  cover?: string;
  sourceId: string;
  sourceName: string;
  newChapters: ChapterUpdate[];
  previousChapterCount: number;
  currentChapterCount: number;
  syncedAt: number;
};

export type SyncResult = {
  timestamp: number;
  updated: number;
  newChapters: number;
  failed: SyncFailure[];
  skippedSources: string[];
  mangaUpdates: MangaSyncUpdate[];
};

type SyncState = {
  isSyncing: boolean;
  isWarmingUp: boolean;
  warmingSource: string | null;
  progress: { current: number; total: number };
  currentSource: string | null;
  currentManga: string | null;
  lastSync: SyncResult | null;
  syncHistory: SyncResult[]; // Keep last 10
  // Cloud sync state (for future implementation)
  isCloudSyncing: boolean;
  cloudSyncStatus: string | null;
};

type SyncActions = {
  startSync: (total: number) => void;
  setWarmingUp: (isWarming: boolean, source?: string) => void;
  updateProgress: (current: number, source: string, manga: string) => void;
  completeSync: (result: SyncResult) => void;
  clearHistory: () => void;
  // Cloud sync actions
  startCloudSync: (status?: string) => void;
  updateCloudSyncStatus: (status: string) => void;
  completeCloudSync: () => void;
};

type SyncStore = SyncState & SyncActions;

const initialState: SyncState = {
  isSyncing: false,
  isWarmingUp: false,
  warmingSource: null,
  progress: { current: 0, total: 0 },
  currentSource: null,
  currentManga: null,
  lastSync: null,
  syncHistory: [],
  // Cloud sync initial state
  isCloudSyncing: false,
  cloudSyncStatus: null,
};

export const useSyncStore = create<SyncStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      startSync: (total: number) => {
        set({
          isSyncing: true,
          isWarmingUp: false,
          warmingSource: null,
          progress: { current: 0, total },
          currentSource: null,
          currentManga: null,
        });
      },

      setWarmingUp: (isWarming: boolean, source?: string) => {
        set({
          isWarmingUp: isWarming,
          warmingSource: source || null,
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

      // Cloud sync actions
      startCloudSync: (status?: string) => {
        set({
          isCloudSyncing: true,
          cloudSyncStatus: status || "Syncing with cloud...",
        });
      },

      updateCloudSyncStatus: (status: string) => {
        set({ cloudSyncStatus: status });
      },

      completeCloudSync: () => {
        set({
          isCloudSyncing: false,
          cloudSyncStatus: null,
        });
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
