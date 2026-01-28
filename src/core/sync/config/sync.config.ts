/**
 * Sync configuration
 * Centralized configuration for the Firebase sync system
 */

import { SyncEventType, SyncEventPriority } from "../types/events.types";

/**
 * Sync configuration interface
 */
export interface SyncConfig {
  // Batch configuration
  batchSize: number;
  flushInterval: number;
  flushThreshold: number;

  // Queue configuration
  maxQueueSize: number;
  persistToDisk: boolean;
  queueStorageKey: string;

  // Retry configuration
  maxRetries: number;
  retryDelays: number[];

  // Sync triggers
  syncOnAppForeground: boolean;
  syncOnAppStart: boolean;
  syncOnNetworkChange: boolean;

  // Debouncing
  debounceMs: number;
  chapterProgressDebounceMs: number;

  // Real-time sync
  enableRealtimeSync: boolean;
  realtimeSyncThrottleMs: number;

  // Conflict resolution
  conflictResolution: "last_write_wins" | "server_wins" | "client_wins";

  // Logging
  enableLogging: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
}

/**
 * Default sync configuration
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  // Batch: Firestore limit is 500 operations per batch
  // We use 400 to be safe and allow for metadata operations
  batchSize: 400,

  // Flush: Auto-flush queue every 5 seconds or when 50 events are queued
  flushInterval: 5000,
  flushThreshold: 50,

  // Queue: Store up to 1000 events in memory, persist to AsyncStorage
  maxQueueSize: 1000,
  persistToDisk: true,
  queueStorageKey: "@manga_reader_sync_queue",

  // Retry: Exponential backoff with 3 attempts
  maxRetries: 3,
  retryDelays: [1000, 5000, 15000], // 1s, 5s, 15s

  // Sync triggers
  syncOnAppForeground: true,
  syncOnAppStart: true,
  syncOnNetworkChange: true,

  // Debouncing: Group rapid changes
  debounceMs: 1000, // 1 second for most changes
  chapterProgressDebounceMs: 2000, // 2 seconds for chapter progress (high frequency)

  // Real-time sync: Listen for Firestore changes
  enableRealtimeSync: true,
  realtimeSyncThrottleMs: 500, // Throttle real-time updates to 500ms

  // Conflict resolution: Last write wins (based on _modified timestamp)
  conflictResolution: "last_write_wins",

  // Logging
  enableLogging: __DEV__,
  logLevel: "info",
};

/**
 * Event priority configuration
 * Maps event types to priority levels
 */
export const EVENT_PRIORITIES: Record<SyncEventType, SyncEventPriority> = {
  MANGA_CREATE: SyncEventPriority.HIGH,
  MANGA_UPDATE: SyncEventPriority.NORMAL,
  MANGA_DELETE: SyncEventPriority.HIGH,

  CHAPTER_UPDATE: SyncEventPriority.NORMAL,
  CHAPTERS_BATCH_UPDATE: SyncEventPriority.NORMAL,

  CATEGORY_CREATE: SyncEventPriority.NORMAL,
  CATEGORY_UPDATE: SyncEventPriority.LOW,
  CATEGORY_DELETE: SyncEventPriority.NORMAL,

  SETTINGS_UPDATE: SyncEventPriority.NORMAL,

  BATCH_OPERATION: SyncEventPriority.NORMAL,
};

/**
 * Firestore collection paths
 */
export const FIRESTORE_PATHS = {
  // User data root
  USER_ROOT: (userId: string) => `users/${userId}`,

  // Collections
  MANGA: (userId: string) => `users/${userId}/manga`,
  CHAPTERS: (userId: string) => `users/${userId}/chapters`,
  HISTORY: (userId: string) => `users/${userId}/history`,
  CATEGORIES: (userId: string) => `users/${userId}/categories`,
  SETTINGS: (userId: string) => `users/${userId}/settings`,
  SYNC_METADATA: (userId: string) => `users/${userId}/sync_metadata`,

  // Documents
  MANGA_DOC: (userId: string, mangaId: string) => `users/${userId}/manga/${mangaId}`,
  CHAPTER_DOC: (userId: string, chapterId: string) => `users/${userId}/chapters/${chapterId}`,
  HISTORY_DOC: (userId: string, mangaId: string) => `users/${userId}/history/${mangaId}`,
  CATEGORY_DOC: (userId: string, categoryId: string) => `users/${userId}/categories/${categoryId}`,
  SETTINGS_DOC: (userId: string) => `users/${userId}/settings/user`,
  SYNC_METADATA_DOC: (userId: string) => `users/${userId}/sync_metadata/state`,
} as const;

/**
 * Required Firestore composite indexes
 * These should be created in the Firestore console
 */
export const FIRESTORE_INDEXES = [
  {
    collection: "manga",
    fields: [
      { field: "readingStatus", order: "ASCENDING" },
      { field: "lastUpdated", order: "DESCENDING" },
    ],
  },
  {
    collection: "manga",
    fields: [
      { field: "sourceId", order: "ASCENDING" },
      { field: "_modified", order: "DESCENDING" },
    ],
  },
  {
    collection: "manga",
    fields: [
      { field: "_deleted", order: "ASCENDING" },
      { field: "_modified", order: "DESCENDING" },
    ],
  },
  {
    collection: "chapters",
    fields: [
      { field: "mangaId", order: "ASCENDING" },
      { field: "number", order: "DESCENDING" },
    ],
  },
];

/**
 * Sync status constants
 */
export const SYNC_STATUS = {
  IDLE: "idle",
  SYNCING: "syncing",
  PAUSED: "paused",
  ERROR: "error",
} as const;

export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];

/**
 * Get configuration with overrides
 */
export function getSyncConfig(overrides: Partial<SyncConfig> = {}): SyncConfig {
  return { ...DEFAULT_SYNC_CONFIG, ...overrides };
}

/**
 * Get priority for an event type
 */
export function getEventPriority(type: SyncEventType): SyncEventPriority {
  return EVENT_PRIORITIES[type];
}

/**
 * Logging utility
 */
export class SyncLogger {
  private enabled: boolean;
  private level: SyncConfig["logLevel"];

  constructor(config: SyncConfig) {
    this.enabled = config.enableLogging;
    this.level = config.logLevel;
  }

  private shouldLog(level: SyncConfig["logLevel"]): boolean {
    if (!this.enabled) return false;

    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.level];
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      console.log("[Sync Debug]", ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.info("[Sync]", ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      console.warn("[Sync Warning]", ...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog("error")) {
      console.error("[Sync Error]", ...args);
    }
  }
}
