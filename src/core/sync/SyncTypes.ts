/**
 * Types for cloud sync system
 */

import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

// Sync event types
export type SyncEventType =
  | "manga_added"
  | "manga_removed"
  | "manga_updated"
  | "chapter_read"
  | "chapter_unread"
  | "progress_updated"
  | "history_added";

// Queued sync event
export interface SyncEvent {
  id: string;
  type: SyncEventType;
  entityId: string; // mangaId or historyId
  timestamp: number;
  data?: Record<string, unknown>;
}

// Firestore manga document (what we store in cloud)
export interface CloudManga {
  id: string;
  sourceId: string;
  inLibrary: boolean;
  title: string;
  cover?: string;
  url: string;
  author?: string;
  description?: string;
  genres: string[];
  readingStatus?: string;
  addedAt: number;
  lastUpdated: number;
  progress?: {
    lastChapterId?: string;
    lastChapterNumber?: number;
    lastPage: number;
    timestamp: number;
  };
  // Only store read state for chapters (minimal data)
  chapters: {
    id: string;
    number: number;
    isRead: boolean;
    lastPageRead: number;
  }[];
}

// Firestore history document
export interface CloudHistoryEntry {
  id: string;
  mangaId: string;
  mangaTitle: string;
  mangaCover?: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle?: string;
  chapterUrl: string;
  pageReached: number;
  totalPages?: number;
  timestamp: number;
  sourceId: string;
}

// Sync state
export interface SyncState {
  lastSyncTimestamp: number;
  isSyncing: boolean;
  pendingChanges: number;
  error?: string;
}

// Sync queue storage key
export const SYNC_QUEUE_KEY = "@manga_reader_sync_queue";
export const SYNC_STATE_KEY = "@manga_reader_sync_state";
