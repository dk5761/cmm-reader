/**
 * useSyncManager - React hook for managing cloud sync
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useRealm } from "@realm/react";
import { useAuth } from "@/core/auth";
import { SyncService } from "./SyncService";
import {
  startRealmSyncBridge,
  exportAllForSync,
  importFromCloud,
} from "./RealmSyncBridge";
import { SyncState } from "./SyncTypes";

export function useSyncManager() {
  const realm = useRealm();
  const { user } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>(SyncService.getState());
  const [isInitialSyncing, setIsInitialSyncing] = useState(false);
  const bridgeCleanupRef = useRef<(() => void) | null>(null);

  // Initialize sync service and bridge when user logs in
  useEffect(() => {
    if (!user) {
      // Cleanup on logout
      if (bridgeCleanupRef.current) {
        bridgeCleanupRef.current();
        bridgeCleanupRef.current = null;
      }
      return;
    }

    // Initialize
    const init = async () => {
      await SyncService.initialize();
      bridgeCleanupRef.current = startRealmSyncBridge(realm);
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
