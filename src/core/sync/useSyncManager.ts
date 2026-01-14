/**
 * useSyncManager - React hook for managing cloud sync
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useRealm } from "@realm/react";
import { toast } from "sonner-native";
import { useAuth } from "@/core/auth";
import { MangaSchema } from "@/core/database";
import { SyncService } from "./SyncService";
import {
  startRealmSyncBridge,
  exportAllForSync,
  importFromCloud,
  setSyncingFromCloud,
} from "./RealmSyncBridge";
import { SyncState } from "./SyncTypes";
import { useSyncStore } from "@/features/Library/stores/useSyncStore";

/**
 * Module-level flag to track if startup sync has been initiated.
 * This is shared across all instances of useSyncManager to prevent
 * multiple redirects to the sync screen.
 */
let startupSyncInitiated = false;

/**
 * Reset the startup sync flag (call on logout)
 */
export function resetStartupSyncFlag(): void {
  startupSyncInitiated = false;
}

export function useSyncManager() {
  const realm = useRealm();
  const { user } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>(SyncService.getState());
  const [isInitialSyncing, setIsInitialSyncing] = useState(false);
  const bridgeCleanupRef = useRef<(() => void) | null>(null);

  const { startCloudSync, updateCloudSyncStatus, completeCloudSync } =
    useSyncStore();

  // Initialize sync service and bridge when user logs in
  // Also check for startup sync
  useEffect(() => {
    if (!user) {
      // Cleanup on logout
      if (bridgeCleanupRef.current) {
        bridgeCleanupRef.current();
        bridgeCleanupRef.current = null;
      }
      // Stop real-time listener on logout
      SyncService.stopRealtimeListener();
      // Reset the module-level flag on logout
      startupSyncInitiated = false;
      return;
    }

    // Initialize and check startup sync
    const init = async () => {
      await SyncService.initialize();
      bridgeCleanupRef.current = startRealmSyncBridge(realm);

      // App restart sync - upload pending queue if exists
      if (!startupSyncInitiated) {
        startupSyncInitiated = true;

        const syncState = SyncService.getState();

        // Upload pending queue on app restart
        if (syncState.pendingChanges > 0) {
          console.log(
            "[useSyncManager] App restart - uploading pending queue:",
            syncState.pendingChanges
          );
          toast.success("Syncing pending changes...");
          try {
            await SyncService.flush();
            toast.success("Sync complete");
          } catch (e) {
            console.error("[useSyncManager] App restart sync failed:", e);
            toast.error("Sync failed");
          }
        }

        // Download cloud data on app restart
        const localMangaCount = realm
          .objects(MangaSchema)
          .filtered("inLibrary == true").length;

        console.log(
          "[useSyncManager] Startup sync check - local manga:",
          localMangaCount
        );

        // Only do background sync if user has library items
        // Empty library users are redirected to sync screen by index.tsx
        if (localMangaCount > 0) {
          console.log("[useSyncManager] Background startup sync");
          startCloudSync("Syncing with cloud...");
          try {
            const cloudData = await SyncService.downloadAll(user.uid);
            if (cloudData.manga.length > 0 || cloudData.history.length > 0) {
              updateCloudSyncStatus("Merging data...");
              setSyncingFromCloud(true);
              try {
                importFromCloud(realm, cloudData);
              } finally {
                setSyncingFromCloud(false);
              }
              console.log(
                "[useSyncManager] Background sync complete:",
                cloudData.manga.length,
                "manga"
              );
            }
          } catch (e) {
            console.error("[useSyncManager] Background sync failed:", e);
          } finally {
            completeCloudSync();
          }
        }
      }
    };

    init();

    return () => {
      if (bridgeCleanupRef.current) {
        bridgeCleanupRef.current();
        bridgeCleanupRef.current = null;
      }
    };
  }, [user, realm]);

  // Subscribe to sync state changes
  useEffect(() => {
    const unsubscribe = SyncService.subscribe(setSyncState);
    return unsubscribe;
  }, []);

  // Handle app state changes - sync on foreground (not background)
  useEffect(() => {
    const handleAppState = async (state: AppStateStatus) => {
      if (state === "active" && user) {
        // Sync pending changes when app comes to foreground
        const syncState = SyncService.getState();
        if (syncState.pendingChanges > 0) {
          console.log(
            "[useSyncManager] Foreground - syncing pending changes:",
            syncState.pendingChanges
          );
          toast.success("Syncing...");
          try {
            await SyncService.flush();
            toast.success("Sync complete");
          } catch (e) {
            console.error("[useSyncManager] Foreground sync failed:", e);
            toast.error("Sync failed");
          }
        }
      }
    };

    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [user]);

  /**
   * Force immediate sync (manual trigger)
   */
  const syncNow = useCallback(async () => {
    await SyncService.flush();
  }, []);

  /**
   * Full upload of current library to cloud
   */
  const uploadAll = useCallback(async () => {
    if (!user) return;

    const data = exportAllForSync(realm);
    await SyncService.uploadFull(user.uid, data.manga, data.history);
  }, [user, realm]);

  /**
   * Download all from cloud and merge into local (for login)
   */
  const downloadAndMerge = useCallback(async (): Promise<{
    mangaCount: number;
    historyCount: number;
  }> => {
    if (!user) return { mangaCount: 0, historyCount: 0 };

    setIsInitialSyncing(true);
    setSyncingFromCloud(true);
    try {
      const cloudData = await SyncService.downloadAll(user.uid);
      const result = importFromCloud(realm, cloudData);
      return result;
    } finally {
      setSyncingFromCloud(false);
      setIsInitialSyncing(false);
    }
  }, [user, realm]);

  /**
   * Clear local Realm data (for logout)
   */
  const clearLocalData = useCallback(() => {
    realm.write(() => {
      realm.deleteAll();
    });
    console.log("[useSyncManager] Cleared all local data");
  }, [realm]);

  /**
   * Clear sync queue
   */
  const clearSyncQueue = useCallback(async () => {
    await SyncService.clearQueue();
  }, []);

  return {
    syncState,
    isInitialSyncing,
    syncNow,
    uploadAll,
    downloadAndMerge,
    clearLocalData,
    clearSyncQueue,
  };
}
