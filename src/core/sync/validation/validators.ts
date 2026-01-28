import {
  MangaDocumentSchema,
  ChapterDocumentSchema,
  HistoryDocumentSchema,
  CategoryDocumentSchema,
  SettingsDocumentSchema,
  SyncMetadataSchema,
} from "../types/firestore.types";
import type {
  MangaDocument,
  ChapterDocument,
  HistoryDocument,
  CategoryDocument,
  SettingsDocument,
  SyncMetadata,
} from "../types/firestore.types";

/**
 * Firestore document validators using Zod
 * Provides runtime validation for all Firestore documents
 */
export class FirestoreValidator {
  /**
   * Validate manga document from Firestore
   * @throws {ZodError} if validation fails
   */
  static validateManga(data: unknown): MangaDocument {
    return MangaDocumentSchema.parse(data);
  }

  /**
   * Validate manga document safely (doesn't throw)
   * @returns Valid data or null if validation fails
   */
  static validateMangaSafe(data: unknown): MangaDocument | null {
    const result = MangaDocumentSchema.safeParse(data);
    if (result.success) {
      return result.data;
    }
    console.warn("[FirestoreValidator] Invalid manga document:", result.error);
    return null;
  }

  /**
   * Validate chapter document from Firestore
   * @throws {ZodError} if validation fails
   */
  static validateChapter(data: unknown): ChapterDocument {
    return ChapterDocumentSchema.parse(data);
  }

  /**
   * Validate chapter document safely
   */
  static validateChapterSafe(data: unknown): ChapterDocument | null {
    const result = ChapterDocumentSchema.safeParse(data);
    if (result.success) {
      return result.data;
    }
    console.warn("[FirestoreValidator] Invalid chapter document:", result.error);
    return null;
  }

  /**
   * Validate history document from Firestore
   * @throws {ZodError} if validation fails
   */
  static validateHistory(data: unknown): HistoryDocument {
    return HistoryDocumentSchema.parse(data);
  }

  /**
   * Validate history document safely
   */
  static validateHistorySafe(data: unknown): HistoryDocument | null {
    const result = HistoryDocumentSchema.safeParse(data);
    if (result.success) {
      return result.data;
    }
    console.warn("[FirestoreValidator] Invalid history document:", result.error);
    return null;
  }

  /**
   * Validate category document from Firestore
   * @throws {ZodError} if validation fails
   */
  static validateCategory(data: unknown): CategoryDocument {
    return CategoryDocumentSchema.parse(data);
  }

  /**
   * Validate category document safely
   */
  static validateCategorySafe(data: unknown): CategoryDocument | null {
    const result = CategoryDocumentSchema.safeParse(data);
    if (result.success) {
      return result.data;
    }
    console.warn("[FirestoreValidator] Invalid category document:", result.error);
    return null;
  }

  /**
   * Validate settings document from Firestore
   * @throws {ZodError} if validation fails
   */
  static validateSettings(data: unknown): SettingsDocument {
    return SettingsDocumentSchema.parse(data);
  }

  /**
   * Validate settings document safely
   */
  static validateSettingsSafe(data: unknown): SettingsDocument | null {
    const result = SettingsDocumentSchema.safeParse(data);
    if (result.success) {
      return result.data;
    }
    console.warn("[FirestoreValidator] Invalid settings document:", result.error);
    return null;
  }

  /**
   * Validate sync metadata document
   * @throws {ZodError} if validation fails
   */
  static validateSyncMetadata(data: unknown): SyncMetadata {
    return SyncMetadataSchema.parse(data);
  }

  /**
   * Validate sync metadata document safely
   */
  static validateSyncMetadataSafe(data: unknown): SyncMetadata | null {
    const result = SyncMetadataSchema.safeParse(data);
    if (result.success) {
      return result.data;
    }
    console.warn("[FirestoreValidator] Invalid sync metadata document:", result.error);
    return null;
  }

  /**
   * Bulk validate manga documents
   * @returns Array of valid documents (invalid ones are filtered out)
   */
  static validateMangaBatch(dataArray: unknown[]): MangaDocument[] {
    const valid: MangaDocument[] = [];
    const invalid: number[] = [];

    dataArray.forEach((data, index) => {
      const result = MangaDocumentSchema.safeParse(data);
      if (result.success) {
        valid.push(result.data);
      } else {
        invalid.push(index);
        console.warn(`[FirestoreValidator] Invalid manga at index ${index}:`, result.error);
      }
    });

    if (invalid.length > 0) {
      console.warn(`[FirestoreValidator] Filtered out ${invalid.length} invalid manga documents`);
    }

    return valid;
  }

  /**
   * Bulk validate chapter documents
   */
  static validateChapterBatch(dataArray: unknown[]): ChapterDocument[] {
    const valid: ChapterDocument[] = [];

    for (const data of dataArray) {
      const result = ChapterDocumentSchema.safeParse(data);
      if (result.success) {
        valid.push(result.data);
      }
    }

    return valid;
  }

  /**
   * Validate document based on collection name
   */
  static validateByCollection(
    collection: string,
    data: unknown
  ): MangaDocument | ChapterDocument | HistoryDocument | CategoryDocument | SettingsDocument | null {
    switch (collection) {
      case "manga":
        return this.validateMangaSafe(data);
      case "chapters":
        return this.validateChapterSafe(data);
      case "history":
        return this.validateHistorySafe(data);
      case "categories":
        return this.validateCategorySafe(data);
      case "settings":
        return this.validateSettingsSafe(data);
      default:
        console.warn(`[FirestoreValidator] Unknown collection: ${collection}`);
        return null;
    }
  }
}
