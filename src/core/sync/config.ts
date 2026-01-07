/**
 * Sync service configuration
 * Extracted magic numbers from SyncService.ts
 */
export const SYNC_CONFIG = {
  /** Debounce delay before syncing queued events (ms) */
  DEBOUNCE_MS: 30000,

  /** Maximum operations per Firestore batch */
  BATCH_SIZE: 100,

  /** Maximum history entries to download */
  HISTORY_LIMIT: 500,
} as const;
