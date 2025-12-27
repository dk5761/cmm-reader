/**
 * useUpdateChecker - Checks for OTA updates on app start
 * Returns update state for blocking UI
 */

import { useState, useEffect, useCallback } from "react";
import * as Updates from "expo-updates";

export type UpdateStatus =
  | "checking"
  | "downloading"
  | "ready"
  | "no-update"
  | "error"
  | "dev-mode";

export function useUpdateChecker() {
  const [status, setStatus] = useState<UpdateStatus>("checking");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdate = useCallback(async () => {
    // Skip in development
    if (__DEV__) {
      setStatus("dev-mode");
      return;
    }

    try {
      setStatus("checking");
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setStatus("downloading");

        // Fetch the update
        const result = await Updates.fetchUpdateAsync();

        if (result.isNew) {
          setStatus("ready");
        } else {
          setStatus("no-update");
        }
      } else {
        setStatus("no-update");
      }
    } catch (e) {
      console.error("[Updates] Check failed:", e);
      setError((e as Error).message);
      setStatus("error");
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    try {
      await Updates.reloadAsync();
    } catch (e) {
      console.error("[Updates] Reload failed:", e);
      setError((e as Error).message);
      setStatus("error");
    }
  }, []);

  const skipUpdate = useCallback(() => {
    setStatus("no-update");
  }, []);

  // Check on mount
  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  return {
    status,
    progress,
    error,
    checkForUpdate,
    applyUpdate,
    skipUpdate,
    isBlocking:
      status === "checking" || status === "downloading" || status === "ready",
  };
}
