import { useCallback } from "react";
import { useRealm } from "@realm/react";
import { MangaSchema, ReadingProgressSchema } from "@/core/database";

/**
 * Save reading progress - updates embedded object
 */
export function useSaveProgress() {
  const realm = useRealm();

  return useCallback(
    (
      mangaId: string,
      chapterId: string,
      chapterNumber: number,
      page: number
    ) => {
      realm.write(() => {
        const manga = realm.objectForPrimaryKey(MangaSchema, mangaId);
        if (!manga) return;

        // Update progress
        manga.progress = {
          lastChapterId: chapterId,
          lastChapterNumber: chapterNumber,
          lastPage: page,
          timestamp: Date.now(),
        } as ReadingProgressSchema;

        // Also update chapter's lastPageRead
        const chapter = manga.chapters.find((c) => c.id === chapterId);
        if (chapter) {
          chapter.lastPageRead = page;
        }
      });
    },
    [realm]
  );
}

/**
 * Mark chapter as read
 */
export function useMarkChapterRead() {
  const realm = useRealm();

  return useCallback(
    (mangaId: string, chapterId: string, totalPages?: number) => {
      console.log("[useMarkChapterRead] Called with:", { mangaId, chapterId });
      realm.write(() => {
        const manga = realm.objectForPrimaryKey(MangaSchema, mangaId);
        console.log("[useMarkChapterRead] Manga found:", !!manga);
        if (!manga) {
          console.log("[useMarkChapterRead] Manga not in library!");
          return;
        }

        console.log("[useMarkChapterRead] Looking for chapter:", chapterId);
        console.log(
          "[useMarkChapterRead] Available chapter IDs (first 5):",
          manga.chapters.slice(0, 5).map((c) => c.id)
        );

        const chapter = manga.chapters.find((c) => c.id === chapterId);
        if (chapter) {
          chapter.isRead = true;
          if (totalPages) {
            chapter.totalPages = totalPages;
          }
          console.log("[Progress] Marked chapter as read:", chapterId);
        } else {
          console.log(
            "[useMarkChapterRead] Chapter NOT found in manga.chapters!"
          );
        }
      });
    },
    [realm]
  );
}

/**
 * Mark all previous chapters as read
 */
export function useMarkPreviousAsRead() {
  const realm = useRealm();

  return useCallback(
    (mangaId: string, chapterNumber: number) => {
      realm.write(() => {
        const manga = realm.objectForPrimaryKey(MangaSchema, mangaId);
        if (!manga) return;

        let marked = 0;
        manga.chapters.forEach((chapter) => {
          if (chapter.number < chapterNumber && !chapter.isRead) {
            chapter.isRead = true;
            marked++;
          }
        });

        if (marked > 0) {
          console.log("[Progress] Marked", marked, "previous chapters as read");
        }
      });
    },
    [realm]
  );
}

/**
 * Mark chapter as unread
 */
export function useMarkChapterUnread() {
  const realm = useRealm();

  return useCallback(
    (mangaId: string, chapterId: string) => {
      realm.write(() => {
        const manga = realm.objectForPrimaryKey(MangaSchema, mangaId);
        const chapter = manga?.chapters.find((c) => c.id === chapterId);
        if (chapter) {
          chapter.isRead = false;
          chapter.lastPageRead = 0;
          console.log("[Progress] Marked chapter as unread:", chapterId);
        }
      });
    },
    [realm]
  );
}

/**
 * Get reading progress for a manga
 */
export function useGetProgress(mangaId: string) {
  const manga = useRealm().objectForPrimaryKey(MangaSchema, mangaId);
  return manga?.progress;
}
