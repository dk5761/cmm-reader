import type { MangaDetails, Chapter } from "@/sources";
import type { MangaSchema, ChapterSchema, ReadingHistorySchema, CategorySchema } from "../schema";

export interface IMangaRepository {
  getManga(id: string): MangaSchema | null;
  getAllManga(): MangaSchema[];
  getLibraryManga(): MangaSchema[];
  addManga(manga: MangaDetails, inLibrary?: boolean): Promise<void>;
  updateManga(id: string, updates: Partial<MangaSchema>): Promise<void>;
  removeFromLibrary(id: string): Promise<void>;
  isInLibrary(id: string): boolean;
  search(query: string): MangaSchema[];
}

export interface IChapterRepository {
  getChapters(mangaId: string): ChapterSchema[];
  getChapter(chapterId: string): ChapterSchema | null;
  saveChapters(mangaId: string, chapters: Chapter[]): Promise<void>;
  markAsRead(chapterId: string, isRead: boolean): Promise<void>;
  markPreviousAsRead(mangaId: string, chapterNumber: number): Promise<void>;
  markPreviousAsUnread(mangaId: string, chapterNumber: number): Promise<void>;
  saveProgress(mangaId: string, chapterId: string, chapterNumber: number, page: number): Promise<void>;
  updateProgress(chapterId: string, page: number, totalPages?: number): Promise<void>;
  getNextChapter(currentChapterId: string): ChapterSchema | null;
  getPrevChapter(currentChapterId: string): ChapterSchema | null;
}

export interface IHistoryRepository {
  getHistory(): ReadingHistorySchema[];
  addToHistory(entry: Omit<ReadingHistorySchema, "id">): Promise<void>;
  removeFromHistory(historyId: string): Promise<void>;
  removeMangaHistory(sourceId: string, mangaId: string): Promise<void>;
  clearHistory(): Promise<void>;
  getLastRead(mangaId: string): ReadingHistorySchema | null;
}

export interface ICategoryRepository {
  getCategories(): CategorySchema[];
  createCategory(name: string): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  addMangaToCategory(categoryId: string, mangaId: string): Promise<void>;
  removeMangaFromCategory(categoryId: string, mangaId: string): Promise<void>;
  reorderCategories(categoryIds: string[]): Promise<void>;
}
