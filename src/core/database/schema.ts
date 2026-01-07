import Realm, { ObjectSchema } from "realm";

/**
 * Embedded Chapter - lives inside Manga document
 * No primary key needed for embedded objects
 */
export class ChapterSchema extends Realm.Object<ChapterSchema> {
  id!: string;
  number!: number;
  title?: string;
  url!: string;
  date?: string;
  isRead!: boolean;
  lastPageRead!: number;
  totalPages?: number;
  
  // Download tracking
  downloadStatus!: number; // 0=None, 1=Queued, 2=Downloading, 3=Downloaded, 4=Error
  downloadTotal!: number; // Total pages expected
  downloadedCount!: number; // Pages successfully saved

  static schema: ObjectSchema = {
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
}

/**
 * Embedded ReadingProgress - lives inside Manga document
 */
export class ReadingProgressSchema extends Realm.Object<ReadingProgressSchema> {
  lastChapterId?: string;
  lastChapterNumber?: number;
  lastPage!: number;
  timestamp!: number;

  static schema: ObjectSchema = {
    name: "ReadingProgress",
    embedded: true,
    properties: {
      lastChapterId: "string?",
      lastChapterNumber: "double?",
      lastPage: { type: "int", default: 0 },
      timestamp: "int",
    },
  };
}

/**
 * Main Manga document - contains all data needed for library access
 * No joins required - chapters and progress are embedded
 */
export class MangaSchema extends Realm.Object<MangaSchema> {
  id!: string; // Format: sourceId_mangaId
  sourceId!: string;
  inLibrary!: boolean; // true = in library, false = tracking only
  title!: string;
  cover?: string;
  localCover?: string;
  url!: string;
  author?: string;
  artist?: string;
  status?: string;
  description?: string;
  genres!: Realm.List<string>;
  chapters!: Realm.List<ChapterSchema>;
  progress?: ReadingProgressSchema;
  readingStatus?: string; // reading, completed, on_hold, dropped, plan_to_read
  addedAt!: number;
  lastUpdated?: number;
  categories!: Realm.List<string>;

  static primaryKey = "id";
  static schema: ObjectSchema = {
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
}

/**
 * Reading History - standalone collection for tracking reading sessions
 * Not embedded, has its own primary key
 */
export class ReadingHistorySchema extends Realm.Object<ReadingHistorySchema> {
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

  static primaryKey = "id";
  static schema: ObjectSchema = {
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
}

/**
 * Category - User defined collections for organizing library
 */
export class CategorySchema extends Realm.Object<CategorySchema> {
  id!: string;
  name!: string;
  order!: number;
  mangaIds!: Realm.List<string>; // List of Manga IDs in this category

  static primaryKey = "id";
  static schema: ObjectSchema = {
    name: "Category",
    primaryKey: "id",
    properties: {
      id: "string",
      name: "string",
      order: "int",
      mangaIds: "string[]",
    },
  };
}

// Export all schemas for RealmProvider
export const realmSchemas = [
  MangaSchema,
  ChapterSchema,
  ReadingProgressSchema,
  ReadingHistorySchema,
  CategorySchema,
];

// Types for use in the app
export type ReadingStatus =
  | "reading"
  | "completed"
  | "on_hold"
  | "dropped"
  | "plan_to_read";
