import Realm from "realm";
import type { IChapterRepository } from "./types";
import { MangaSchema, ChapterSchema } from "../schema";
import type { Chapter } from "@/sources";

export class RealmChapterRepository implements IChapterRepository {
  constructor(private realm: Realm) {}

  getChapters(mangaId: string): ChapterSchema[] {
    const manga = this.realm.objectForPrimaryKey(MangaSchema, mangaId);
    return manga ? Array.from(manga.chapters) : [];
  }

  getChapter(chapterId: string): ChapterSchema | null {
    // Chapters are embedded, so we can't query them directly by ID easily
    // But since they are embedded in Manga, and we usually have context
    // This is tricky with Realm embedded objects if we don't know the parent
    // However, we can query the parent that contains this chapter
    const manga = this.realm.objects(MangaSchema).filtered("chapters.id == $0", chapterId)[0];
    return manga?.chapters.find(c => c.id === chapterId) ?? null;
  }

  async saveChapters(mangaId: string, chapters: Chapter[]): Promise<void> {
    const manga = this.realm.objectForPrimaryKey(MangaSchema, mangaId);
    if (!manga) return;

    // Check if update is needed to avoid infinite loops
    // Compare counts first
    if (manga.chapters.length === chapters.length) {
      // Deep compare critical fields
      const hasChanges = chapters.some((newCh, index) => {
        const oldCh = manga.chapters[index];
        return (
          oldCh.id !== newCh.id ||
          oldCh.date !== newCh.date ||
          oldCh.title !== newCh.title || 
          oldCh.url !== newCh.url
        );
      });
      
      if (!hasChanges) {
        return;
      }
    }

    this.realm.write(() => {
      // Map existing chapters to preserve read status
      const existingMap = new Map<string, ChapterSchema>();
      manga.chapters.forEach((c) => existingMap.set(c.id, c));

      // Create new list
      const newChapters = chapters.map((ch) => {
        const existing = existingMap.get(ch.id);
        return {
          id: ch.id,
          number: ch.number,
          title: ch.title,
          url: ch.url,
          date: ch.date,
          // Preserve state
          isRead: existing?.isRead ?? false,
          lastPageRead: existing?.lastPageRead ?? 0,
          totalPages: existing?.totalPages,
        };
      });

      manga.chapters = newChapters as unknown as Realm.List<ChapterSchema>;
      manga.lastUpdated = Date.now();
    });
  }

  async markAsRead(chapterId: string, isRead: boolean): Promise<void> {
    const chapter = this.getChapter(chapterId);
    if (!chapter) return;

    this.realm.write(() => {
      chapter.isRead = isRead;
    });
  }

  async updateProgress(chapterId: string, page: number, totalPages?: number): Promise<void> {
    const chapter = this.getChapter(chapterId);
    if (!chapter) return;

    this.realm.write(() => {
      chapter.lastPageRead = page;
      if (totalPages) chapter.totalPages = totalPages;
    });
  }

  getNextChapter(currentChapterId: string): ChapterSchema | null {
    const manga = this.realm.objects(MangaSchema).filtered("chapters.id == $0", currentChapterId)[0];
    if (!manga) return null;

    const chapters = Array.from(manga.chapters) as ChapterSchema[];
    const idx = chapters.findIndex((c) => c.id === currentChapterId);
    
    // Check if index is valid and not the last one (since 0 is newest)
    if (idx !== -1 && idx > 0) return chapters[idx - 1];
    return null;
  }

  getPrevChapter(currentChapterId: string): ChapterSchema | null {
    const manga = this.realm.objects(MangaSchema).filtered("chapters.id == $0", currentChapterId)[0];
    if (!manga) return null;

    const chapters = Array.from(manga.chapters) as ChapterSchema[];
    const idx = chapters.findIndex((c) => c.id === currentChapterId);
    
    // Check if index is valid and not the last one
    if (idx !== -1 && idx < chapters.length - 1) return chapters[idx + 1];
    return null;
  }
}
