/**
 * Mock Realm schema for testing
 * This replaces the real schema.ts which extends Realm.Object
 */

// Mock Realm types
type MockObjectSchema = {
  name: string;
  primaryKey?: string;
  embedded?: boolean;
  properties: Record<string, string | { type: string; default?: any }>;
};

class MockRealmObject {
  static schema: MockObjectSchema = { name: "Mock", properties: {} };
}

export class ChapterSchema extends MockRealmObject {
  static schema: MockObjectSchema = {
    name: "Chapter",
    embedded: true,
    properties: {
      id: "string",
      number: "double",
      title: "string?",
      url: "string",
      date: "string?",
      isRead: { type: "bool", default: false },
      lastPageRead: { type: "int", default: 0 },
      totalPages: "int?",
      downloadStatus: { type: "int", default: 0 },
      downloadTotal: { type: "int", default: 0 },
      downloadedCount: { type: "int", default: 0 },
    },
  };
  id!: string;
  number!: number;
  title?: string;
  url!: string;
  date?: string;
  isRead!: boolean;
  lastPageRead!: number;
  totalPages?: number;
  downloadStatus!: number;
  downloadTotal!: number;
  downloadedCount!: number;
}

export class ReadingProgressSchema extends MockRealmObject {
  static schema: MockObjectSchema = {
    name: "ReadingProgress",
    embedded: true,
    properties: {
      lastChapterId: "string?",
      lastChapterNumber: "double?",
      lastPage: { type: "int", default: 0 },
      timestamp: "int",
    },
  };
  lastChapterId?: string;
  lastChapterNumber?: number;
  lastPage!: number;
  timestamp!: number;
}

export class MangaSchema extends MockRealmObject {
  static schema: MockObjectSchema = {
    name: "Manga",
    primaryKey: "id",
    properties: {
      id: "string",
      sourceId: "string",
      inLibrary: { type: "bool", default: false },
      title: "string",
      cover: "string?",
      localCover: "string?",
      url: "string",
      author: "string?",
      artist: "string?",
      status: "string?",
      description: "string?",
      genres: "string[]",
      chapters: "Chapter[]",
      progress: "ReadingProgress?",
      readingStatus: "string?",
      categories: "string[]",
      addedAt: "int",
      lastUpdated: "int?",
    },
  };
  id!: string;
  sourceId!: string;
  inLibrary!: boolean;
  title!: string;
  cover?: string;
  localCover?: string;
  url!: string;
  author?: string;
  artist?: string;
  status?: string;
  description?: string;
  genres!: string[];
  chapters!: any[];
  progress?: any;
  readingStatus?: string;
  categories!: string[];
  addedAt!: number;
  lastUpdated?: number;
}

export class ReadingHistorySchema extends MockRealmObject {
  static schema: MockObjectSchema = {
    name: "ReadingHistory",
    primaryKey: "id",
    properties: {
      id: "string",
      mangaId: "string",
      mangaTitle: "string",
      mangaCover: "string?",
      mangaUrl: "string?",
      chapterId: "string",
      chapterNumber: "double",
      chapterTitle: "string?",
      chapterUrl: "string",
      pageReached: "int",
      totalPages: "int?",
      timestamp: "int",
      sourceId: "string",
    },
  };
  id!: string;
  mangaId!: string;
  mangaTitle!: string;
  mangaCover?: string;
  mangaUrl?: string;
  chapterId!: string;
  chapterNumber!: number;
  chapterTitle?: string;
  chapterUrl!: string;
  pageReached!: number;
  totalPages?: number;
  timestamp!: number;
  sourceId!: string;
}

export class CategorySchema extends MockRealmObject {
  static schema: MockObjectSchema = {
    name: "Category",
    primaryKey: "id",
    properties: {
      id: "string",
      name: "string",
      order: "int",
      mangaIds: "string[]",
    },
  };
  id!: string;
  name!: string;
  order!: number;
  mangaIds!: string[];
}

export const realmSchemas = [
  MangaSchema,
  ChapterSchema,
  ReadingProgressSchema,
  ReadingHistorySchema,
  CategorySchema,
];

export type ReadingStatus =
  | "reading"
  | "completed"
  | "on_hold"
  | "dropped"
  | "plan_to_read";
