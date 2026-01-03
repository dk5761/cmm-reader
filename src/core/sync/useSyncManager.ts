/**
 * useSyncManager - React hook for managing cloud sync
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useRealm } from "@realm/react";
import { useRouter } from "expo-router";
import { useAuth } from "@/core/auth";
import { MangaSchema } from "@/core/database";
import { SyncService } from "./SyncService";
import {
  startRealmSyncBridge,
  exportAllForSync,
  importFromCloud,
} from "./RealmSyncBridge";
import { SyncState } from "./SyncTypes";
import { useSyncStore } from "@/features/Library/stores/useSyncStore";

export function useSyncManager() {
  const realm = useRealm();
  const router = useRouter();
  const { user } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>(SyncService.getState());
  const [isInitialSyncing, setIsInitialSyncing] = useState(false);
  const bridgeCleanupRef = useRef<(() => void) | null>(null);
  const startupSyncDoneRef = useRef(false);

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
      startupSyncDoneRef.current = false;
      return;
    }

    // Initialize and check startup sync
    const init = async () => {
      await SyncService.initialize();
      bridgeCleanupRef.current = startRealmSyncBridge(realm);

      // Startup sync: check if we need to sync from cloud
      if (!startupSyncDoneRef.current) {
        startupSyncDoneRef.current = true;

        const localMangaCount = realm
          .objects(MangaSchema)
          .filtered("inLibrary == true").length;

        console.log(
          "[useSyncManager] Startup sync check - local manga:",
          localMangaCount
        );

        if (localMangaCount === 0) {
          // Empty library - redirect to sync screen for loading UI
          console.log(
            "[useSyncManager] Empty library, redirecting to sync screen"
          );
          router.replace("/sync?action=startup");
        } else {
          // Has library items - background sync with banner
          console.log("[useSyncManager] Background startup sync");
          startCloudSync("Syncing with cloud...");
          try {
            const cloudData = await SyncService.downloadAll(user.uid);
            if (cloudData.manga.length > 0 || cloudData.history.length > 0) {
              updateCloudSyncStatus("Merging data...");
              importFromCloud(realm, cloudData);
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

  // Flush sync on app background
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === "background" || state === "inactive") {
        SyncService.flush();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, []);

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
    try {
      const cloudData = await SyncService.downloadAll(user.uid);
      const result = importFromCloud(realm, cloudData);
      return result;
    } finally {
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
