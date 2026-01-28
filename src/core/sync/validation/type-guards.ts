import type {
  MangaDocument,
  ChapterDocument,
  HistoryDocument,
  CategoryDocument,
  SettingsDocument,
  SyncMetadata,
} from "../types/firestore.types";
import { FirestoreValidator } from "./validators";

/**
 * TypeScript type guards for Firestore documents
 * Use these to narrow types at runtime
 */

/**
 * Check if data is a valid MangaDocument
 */
export function isMangaDocument(data: unknown): data is MangaDocument {
  return FirestoreValidator.validateMangaSafe(data) !== null;
}

/**
 * Check if data is a valid ChapterDocument
 */
export function isChapterDocument(data: unknown): data is ChapterDocument {
  return FirestoreValidator.validateChapterSafe(data) !== null;
}

/**
 * Check if data is a valid HistoryDocument
 */
export function isHistoryDocument(data: unknown): data is HistoryDocument {
  return FirestoreValidator.validateHistorySafe(data) !== null;
}

/**
 * Check if data is a valid CategoryDocument
 */
export function isCategoryDocument(data: unknown): data is CategoryDocument {
  return FirestoreValidator.validateCategorySafe(data) !== null;
}

/**
 * Check if data is a valid SettingsDocument
 */
export function isSettingsDocument(data: unknown): data is SettingsDocument {
  return FirestoreValidator.validateSettingsSafe(data) !== null;
}

/**
 * Check if data is a valid SyncMetadata
 */
export function isSyncMetadata(data: unknown): data is SyncMetadata {
  return FirestoreValidator.validateSyncMetadataSafe(data) !== null;
}

/**
 * Check if document is soft-deleted
 */
export function isDeleted(doc: { _deleted?: boolean }): boolean {
  return doc._deleted === true;
}

/**
 * Check if document needs sync (not synced in last minute)
 */
export function needsSync(doc: { _synced?: number }, thresholdMs: number = 60000): boolean {
  if (!doc._synced) return true;
  return Date.now() - doc._synced > thresholdMs;
}

/**
 * Type guard for Firestore document union type
 */
export function isFirestoreDocument(
  data: unknown
): data is MangaDocument | ChapterDocument | HistoryDocument | CategoryDocument | SettingsDocument {
  return (
    isMangaDocument(data) ||
    isChapterDocument(data) ||
    isHistoryDocument(data) ||
    isCategoryDocument(data) ||
    isSettingsDocument(data)
  );
}

/**
 * Discriminant union type guard
 */
export function getDocumentType(data: unknown): "manga" | "chapter" | "history" | "category" | "settings" | null {
  if (isMangaDocument(data)) return "manga";
  if (isChapterDocument(data)) return "chapter";
  if (isHistoryDocument(data)) return "history";
  if (isCategoryDocument(data)) return "category";
  if (isSettingsDocument(data)) return "settings";
  return null;
}

/**
 * Check if data has required Firestore base fields
 */
export function hasBaseFields(data: unknown): data is { _id: string; _modified: number } {
  return (
    typeof data === "object" &&
    data !== null &&
    "_id" in data &&
    typeof (data as { _id: unknown })._id === "string" &&
    "_modified" in data &&
    typeof (data as { _modified: unknown })._modified === "number"
  );
}
