import { useCallback, useMemo } from "react";
import { useQuery, useObject } from "@realm/react";
import { MangaSchema, ReadingStatus } from "@/core/database";
import type { Manga, Chapter, MangaDetails } from "@/sources";
import { downloadCover, deleteCover } from "@/core/services/ImageCacheService";
import { useRepositories } from "@/core/database/repositories";

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
  const { manga: mangaRepo, chapter: chapterRepo } = useRepositories();

  return useCallback(
    async (manga: Manga, chapters: Chapter[], sourceId: string) => {
      const id = manga.id.startsWith(`${sourceId}_`)
        ? manga.id
        : `${sourceId}_${manga.id}`;

      // Convert basic Manga to MangaDetails structure for repo
      // We assume basic details are enough, repo will handle the rest
      const details: MangaDetails = {
        ...manga,
        id: manga.id, // addManga repo will handle making this a compound ID if needed, but let's be safe
        sourceId,
        author: manga.author,
        artist: manga.artist,
        status: manga.status,
        description: manga.description,
        genres: manga.genres || [],
      };

      await mangaRepo.addManga(details, true);
      await chapterRepo.saveChapters(id, chapters);

      // Background cover download
      if (manga.cover) {
        const localPath = await downloadCover(manga.cover, id);
        if (localPath) {
          await mangaRepo.updateManga(id, { localCover: localPath });
        }
      }
    },
    [mangaRepo, chapterRepo]
  );
}

/**
 * Remove manga from library
 */
export function useRemoveFromLibrary() {
  const { manga: mangaRepo } = useRepositories();

  return useCallback(
    async (id: string) => {
      // Background cover deletion
      deleteCover(id);
      
      await mangaRepo.removeFromLibrary(id);
    },
    [mangaRepo]
  );
}

/**
 * Update reading status
 */
export function useUpdateReadingStatus() {
  const { manga: mangaRepo } = useRepositories();

  return useCallback(
    async (id: string, status: ReadingStatus) => {
      await mangaRepo.updateManga(id, { readingStatus: status });
    },
    [mangaRepo]
  );
}

/**
 * Update chapters in library (for checking updates)
 */
export function useUpdateLibraryChapters() {
  const { chapter: chapterRepo } = useRepositories();

  return useCallback(
    async (id: string, newChapters: Chapter[]) => {
      await chapterRepo.saveChapters(id, newChapters);
    },
    [chapterRepo]
  );
}

/**
 * Get or create manga for progress tracking (inLibrary = false)
 * Used when reading manga from browse without adding to library
 */
export function useGetOrCreateManga() {
  const { manga: mangaRepo, chapter: chapterRepo } = useRepositories();

  return useCallback(
    async (manga: Manga, chapters: Chapter[], sourceId: string) => {
      const id = manga.id.startsWith(`${sourceId}_`)
        ? manga.id
        : `${sourceId}_${manga.id}`;

      // Check if exists first to avoid overwriting inLibrary status
      const existing = mangaRepo.getManga(id);
      
      if (!existing) {
        const details: MangaDetails = {
          ...manga,
          id: manga.id,
          sourceId,
          author: manga.author,
          artist: manga.artist,
          status: manga.status,
          description: manga.description,
          genres: manga.genres || [],
        };
        // Create with inLibrary = false
        await mangaRepo.addManga(details, false);
      }

      // Always sync chapters
      await chapterRepo.saveChapters(id, chapters);
    },
    [mangaRepo, chapterRepo]
  );
}
