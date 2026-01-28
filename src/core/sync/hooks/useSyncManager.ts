/**
 * useSyncManager Hook
 *
 * React hook for managing the Firebase sync system.
 * Provides sync state, controls, and automatic lifecycle management.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isSyncing, lastSyncTime, syncNow, syncStats } = useSyncManager();
 *
 *   return (
 *     <View>
 *       <Text>{isSyncing ? "Syncing..." : "Synced"}</Text>
 *       <Button onPress={syncNow} title="Sync Now" />
 *     </View>
 *   );
 * }
 * ```
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRealm, useQuery } from "@realm/react";
import type Realm from "realm";
import { AppState, AppStateStatus } from "react-native";
import { MangaSchema } from "@/core/database";
import { EventQueue } from "../queue/EventQueue";
import { RealmListener } from "../capture/RealmListener";
import { SyncService } from "../engine/SyncService";
import { FirestoreListener, getFirestoreListener } from "../listeners/FirestoreListener";
import { getFirestoreInstance, getUserId, getFirebaseClient } from "../firebase/FirebaseClient";
import { getSyncConfig, SYNC_STATUS, type SyncConfig } from "../config/sync.config";
import type { SyncQueueStats, SyncResult } from "../types/events.types";

/**
 * Sync manager state
 */
export interface SyncManagerState {
  isSyncing: boolean;
  isPaused: boolean;
  lastSyncTime: number | null;
  syncStats: SyncQueueStats | null;
  status: (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];
  error: Error | null;
}

/**
 * Sync manager options
 */
export interface UseSyncManagerOptions {
  autoSync?: boolean;
  syncOnAppForeground?: boolean;
  syncOnAppStart?: boolean;
  config?: Partial<SyncConfig>;
}

/**
 * Sync manager hook return value
 */
export interface SyncManagerReturn extends SyncManagerState {
  // Controls
  syncNow: () => Promise<void>;
  pauseSync: () => void;
  resumeSync: () => void;
  clearQueue: () => Promise<void>;

  // Events
  onSyncComplete: (callback: (result: SyncResult) => void) => void;
  onSyncError: (callback: (error: Error) => void) => void;
}

/**
 * Sync manager hook
 *
 * Manages the entire sync lifecycle including:
 * - Event queue management
 * - Realm change listeners
 * - Sync service orchestration
 * - App state awareness
 */
export function useSyncManager(options: UseSyncManagerOptions = {}): SyncManagerReturn {
  const realm = useRealm();
  const mangaList = useQuery(MangaSchema);

  // Options with defaults
  const {
    autoSync = true,
    syncOnAppForeground = true,
    syncOnAppStart = true,
    config: userConfig,
  } = options;

  const config = getSyncConfig(userConfig);

  // State
  const [state, setState] = useState<SyncManagerState>({
    isSyncing: false,
    isPaused: false,
    lastSyncTime: null,
    syncStats: null,
    status: SYNC_STATUS.IDLE,
    error: null,
  });

  // Refs for cleanup
  const eventQueueRef = useRef<EventQueue | null>(null);
  const realmListenerRef = useRef<RealmListener | null>(null);
  const syncServiceRef = useRef<SyncService | null>(null);
  const firestoreListenerRef = useRef<FirestoreListener | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const onCompleteCallbacksRef = useRef<Set<(result: SyncResult) => void>>(new Set());
  const onErrorCallbacksRef = useRef<Set<(error: Error) => void>>(new Set());

  /**
   * Initialize sync system
   */
  const initialize = useCallback(async () => {
    try {
      // Get user ID (returns null if not authenticated)
      const userId = getUserId();

      // If user is not authenticated, skip sync initialization
      if (!userId) {
        console.log("[useSyncManager] User not authenticated, skipping sync initialization");
        setState((prev) => ({ ...prev, status: SYNC_STATUS.IDLE }));
        return;
      }

      // Initialize event queue
      eventQueueRef.current = new EventQueue(config);
      await eventQueueRef.current.initialize();

      // Initialize realm listener (captures local changes)
      realmListenerRef.current = new RealmListener(
        realm,
        eventQueueRef.current,
        userId,
        config
      );
      realmListenerRef.current.start();

      // Initialize sync service (uploads local changes to Firestore)
      const firestore = getFirestoreInstance();
      syncServiceRef.current = new SyncService(
        firestore,
        eventQueueRef.current,
        userId
      );

      // Initialize Firestore listener (downloads server changes to Realm)
      firestoreListenerRef.current = getFirestoreListener(
        firestore,
        realm,
        userId
      );
      firestoreListenerRef.current.start();

      // Initial sync on app start
      if (syncOnAppStart && !mangaList.length) {
        // Only sync if library is empty (first time user)
        await syncNow();
      }

      setState((prev) => ({ ...prev, status: SYNC_STATUS.IDLE }));
    } catch (error) {
      console.error("[useSyncManager] Initialization failed:", error);
      setState((prev) => ({
        ...prev,
        status: SYNC_STATUS.ERROR,
        error: error as Error,
      }));
    }
  }, [realm, config, syncOnAppStart, mangaList.length]);

  /**
   * Start syncing
   */
  const startSyncing = useCallback(async () => {
    if (!syncServiceRef.current || state.isPaused) {
      return;
    }

    setState((prev) => ({ ...prev, isSyncing: true, status: SYNC_STATUS.SYNCING }));

    try {
      await syncServiceRef.current.start();
    } catch (error) {
      console.error("[useSyncManager] Sync failed:", error);
      setState((prev) => ({
        ...prev,
        status: SYNC_STATUS.ERROR,
        error: error as Error,
        isSyncing: false,
      }));
      onErrorCallbacksRef.current.forEach((cb) => cb(error as Error));
    }
  }, [state.isPaused]);

  /**
   * Stop syncing
   */
  const stopSyncing = useCallback(() => {
    syncServiceRef.current?.stop();
    setState((prev) => ({ ...prev, isSyncing: false, status: SYNC_STATUS.IDLE }));
  }, []);

  /**
   * Sync now (manual trigger)
   */
  const syncNow = useCallback(async () => {
    // Check if user is authenticated and services are initialized
    if (!eventQueueRef.current || !syncServiceRef.current) {
      console.log("[useSyncManager] Sync not available (user not authenticated or not initialized)");
      return;
    }

    if (state.isSyncing) {
      console.log("[useSyncManager] Already syncing, skipping");
      return;
    }

    setState((prev) => ({ ...prev, isSyncing: true, status: SYNC_STATUS.SYNCING, error: null }));

    try {
      // Process any pending events
      const eventQueue = eventQueueRef.current;
      const syncService = syncServiceRef.current;

      // Start syncing (this will process the queue and complete when done)
      await syncService.start();

      setState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: Date.now(),
        status: SYNC_STATUS.IDLE,
      }));

      // Notify complete callbacks
      const result: SyncResult = {
        success: true,
        processed: eventQueue.size(),
        failed: 0,
        errors: [],
        timestamp: Date.now() - (state.lastSyncTime || Date.now()),
      };
      onCompleteCallbacksRef.current.forEach((cb) => cb(result));
    } catch (error) {
      console.error("[useSyncManager] Manual sync failed:", error);
      setState((prev) => ({
        ...prev,
        isSyncing: false,
        status: SYNC_STATUS.ERROR,
        error: error as Error,
      }));
      onErrorCallbacksRef.current.forEach((cb) => cb(error as Error));
    }
  }, [state.isSyncing, state.lastSyncTime]);

  /**
   * Pause sync
   */
  const pauseSync = useCallback(() => {
    stopSyncing();
    setState((prev) => ({ ...prev, isPaused: true, status: SYNC_STATUS.PAUSED }));
  }, [stopSyncing]);

  /**
   * Resume sync
   */
  const resumeSync = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: false }));
    if (autoSync) {
      startSyncing();
    }
  }, [autoSync, startSyncing]);

  /**
   * Clear event queue
   */
  const clearQueue = useCallback(async () => {
    await eventQueueRef.current?.clear();
    setState((prev) => ({ ...prev, syncStats: { total: 0, byPriority: { high: 0, normal: 0, low: 0 }, byType: { manga: 0, chapter: 0, category: 0, settings: 0 } } }));
  }, []);

  /**
   * Register sync complete callback
   */
  const onSyncComplete = useCallback((callback: (result: SyncResult) => void) => {
    onCompleteCallbacksRef.current.add(callback);
    return () => {
      onCompleteCallbacksRef.current.delete(callback);
    };
  }, []);

  /**
   * Register sync error callback
   */
  const onSyncError = useCallback((callback: (error: Error) => void) => {
    onErrorCallbacksRef.current.add(callback);
    return () => {
      onErrorCallbacksRef.current.delete(callback);
    };
  }, []);

  /**
   * Update sync stats periodically
   */
  useEffect(() => {
    const interval = setInterval(() => {
      const stats = eventQueueRef.current?.getStats();
      if (stats) {
        setState((prev) => ({ ...prev, syncStats: stats }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Initialize on mount
  useEffect(() => {
    initialize();

    return () => {
      // Cleanup
      stopSyncing();
      realmListenerRef.current?.stop();
      syncServiceRef.current?.stop();
      firestoreListenerRef.current?.stop();
    };
  }, []);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        syncOnAppForeground &&
        autoSync
      ) {
        console.log("[useSyncManager] App came to foreground, syncing...");
        syncNow();
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [syncOnAppForeground, autoSync, syncNow]);

  return {
    ...state,
    syncNow,
    pauseSync,
    resumeSync,
    clearQueue,
    onSyncComplete,
    onSyncError,
  };
}

/**
 * Simplified hook for just checking sync status
 */
export function useSyncStatus() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  // This would connect to the sync manager's state
  // For now, return a basic implementation
  return {
    isSyncing,
    lastSyncTime,
    syncInProgress: isSyncing,
  };
}

/**
 * Hook for sync statistics
 */
export function useSyncStats() {
  const [stats, setStats] = useState<SyncQueueStats>({
    total: 0,
    byPriority: { high: 0, normal: 0, low: 0 },
    byType: { manga: 0, chapter: 0, category: 0, settings: 0 },
  });

  // This would connect to the event queue
  // For now, return a basic implementation
  return stats;
}
