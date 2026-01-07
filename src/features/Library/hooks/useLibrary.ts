import { useCallback, useMemo } from "react";
import { useRealm, useQuery, useObject } from "@realm/react";
import { MangaSchema, ChapterSchema, ReadingStatus } from "@/core/database";
import type { Manga, Chapter } from "@/sources";
import { downloadCover, deleteCover } from "@/core/services/ImageCacheService";

/**
 * Get all manga in library
 * Returns reactive list that auto-updates on changes
 */
export function useLibraryManga() {
  const manga = useQuery(MangaSchema);

  const libraryManga = useMemo(() => {
    return manga.filtered("inLibrary == true").sorted("addedAt", true); // Most recent first
  }, [manga]);

  return libraryManga;
}

/**
 * Get manga filtered by reading status
 */
export function useLibraryByStatus(status: ReadingStatus | "all") {
  const manga = useQuery(MangaSchema);

  const filtered = useMemo(() => {
    if (status === "all") {
      return manga.filtered("inLibrary == true").sorted("addedAt", true);
    }
    return manga
      .filtered("inLibrary == true AND readingStatus == $0", status)
      .sorted("addedAt", true);
  }, [manga, status]);

  return filtered;
}

/**
 * Check if manga is in library
 */
export function useIsInLibrary(sourceId: string, mangaId: string) {
  const id = `${sourceId}_${mangaId}`;
  const manga = useObject(MangaSchema, id);
  return manga?.inLibrary === true;
}

/**
 * Get single manga from library with all chapters
 */
export function useLibraryMangaById(id: string) {
  return useObject(MangaSchema, id);
}

/**
 * Add manga to library with chapters
 */
export function useAddToLibrary() {
  const realm = useRealm();

  return useCallback(
    async (manga: Manga, chapters: Chapter[], sourceId: string) => {
      const id = `${sourceId}_${manga.id}`;

      realm.write(() => {
        // Check if already exists (was being tracked)
        const existing = realm.objectForPrimaryKey(MangaSchema, id);
        if (existing) {
          // Already tracked, just set inLibrary flag and merge chapters
          existing.inLibrary = true;
          existing.lastUpdated = Date.now();

          // Merge any new chapters from API
          const existingIds = new Set(existing.chapters.map((c) => c.id));
          const newChapters = chapters.filter((ch) => !existingIds.has(ch.id));

          if (newChapters.length > 0) {
            newChapters.forEach((ch) => {
              existing.chapters.push({
                id: ch.id,
                number: ch.number,
                title: ch.title,
                url: ch.url,
                date: ch.date,
                isRead: false,
                lastPageRead: 0,
              } as ChapterSchema);
            });
            console.log("[Library] Merged", newChapters.length, "new chapters");
          }

          console.log("[Library] Added to library (was tracked):", id);
          return;
        }

        // New manga - create with inLibrary = true
        realm.create(MangaSchema, {
          id,
          sourceId,
          inLibrary: true,
          title: manga.title,
          cover: manga.cover,
          url: manga.url,
          author: manga.author,
          artist: manga.artist,
          status: manga.status,
          description: manga.description,
          genres: manga.genres || [],
          chapters: chapters.map((ch) => ({
            id: ch.id,
            number: ch.number,
            title: ch.title,
            url: ch.url,
            date: ch.date,
            isRead: false,
            lastPageRead: 0,
          })),
          readingStatus: "reading",
          addedAt: Date.now(),
          lastUpdated: Date.now(),
        });

        console.log("[Library] Added new manga:", manga.title);
      });

      // Background cover download
      if (manga.cover) {
        const localPath = await downloadCover(manga.cover, id);
        if (localPath) {
          realm.write(() => {
            const addedManga = realm.objectForPrimaryKey(MangaSchema, id);
            if (addedManga) {
              addedManga.localCover = localPath;
            }
          });
        }
      }
    },
    [realm]
  );
}

/**
 * Remove manga from library
 */
export function useRemoveFromLibrary() {
  const realm = useRealm();

  return useCallback(
    (id: string) => {
      // Background cover deletion
      deleteCover(id);

      realm.write(() => {
        const manga = realm.objectForPrimaryKey(MangaSchema, id);
        if (manga) {
          // Keep manga for history/progress tracking, just hide from library
          manga.inLibrary = false;
          console.log("[Library] Removed from library (hidden):", id);
        }
      });
    },
    [realm]
  );
}

/**
 * Update reading status
 */
export function useUpdateReadingStatus() {
  const realm = useRealm();

  return useCallback(
    (id: string, status: ReadingStatus) => {
      realm.write(() => {
        const manga = realm.objectForPrimaryKey(MangaSchema, id);
        if (manga) {
          manga.readingStatus = status;
          console.log("[Library] Updated status:", id, status);
        }
      });
    },
    [realm]
  );
}

/**
 * Update chapters in library (for checking updates)
 */
export function useUpdateLibraryChapters() {
  const realm = useRealm();

  return useCallback(
    (id: string, newChapters: Chapter[]) => {
      console.log("[DEBUG useUpdateLibraryChapters] CALLED with:", {
        mangaId: id,
        newChapterCount: newChapters.length,
      });

      realm.write(() => {
        const manga = realm.objectForPrimaryKey(MangaSchema, id);
        if (!manga) return;

        // Create a map of existing chapters for fast lookup
        const existingChaptersMap = new Map(
          manga.chapters.map((ch) => [ch.id, ch])
        );

        let addedCount = 0;
        let updatedCount = 0;

        newChapters.forEach((newCh) => {
          const existingCh = existingChaptersMap.get(newCh.id);

          if (existingCh) {
            // Update existing chapter if date or other metadata changed
            let hasChanges = false;

            if (existingCh.date !== newCh.date) {
              console.log("[Library] Updating chapter date:", {
                chapterId: existingCh.id,
                oldDate: existingCh.date,
                newDate: newCh.date,
              });
              existingCh.date = newCh.date;
              hasChanges = true;
            }

            if (existingCh.title !== newCh.title && newCh.title) {
              existingCh.title = newCh.title;
              hasChanges = true;
            }

            if (hasChanges) {
              updatedCount++;
            }
          } else {
            // Add new chapter
            manga.chapters.push({
              id: newCh.id,
              number: newCh.number,
              title: newCh.title,
              url: newCh.url,
              date: newCh.date,
              isRead: false,
              lastPageRead: 0,
            } as ChapterSchema);
            addedCount++;
          }
        });

        if (addedCount > 0 || updatedCount > 0) {
          manga.lastUpdated = Date.now();
          console.log("[Library] Synced chapters for", manga.title, {
            added: addedCount,
            updated: updatedCount,
          });
        }
      });
    },
    [realm]
  );
}

/**
 * Get or create manga for progress tracking (inLibrary = false)
 * Used when reading manga from browse without adding to library
 */
export function useGetOrCreateManga() {
  const realm = useRealm();

  return useCallback(
    (manga: Manga, chapters: Chapter[], sourceId: string) => {
      const id = `${sourceId}_${manga.id}`;

      realm.write(() => {
        const existing = realm.objectForPrimaryKey(MangaSchema, id);
        if (existing) {
          // Already tracked, just update chapters if needed
          const existingIds = new Set(existing.chapters.map((c) => c.id));
          const newChapters = chapters.filter((ch) => !existingIds.has(ch.id));

          if (newChapters.length > 0) {
            newChapters.forEach((ch) => {
              existing.chapters.push({
                id: ch.id,
                number: ch.number,
                title: ch.title,
                url: ch.url,
                date: ch.date,
                isRead: false,
                lastPageRead: 0,
              } as ChapterSchema);
            });
            console.log("[Track] Updated chapters for tracked manga:", id);
          }
          return;
        }

        // Create new entry for tracking (inLibrary = false by default)
        realm.create(MangaSchema, {
          id,
          sourceId,
          inLibrary: false, // KEY: Not in library, just tracking
          title: manga.title,
          cover: manga.cover,
          url: manga.url,
          author: manga.author,
          artist: manga.artist,
          status: manga.status,
          description: manga.description,
          genres: manga.genres || [],
          chapters: chapters.map((ch) => ({
            id: ch.id,
            number: ch.number,
            title: ch.title,
            url: ch.url,
            date: ch.date,
            isRead: false,
            lastPageRead: 0,
          })),
          readingStatus: "reading",
          addedAt: Date.now(),
          lastUpdated: Date.now(),
        });

        console.log("[Track] Created tracking entry:", manga.title);
      });
    },
    [realm]
  );
}
