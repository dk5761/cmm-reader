/**
 * Sync service configuration
 * Extracted magic numbers from SyncService.ts
 */
export const SYNC_CONFIG = {
  /** Debounce delay before syncing queued events (ms) - reduced for responsiveness */
  DEBOUNCE_MS: 5000,

  /** Periodic sync interval when app is active (ms) - every 2 minutes */
  PERIODIC_SYNC_INTERVAL_MS: 120000,

  /** Maximum operations per Firestore batch */
  BATCH_SIZE: 100,

  /** Maximum history entries to download */
  HISTORY_LIMIT: 500,

  /** Event types that trigger immediate sync (no debounce) */
  IMMEDIATE_SYNC_EVENTS: [
    "chapter_read",
    "progress_updated",
    "history_added",
  ] as const,
} as const;

export type ImmediateSyncEventType =
  (typeof SYNC_CONFIG.IMMEDIATE_SYNC_EVENTS)[number];
