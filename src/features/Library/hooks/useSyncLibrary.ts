import { useCallback } from "react";
import { useRealm, useQuery } from "@realm/react";
import { MangaSchema, ChapterSchema } from "@/core/database";
import { getSource } from "@/sources";
import { useSyncStore, SyncResult, SyncFailure } from "../stores/useSyncStore";
import {
  sendSyncCompletionNotification,
  sendSyncProgressNotification,
} from "@/shared/services/notifications";

/**
 * Hook to sync all library manga and check for new chapters
 * Groups manga by source for efficient processing
 * No session warmup needed - CookieManager handles cookies automatically
 */
export function useSyncLibrary() {
  const realm = useRealm();
  const allManga = useQuery(MangaSchema);
  const { isSyncing, startSync, setWarmingUp, updateProgress, completeSync } =
    useSyncStore();

  const syncLibrary = useCallback(async () => {
    if (isSyncing) return;

    const mangaList = [...allManga];
    if (mangaList.length === 0) {
      console.log("[Sync] No manga in library");
      return;
    }

    // Group manga by sourceId
    const grouped = new Map<string, typeof mangaList>();
    mangaList.forEach((manga) => {
      const list = grouped.get(manga.sourceId) || [];
      list.push(manga);
      grouped.set(manga.sourceId, list);
    });

    console.log(
      "[Sync] Starting sync for",
      mangaList.length,
      "manga across",
      grouped.size,
      "sources"
    );

    startSync(mangaList.length);

    const result: SyncResult = {
      timestamp: Date.now(),
      updated: 0,
      newChapters: 0,
      failed: [],
      skippedSources: [],
    };

    let processedCount = 0;

    // Process each source
    for (const [sourceId, sourceManga] of grouped) {
      const source = getSource(sourceId);
      if (!source) {
        result.skippedSources.push(`Unknown source: ${sourceId}`);
        processedCount += sourceManga.length;
        continue;
      }

      // No session warmup needed - CloudflareInterceptor handles CF automatically
      console.log("[Sync] Processing", source.name);

      // Sync each manga in this source
      for (const manga of sourceManga) {
        processedCount++;
        updateProgress(processedCount, source.name, manga.title);

        // Show progress notification
        sendSyncProgressNotification(
          manga.title,
          source.name,
          processedCount,
          mangaList.length
        ).catch(() => {}); // Fire and forget

        try {
          // Fetch latest chapters
          const chapters = await source.getChapterList(manga.url);

          // Find new chapters
          const existingIds = new Set(manga.chapters.map((c) => c.id));
          const newChapters = chapters.filter((ch) => !existingIds.has(ch.id));

          if (newChapters.length > 0) {
            // Add new chapters to Realm
            realm.write(() => {
              const realmManga = realm.objectForPrimaryKey(
                MangaSchema,
                manga.id
              );
              if (!realmManga) return;

              newChapters.forEach((ch) => {
                realmManga.chapters.push({
                  id: ch.id,
                  number: ch.number,
                  title: ch.title,
                  url: ch.url,
                  date: ch.date,
                  isRead: false,
                  lastPageRead: 0,
                } as ChapterSchema);
              });

              realmManga.lastUpdated = Date.now();
            });

            result.updated++;
            result.newChapters += newChapters.length;
            console.log(
              "[Sync]",
              manga.title,
              ":",
              newChapters.length,
              "new chapters"
            );
          }
        } catch (error) {
          console.error("[Sync] Failed to sync", manga.title, ":", error);
          result.failed.push({
            mangaId: manga.id,
            mangaTitle: manga.title,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    completeSync(result);
    console.log("[Sync] Complete:", result);

    // Send local notification
    try {
      await sendSyncCompletionNotification(result);
    } catch (e) {
      console.warn("[Sync] Failed to send notification:", e);
    }

    return result;
  }, [allManga, isSyncing, realm, startSync, updateProgress, completeSync]);

  return {
    syncLibrary,
    isSyncing,
  };
}
