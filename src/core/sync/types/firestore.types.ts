import { z } from "zod";

/**
 * Base document schema with metadata for all Firestore documents
 * Includes fields for sync tracking and conflict resolution
 */
const BaseFirestoreSchema = z.object({
  _id: z.string(),
  _rev: z.number(), // Revision number for conflict resolution
  _created: z.number(), // Creation timestamp (ms since epoch)
  _modified: z.number(), // Last modified timestamp (ms since epoch)
  _deleted: z.boolean().optional(), // Soft delete flag
  _synced: z.number(), // Last sync timestamp (ms since epoch)
});

/**
 * Manga document schema
 * Represents a manga entry in the user's library
 */
export const MangaDocumentSchema = BaseFirestoreSchema.extend({
  title: z.string(),
  url: z.string(),
  sourceId: z.string(),
  cover: z.string().nullable(),
  localCover: z.string().nullable(),
  author: z.string().nullable(),
  artist: z.string().nullable(),
  description: z.string().nullable(),
  genres: z.array(z.string()),
  status: z.enum(["ongoing", "completed", "cancelled", "unknown"]),
  readingStatus: z.enum(["reading", "completed", "plan_to_read", "on_hold", "dropped"]),
  addedAt: z.number(),
  lastUpdated: z.number(),
});

/**
 * Chapter document schema
 * Represents chapter reading progress
 */
export const ChapterDocumentSchema = z.object({
  id: z.string(),
  mangaId: z.string(),
  number: z.number(),
  title: z.string().nullable(),
  url: z.string(),
  date: z.string().nullable(),
  isRead: z.boolean(),
  lastPageRead: z.number(),
  totalPages: z.number(),
  _modified: z.number(),
});

/**
 * History document schema
 * Tracks reading history per manga
 */
export const HistoryDocumentSchema = BaseFirestoreSchema.extend({
  mangaId: z.string(),
  lastReadTimestamp: z.number(),
  totalReadTime: z.number(), // milliseconds
  readChapters: z.array(z.string()), // chapter IDs
  lastChapterId: z.string().nullable(),
});

/**
 * Category document schema
 * User-defined categories for organizing manga
 */
export const CategoryDocumentSchema = BaseFirestoreSchema.extend({
  name: z.string(),
  order: z.number(),
  mangaIds: z.array(z.string()), // Associated manga IDs
});

/**
 * Settings document schema
 * User app settings
 */
export const SettingsDocumentSchema = z.object({
  userId: z.string(),
  nsfwSourcesEnabled: z.boolean(),
  theme: z.enum(["system", "light", "dark"]),
  lastModified: z.number(),
});

/**
 * Sync metadata document
 * Tracks sync state for the user
 */
export const SyncMetadataSchema = z.object({
  userId: z.string(),
  lastSyncTime: z.number(),
  lastFullSync: z.number(),
  pendingEvents: z.number(),
  syncVersion: z.number(),
});

/**
 * Type exports
 */
export type MangaDocument = z.infer<typeof MangaDocumentSchema>;
export type ChapterDocument = z.infer<typeof ChapterDocumentSchema>;
export type HistoryDocument = z.infer<typeof HistoryDocumentSchema>;
export type CategoryDocument = z.infer<typeof CategoryDocumentSchema>;
export type SettingsDocument = z.infer<typeof SettingsDocumentSchema>;
export type SyncMetadata = z.infer<typeof SyncMetadataSchema>;

/**
 * Document union type for type guards
 */
export type FirestoreDocument =
  | MangaDocument
  | ChapterDocument
  | HistoryDocument
  | CategoryDocument
  | SettingsDocument
  | SyncMetadata;

/**
 * Collection names in Firestore
 */
export const FirestoreCollections = {
  MANGA: "manga",
  CHAPTERS: "chapters",
  HISTORY: "history",
  CATEGORIES: "categories",
  SETTINGS: "settings",
  SYNC_METADATA: "sync_metadata",
} as const;

export type FirestoreCollection = (typeof FirestoreCollections)[keyof typeof FirestoreCollections];
