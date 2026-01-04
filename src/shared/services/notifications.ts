/**
 * Notification service for sync completion alerts
 * Uses expo-notifications for local notifications
 * Uses expo-live-activity for iOS progress tracking (Lock Screen + Dynamic Island)
 */

import * as Notifications from "expo-notifications";
import * as LiveActivity from "expo-live-activity";
import { Platform } from "react-native";
import type { SyncResult } from "@/features/Library/stores/useSyncStore";

// Unique ID for sync progress notification (so we can update it)
const SYNC_PROGRESS_NOTIFICATION_ID = "sync-progress";

// Track current Live Activity ID for iOS
let currentActivityId: string | null = null;

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions
 * Call this on app startup
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === "granted") {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/**
 * Start sync progress tracking
 * - iOS: Starts a Live Activity with progress bar
 * - Android: Shows initial notification
 */
export async function startSyncProgress(total: number): Promise<void> {
  if (Platform.OS === "ios") {
    try {
      currentActivityId = await LiveActivity.startActivity({
        title: "Syncing Library",
        body: `Preparing to sync ${total} manga...`,
        progressBar: { progress: 0 },
      });
    } catch (error) {
      console.warn("[Notifications] Failed to start Live Activity:", error);
    }
  }
}

/**
 * Update sync progress
 * - iOS: Updates Live Activity (smooth, no pinging)
 * - Android: Updates notification
 */
export async function updateSyncProgress(
  mangaTitle: string,
  sourceName: string,
  current: number,
  total: number
): Promise<void> {
  if (Platform.OS === "ios" && currentActivityId) {
    try {
      await LiveActivity.updateActivity(currentActivityId, {
        title: `Syncing ${current}/${total}`,
        body: `${mangaTitle} (${sourceName})`,
        progressBar: { progress: current / total },
      });
    } catch (error) {
      console.warn("[Notifications] Failed to update Live Activity:", error);
    }
  } else {
    // Android fallback - dismiss and reschedule
    await Notifications.dismissNotificationAsync(SYNC_PROGRESS_NOTIFICATION_ID);
    await Notifications.scheduleNotificationAsync({
      identifier: SYNC_PROGRESS_NOTIFICATION_ID,
      content: {
        title: `Syncing ${current}/${total}`,
        body: `${mangaTitle} (${sourceName})`,
        sound: false,
      },
      trigger: null, // Immediate
    });
  }
}

/**
 * End sync and show completion
 * - iOS: Stops Live Activity with summary
 * - Android: Sends completion notification
 */
export async function completeSyncProgress(
  result: SyncResult
): Promise<void> {
  // Stop Live Activity on iOS
  if (Platform.OS === "ios" && currentActivityId) {
    try {
      const hasNewChapters = result.newChapters > 0;
      const hasFailures = result.failed.length > 0;

      let title: string;
      let body: string;

      if (hasNewChapters) {
        title = "New Chapters Found!";
        body = `${result.updated} manga updated with ${result.newChapters} new chapters`;
      } else if (hasFailures) {
        title = "Sync Complete with Errors";
        body = `${result.failed.length} failed to sync`;
      } else {
        title = "Library Updated";
        body = "Your library is up to date";
      }

      await LiveActivity.stopActivity(currentActivityId, {
        title,
        body,
      });
    } catch (error) {
      console.warn("[Notifications] Failed to stop Live Activity:", error);
    }
    currentActivityId = null;
  }

  // Dismiss progress notification on Android
  await Notifications.dismissNotificationAsync(SYNC_PROGRESS_NOTIFICATION_ID);

  // Send completion notification on both platforms
  await sendSyncCompletionNotification(result);
}

/**
 * Dismiss sync progress notification (Android only)
 * Call when sync completes
 */
export async function dismissSyncProgressNotification(): Promise<void> {
  await Notifications.dismissNotificationAsync(SYNC_PROGRESS_NOTIFICATION_ID);
}

/**
 * Send a local notification for sync completion
 */
export async function sendSyncCompletionNotification(
  result: SyncResult
): Promise<void> {
  const hasNewChapters = result.newChapters > 0;
  const hasFailures = result.failed.length > 0;

  let title: string;
  let body: string;

  if (hasNewChapters) {
    title = "New Chapters Found!";
    body = `${result.updated} manga updated with ${result.newChapters} new chapters`;
  } else if (hasFailures) {
    title = "Sync Complete with Errors";
    body = `${result.failed.length} failed to sync`;
  } else {
    title = "Library Updated";
    body = "Your library is up to date";
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: false,
    },
    trigger: null, // Immediate
  });
}

/**
 * Clear all pending notifications
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}
