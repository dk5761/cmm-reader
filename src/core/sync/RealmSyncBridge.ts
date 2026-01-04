/**
 * RealmSyncBridge - Listens to Realm changes and queues sync events
 */

import Realm from "realm";
import { MangaSchema, ReadingHistorySchema } from "@/core/database";
import { SyncService } from "./SyncService";
import { CloudManga, CloudHistoryEntry } from "./SyncTypes";

/**
 * Flag to prevent infinite sync loop.
 * When true, Realm listeners will not enqueue changes to SyncService.
 * This is set to true during importFromCloud() to prevent downloaded
 * data from being immediately re-queued for upload.
 */
let isSyncingFromCloud = false;

/**
 * Set the syncing from cloud flag.
 * Call with true before importing cloud data, false after.
 */
export function setSyncingFromCloud(value: boolean): void {
  isSyncingFromCloud = value;
  console.log(
    "[RealmSyncBridge] Cloud sync mode:",
    value ? "PAUSED (importing)" : "ACTIVE (listening)",
  );
}

/**
 * Convert Realm manga to cloud format
 * Note: Firestore doesn't accept undefined, so we omit those fields
 */
function toCloudManga(manga: MangaSchema): CloudManga {
  const cloudManga: CloudManga = {
    id: manga.id,
    sourceId: manga.sourceId,
    inLibrary: manga.inLibrary,
    title: manga.title,
    url: manga.url,
    addedAt: manga.addedAt,
    lastUpdated: manga.lastUpdated ?? Date.now(),
    genres: [...manga.genres],
    chapters: manga.chapters.map((ch) => ({
      id: ch.id,
      number: ch.number,
      isRead: ch.isRead,
      lastPageRead: ch.lastPageRead,
    })),
  };

  // Only add optional fields if they have values
  if (manga.cover) cloudManga.cover = manga.cover;
  if (manga.author) cloudManga.author = manga.author;
  if (manga.description) cloudManga.description = manga.description;
  if (manga.readingStatus) cloudManga.readingStatus = manga.readingStatus;
  if (manga.progress) {
    cloudManga.progress = {
      lastChapterId: manga.progress.lastChapterId ?? undefined,
      lastChapterNumber: manga.progress.lastChapterNumber ?? undefined,
      lastPage: manga.progress.lastPage,
      timestamp: manga.progress.timestamp,
    };
    // Remove undefined keys from progress
    Object.keys(cloudManga.progress).forEach((key) => {
      if ((cloudManga.progress as any)[key] === undefined) {
        delete (cloudManga.progress as any)[key];
      }
    });
  }

  return cloudManga;
}

/**
 * Convert Realm history to cloud format
 */
function toCloudHistory(h: ReadingHistorySchema): CloudHistoryEntry {
  return {
    id: h.id,
    mangaId: h.mangaId,
    mangaTitle: h.mangaTitle,
    mangaCover: h.mangaCover,
    chapterId: h.chapterId,
    chapterNumber: h.chapterNumber,
    chapterTitle: h.chapterTitle,
    chapterUrl: h.chapterUrl,
    pageReached: h.pageReached,
    totalPages: h.totalPages,
    timestamp: h.timestamp,
    sourceId: h.sourceId,
  };
}

/**
 * Start listening to Realm changes and queue sync events
 */
export function startRealmSyncBridge(realm: Realm): () => void {
  const mangaCollection = realm.objects(MangaSchema);
  const historyCollection = realm.objects(ReadingHistorySchema);

  // Track manga changes
  const mangaListener = (
    collection: Realm.Results<MangaSchema>,
    changes: Realm.CollectionChangeSet,
  ) => {
    // Skip initial callback (no changes object properties)
    if (!changes.insertions && !changes.modifications && !changes.deletions) {
      return;
    }

    // Skip if we're importing from cloud (prevents infinite loop)
    if (isSyncingFromCloud) {
      return;
    }

    // Handle insertions (new manga added to library)
    changes.insertions?.forEach((index) => {
      const manga = collection[index];
      if (manga?.inLibrary) {
        SyncService.enqueue({
          type: "manga_added",
          entityId: manga.id,
          data: toCloudManga(manga),
        });
      }
    });

    // Handle modifications
    changes.modifications?.forEach((index) => {
      const manga = collection[index];
      if (manga) {
        SyncService.enqueue({
          type: "manga_updated",
          entityId: manga.id,
          data: toCloudManga(manga),
        });
      }
    });
  };

  // Track history changes
  const historyListener = (
    collection: Realm.Results<ReadingHistorySchema>,
    changes: Realm.CollectionChangeSet,
  ) => {
    // Skip initial callback
    if (!changes.insertions && !changes.modifications && !changes.deletions) {
      return;
    }

    // Skip if we're importing from cloud (prevents infinite loop)
    if (isSyncingFromCloud) {
      return;
    }

    changes.insertions?.forEach((index) => {
      const entry = collection[index];
      if (entry) {
        SyncService.enqueue({
          type: "history_added",
          entityId: entry.id,
          data: toCloudHistory(entry),
        });
      }
    });
  };

  // Add listeners
  mangaCollection.addListener(mangaListener);
  historyCollection.addListener(historyListener);

  console.log("[RealmSyncBridge] Started listening for changes");

  // Return cleanup function
  return () => {
    mangaCollection.removeListener(mangaListener);
    historyCollection.removeListener(historyListener);
    console.log("[RealmSyncBridge] Stopped listening");
  };
}

/**
 * Export all current data for full sync
 */
export function exportAllForSync(realm: Realm): {
  manga: CloudManga[];
  history: CloudHistoryEntry[];
} {
  const mangaList = realm.objects(MangaSchema).filtered("inLibrary == true");
  const historyList = realm.objects(ReadingHistorySchema);

  return {
    manga: [...mangaList].map(toCloudManga),
    history: [...historyList].map(toCloudHistory),
  };
}

/**
 * Import cloud data into Realm (for login sync)
 */
export function importFromCloud(
  realm: Realm,
  cloudData: { manga: CloudManga[]; history: CloudHistoryEntry[] },
): { mangaCount: number; historyCount: number } {
  let mangaCount = 0;
  let historyCount = 0;

  realm.write(() => {
    // Import manga
    for (const cloudManga of cloudData.manga) {
      const existing = realm.objectForPrimaryKey(MangaSchema, cloudManga.id);

      if (existing) {
        // Merge: server wins for conflicts
        existing.inLibrary = cloudManga.inLibrary;
        existing.readingStatus = cloudManga.readingStatus;
        existing.lastUpdated = cloudManga.lastUpdated;

        if (cloudManga.progress) {
          existing.progress = cloudManga.progress as any;
        }

        // Merge chapter read states
        cloudManga.chapters.forEach((cloudCh) => {
          const localCh = existing.chapters.find((c) => c.id === cloudCh.id);
          if (localCh) {
            // Server wins: if cloud says read, mark read
            if (cloudCh.isRead) {
              localCh.isRead = true;
            }
            localCh.lastPageRead = Math.max(
              localCh.lastPageRead,
              cloudCh.lastPageRead,
            );
          }
        });
      } else {
        // Create new manga
        realm.create(MangaSchema, {
          id: cloudManga.id,
          sourceId: cloudManga.sourceId,
          inLibrary: cloudManga.inLibrary,
          title: cloudManga.title,
          cover: cloudManga.cover,
          url: cloudManga.url,
          author: cloudManga.author,
          description: cloudManga.description,
          genres: cloudManga.genres,
          readingStatus: cloudManga.readingStatus || "reading",
          addedAt: cloudManga.addedAt,
          lastUpdated: cloudManga.lastUpdated,
          chapters: cloudManga.chapters.map((ch) => ({
            id: ch.id,
            number: ch.number,
            title: "",
            url: "",
            isRead: ch.isRead,
            lastPageRead: ch.lastPageRead,
          })),
          progress: cloudManga.progress,
        });
      }
      mangaCount++;
    }

    // Import history
    for (const cloudHistory of cloudData.history) {
      const existing = realm.objectForPrimaryKey(
        ReadingHistorySchema,
        cloudHistory.id,
      );
      if (!existing) {
        realm.create(ReadingHistorySchema, cloudHistory);
        historyCount++;
      }
    }
  });

  console.log(
    "[RealmSyncBridge] Imported",
    mangaCount,
    "manga,",
    historyCount,
    "history",
  );
  return { mangaCount, historyCount };
}
