/**
 * Firebase Firestore Sync System
 *
 * A typesafe, optimized sync system for syncing Realm database to Firebase Firestore.
 *
 * Features:
 * - Type-safe document validation with Zod
 * - Batch writes for optimal Firestore usage
 * - Event queue with priority and deduplication
 * - Real-time sync with Firestore listeners
 * - Conflict resolution with version tracking
 * - Offline support with AsyncStorage persistence
 *
 * @example
 * ```tsx
 * import { useSyncManager } from '@/core/sync';
 *
 * function MyComponent() {
 *   const { isSyncing, lastSyncTime, syncNow } = useSyncManager();
 *   // ...
 * }
 * ```
 */

// Type definitions
export * from "./types/firestore.types";
export * from "./types/events.types";
export * from "./types/realm.types";

// Configuration
export * from "./config/sync.config";

// Validation
export * from "./validation/validators";
export * from "./validation/type-guards";

// Core components
export { EventQueue, getEventQueue, destroyEventQueue } from "./queue/EventQueue";
export { RealmListener, getRealmListener, destroyRealmListener } from "./capture/RealmListener";
export { SyncService, getSyncService, destroySyncService } from "./engine/SyncService";
export { FirestoreListener, getFirestoreListener, destroyFirestoreListener } from "./listeners/FirestoreListener";

// Utilities
export { EventEmitter } from "./utils/EventEmitter";

// Firebase client
export * from "./firebase/FirebaseClient";
export { firebaseConfig, isFirebaseConfigured, getFirebaseConfig } from "./firebase/firebaseConfig";
export { refreshAuthentication } from "./firebase/FirebaseClient";

// Firestore indexes
export * from "./firestore/indexes";

// React hooks
export { useSyncManager, useSyncStatus, useSyncStats } from "./hooks/useSyncManager";

// Providers
export { SyncProvider, useFirebaseSync } from "./providers/SyncProvider";

// UI Components
export * from "./components/SyncStatusIndicator";
export * from "./components/SyncSettings";
export * from "./components/SyncProgressBanner";

// Re-exports for convenience
export { DEFAULT_SYNC_CONFIG, getSyncConfig, getEventPriority } from "./config/sync.config";
export { FirestoreValidator } from "./validation/validators";
export {
  isMangaDocument,
  isChapterDocument,
  isHistoryDocument,
  isCategoryDocument,
  isSettingsDocument,
  isDeleted,
  needsSync,
} from "./validation/type-guards";
