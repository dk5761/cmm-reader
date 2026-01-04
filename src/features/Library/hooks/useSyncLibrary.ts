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
      mangaUpdates: [],
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

          // Create map for fast lookup
          const existingChaptersMap = new Map(
            manga.chapters.map((ch) => [ch.id, ch])
          );

          const newChapters = chapters.filter(
            (ch) => !existingChaptersMap.has(ch.id)
          );
          let updatedChaptersCount = 0;

          const syncTimestamp = Date.now();

          // Update all chapters (both new and existing)
          realm.write(() => {
            const realmManga = realm.objectForPrimaryKey(MangaSchema, manga.id);
            if (!realmManga) return;

            // Update existing chapters
            chapters.forEach((ch) => {
              const existingCh = existingChaptersMap.get(ch.id);
              if (existingCh) {
                // Update metadata for existing chapter
                const realmCh = realmManga.chapters.find((c) => c.id === ch.id);
                if (realmCh) {
                  if (realmCh.date !== ch.date) {
                    realmCh.date = ch.date;
                    updatedChaptersCount++;
                  }
                  if (realmCh.title !== ch.title && ch.title) {
                    realmCh.title = ch.title;
                  }
                }
              }
            });

            // Add new chapters
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

            if (newChapters.length > 0 || updatedChaptersCount > 0) {
              realmManga.lastUpdated = Date.now();
            }
          });

          if (newChapters.length > 0) {
            // Track per-manga update
            result.mangaUpdates.push({
              mangaId: manga.id,
              mangaTitle: manga.title,
              cover: manga.cover,
              sourceId: manga.sourceId,
              sourceName: source.name,
              newChapters: newChapters.map((ch) => ({
                chapterId: ch.id,
                chapterNumber: ch.number,
                chapterTitle: ch.title,
                addedAt: syncTimestamp,
              })),
              previousChapterCount: manga.chapters.length - newChapters.length,
              currentChapterCount: manga.chapters.length,
              syncedAt: syncTimestamp,
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
          } else if (updatedChaptersCount > 0) {
            console.log(
              "[Sync]",
              manga.title,
              ":",
              updatedChaptersCount,
              "chapters updated"
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
