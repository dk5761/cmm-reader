/**
 * RealmSyncBridge - Listens to Realm changes and queues sync events
 */

import Realm from "realm";
import { MangaSchema, ReadingHistorySchema, CategorySchema } from "@/core/database";
import { SyncService } from "./SyncService";
import { CloudManga, CloudHistoryEntry, CloudCategory } from "./SyncTypes";

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
    categories: [...(manga.categories || [])], // Sync categories
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
    const progress = {
      lastChapterId: manga.progress.lastChapterId ?? undefined,
      lastChapterNumber: manga.progress.lastChapterNumber ?? undefined,
      lastPage: manga.progress.lastPage,
      timestamp: manga.progress.timestamp,
    };
    
    // Create a clean object without undefined values
    cloudManga.progress = Object.entries(progress).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key as keyof typeof progress] = value as any;
      }
      return acc;
    }, {} as typeof progress);
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
 * Convert Realm category to cloud format
 */
function toCloudCategory(c: CategorySchema): CloudCategory {
  return {
    id: c.id,
    name: c.name,
    order: c.order,
    mangaIds: [...c.mangaIds],
  };
}

/**
 * Start listening to Realm changes and queue sync events
 */
export function startRealmSyncBridge(realm: Realm): () => void {
  const mangaCollection = realm.objects(MangaSchema);
  const historyCollection = realm.objects(ReadingHistorySchema);
  const categoryCollection = realm.objects(CategorySchema);

  // Track manga changes
  const mangaListener = (
    collection: Realm.OrderedCollection<MangaSchema>,
    changes: Realm.CollectionChangeSet,
  ) => {
    // Skip initial callback (no changes object properties)
    if (!changes.insertions && !changes.newModifications && !changes.deletions) {
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
    changes.newModifications?.forEach((index: number) => {
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
    collection: Realm.OrderedCollection<ReadingHistorySchema>,
    changes: Realm.CollectionChangeSet,
  ) => {
    // Skip initial callback
    if (!changes.insertions && !changes.newModifications && !changes.deletions) {
      return;
    }

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

  // Track category changes
  const categoryListener = (
    collection: Realm.OrderedCollection<CategorySchema>,
    changes: Realm.CollectionChangeSet,
  ) => {
    if (!changes.insertions && !changes.newModifications && !changes.deletions) {
      return;
    }

    if (isSyncingFromCloud) {
      return;
    }

    changes.insertions?.forEach((index) => {
      const cat = collection[index];
      if (cat) {
        SyncService.enqueue({
          type: "category_added",
          entityId: cat.id,
          data: toCloudCategory(cat),
        });
      }
    });

    changes.newModifications?.forEach((index) => {
      const cat = collection[index];
      if (cat) {
        SyncService.enqueue({
          type: "category_updated",
          entityId: cat.id,
          data: toCloudCategory(cat),
        });
      }
    });

    changes.deletions?.forEach((index) => {
      // NOTE: We can't get the deleted object's ID directly from Realm after deletion.
      // SyncService would need to handle deletions differently (e.g. store ID map)
      // For now, deletions are not fully supported in incremental sync without ID tracking.
      // Full sync handles deletion by absence.
      // This is a known limitation.
    });
  };

  // Add listeners
  mangaCollection.addListener(mangaListener);
  historyCollection.addListener(historyListener);
  categoryCollection.addListener(categoryListener);

  console.log("[RealmSyncBridge] Started listening for changes");

  // Return cleanup function
  return () => {
    mangaCollection.removeListener(mangaListener);
    historyCollection.removeListener(historyListener);
    categoryCollection.removeListener(categoryListener);
    console.log("[RealmSyncBridge] Stopped listening");
  };
}

/**
 * Export all current data for full sync
 */
export function exportAllForSync(realm: Realm): {
  manga: CloudManga[];
  history: CloudHistoryEntry[];
  categories: CloudCategory[];
} {
  const mangaList = realm.objects(MangaSchema).filtered("inLibrary == true");
  const historyList = realm.objects(ReadingHistorySchema);
  const categoryList = realm.objects(CategorySchema);

  return {
    manga: [...mangaList].map(toCloudManga),
    history: [...historyList].map(toCloudHistory),
    categories: [...categoryList].map(toCloudCategory),
  };
}

/**
 * Import cloud data into Realm (for login sync)
 */
export function importFromCloud(
  realm: Realm,
  cloudData: { 
    manga: CloudManga[]; 
    history: CloudHistoryEntry[]; 
    categories?: CloudCategory[]; // Optional for backward compatibility
  },
): { mangaCount: number; historyCount: number; categoryCount: number } {
  let mangaCount = 0;
  let historyCount = 0;
  let categoryCount = 0;

  realm.write(() => {
    // Import manga
    for (const cloudManga of cloudData.manga) {
      const existing = realm.objectForPrimaryKey(MangaSchema, cloudManga.id);

      if (existing) {
        // Merge: server wins for conflicts
        existing.inLibrary = cloudManga.inLibrary;
        existing.readingStatus = cloudManga.readingStatus;
        existing.lastUpdated = cloudManga.lastUpdated;
        
        // Sync categories
        if (cloudManga.categories) {
          // Realm.List requires specific handling, but assigning array often works in React Native Realm
          // We cast to any to suppress TS error about assigning string[] to Realm.List<string>
          existing.categories = cloudManga.categories as any;
        }

        if (cloudManga.progress) {
          // Update embedded object
          if (!existing.progress) {
            existing.progress = {} as ReadingProgressSchema;
          }
          existing.progress.lastChapterId = cloudManga.progress.lastChapterId;
          existing.progress.lastChapterNumber = cloudManga.progress.lastChapterNumber;
          existing.progress.lastPage = cloudManga.progress.lastPage;
          existing.progress.timestamp = cloudManga.progress.timestamp;
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
          categories: cloudManga.categories || [],
          chapters: cloudManga.chapters.map((ch) => ({
            id: ch.id,
            number: ch.number,
            title: "",
            url: "",
            isRead: ch.isRead,
            lastPageRead: ch.lastPageRead,
          })),
          ...(cloudManga.progress && {
            progress: {
              lastChapterId: cloudManga.progress.lastChapterId,
              lastChapterNumber: cloudManga.progress.lastChapterNumber,
              lastPage: cloudManga.progress.lastPage,
              timestamp: cloudManga.progress.timestamp,
            },
          }),
        } as any);
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

    // Import categories
    if (cloudData.categories) {
      for (const cloudCat of cloudData.categories) {
        const existing = realm.objectForPrimaryKey(CategorySchema, cloudCat.id);
        if (existing) {
          existing.name = cloudCat.name;
          existing.order = cloudCat.order;
          existing.mangaIds = cloudCat.mangaIds as any;
        } else {
          realm.create(CategorySchema, {
            id: cloudCat.id,
            name: cloudCat.name,
            order: cloudCat.order,
            mangaIds: cloudCat.mangaIds,
          });
        }
        categoryCount++;
      }
    }
  });

  console.log(
    "[RealmSyncBridge] Imported",
    mangaCount,
    "manga,",
    historyCount,
    "history,",
    categoryCount,
    "categories"
  );
  return { mangaCount, historyCount, categoryCount };
}
