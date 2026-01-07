import { useCallback } from "react";
import { useObject } from "@realm/react";
import { MangaSchema } from "@/core/database";
import { useRepositories } from "@/core/database/repositories";

/**
 * Save reading progress - updates embedded object
 */
export function useSaveProgress() {
  const { chapter: chapterRepo } = useRepositories();

  return useCallback(
    async (
      mangaId: string,
      chapterId: string,
      chapterNumber: number,
      page: number
    ) => {
      await chapterRepo.saveProgress(mangaId, chapterId, chapterNumber, page);
    },
    [chapterRepo]
  );
}

/**
 * Mark chapter as read
 */
export function useMarkChapterRead() {
  const { chapter: chapterRepo } = useRepositories();

  return useCallback(
    async (mangaId: string, chapterId: string, totalPages?: number) => {
      console.log("[useMarkChapterRead] Called with:", { mangaId, chapterId });
      
      // We need to pass isRead=true. 
      // The repo method `markAsRead` takes `chapterId` and `isRead`.
      // It doesn't take `mangaId` (it finds chapter by ID assuming uniqueness or knowledge).
      // Wait, `RealmChapterRepository.markAsRead` uses `getChapter(chapterId)`.
      // `getChapter` uses `realm.objects(MangaSchema).filtered("chapters.id == $0", chapterId)[0]`.
      // So it doesn't need mangaId.
      
      // However, `useMarkChapterRead` in original code took `mangaId` and `totalPages`.
      // I should update `markAsRead` in repo to handle `totalPages` or use `updateProgress`.
      // Actually `markAsRead` in repo only sets `isRead`.
      // `useMarkChapterRead` also sets `totalPages`.
      
      await chapterRepo.markAsRead(chapterId, true);
      if (totalPages) {
        await chapterRepo.updateProgress(chapterId, 0, totalPages);
      }
      console.log("[Progress] Marked chapter as read:", chapterId);
    },
    [chapterRepo]
  );
}

/**
 * Mark all previous chapters as read
 */
export function useMarkPreviousAsRead() {
  const { chapter: chapterRepo } = useRepositories();

  return useCallback(
    async (mangaId: string, chapterNumber: number) => {
      await chapterRepo.markPreviousAsRead(mangaId, chapterNumber);
      console.log("[Progress] Marked previous chapters as read");
    },
    [chapterRepo]
  );
}

/**
 * Mark all previous chapters as unread
 */
export function useMarkPreviousAsUnread() {
  const { chapter: chapterRepo } = useRepositories();

  return useCallback(
    async (mangaId: string, chapterNumber: number) => {
      await chapterRepo.markPreviousAsUnread(mangaId, chapterNumber);
      console.log("[Progress] Marked previous chapters as unread");
    },
    [chapterRepo]
  );
}

/**
 * Mark chapter as unread
 */
export function useMarkChapterUnread() {
  const { chapter: chapterRepo } = useRepositories();

  return useCallback(
    async (mangaId: string, chapterId: string) => {
      await chapterRepo.markAsRead(chapterId, false);
      console.log("[Progress] Marked chapter as unread:", chapterId);
    },
    [chapterRepo]
  );
}

/**
 * Get reading progress for a manga
 */
export function useGetProgress(mangaId: string) {
  const manga = useObject(MangaSchema, mangaId);
  return manga?.progress;
}
