import type { MangaSchema, CategorySchema } from "@/core/database";
import type { MangaDocument, CategoryDocument } from "./firestore.types";

/**
 * Conversion utilities between Realm and Firestore formats
 */

/**
 * Convert Realm manga to Firestore manga document
 */
export function realmToFirestoreManga(manga: MangaSchema): MangaDocument {
  return {
    _id: manga.id,
    _rev: 1,
    _created: manga.addedAt || Date.now(),
    _modified: Date.now(),
    _deleted: false,
    _synced: Date.now(),
    title: manga.title,
    url: manga.url,
    sourceId: manga.sourceId,
    cover: manga.cover ?? null,
    localCover: manga.localCover ?? null,
    author: manga.author ?? null,
    artist: manga.artist ?? null,
    description: manga.description ?? null,
    genres: Array.from(manga.genres || []),
    status: (manga.status as any) ?? "unknown",
    readingStatus: (manga.readingStatus as any) ?? "plan_to_read",
    addedAt: manga.addedAt ?? Date.now(),
    lastUpdated: manga.lastUpdated ?? Date.now(),
  };
}

/**
 * Convert Firestore manga document to Realm manga
 */
export function firestoreToRealmManga(doc: MangaDocument): Partial<MangaSchema> {
  return {
    id: doc._id,
    title: doc.title,
    url: doc.url,
    sourceId: doc.sourceId,
    cover: doc.cover ?? undefined,
    localCover: doc.localCover ?? undefined,
    author: doc.author ?? undefined,
    artist: doc.artist ?? undefined,
    description: doc.description ?? undefined,
    genres: doc.genres as any, // Realm.List will be created during write
    status: doc.status as any,
    readingStatus: doc.readingStatus as any,
    addedAt: doc.addedAt,
    lastUpdated: doc.lastUpdated,
  };
}

/**
 * Convert Realm category to Firestore category document
 */
export function realmToFirestoreCategory(category: CategorySchema): CategoryDocument {
  return {
    _id: category.id,
    _rev: 1,
    _created: Date.now(),
    _modified: Date.now(),
    _deleted: false,
    _synced: Date.now(),
    name: category.name,
    order: category.order,
    mangaIds: Array.from(category.mangaIds || []),
  };
}

/**
 * Convert Firestore category document to Realm category
 */
export function firestoreToRealmCategory(doc: CategoryDocument): Partial<CategorySchema> {
  return {
    id: doc._id,
    name: doc.name,
    order: doc.order,
    mangaIds: doc.mangaIds as any, // Realm.List will be created during write
  };
}

/**
 * Merge partial update into existing Realm object
 * Used when receiving updates from Firestore
 */
export function mergeFirestoreUpdate<T extends Record<string, unknown>>(
  existing: T,
  update: Partial<T>
): T {
  return {
    ...existing,
    ...update,
  };
}

/**
 * Extract changed fields from two Realm objects
 * Returns only the fields that differ
 */
export function extractChanges<T extends Record<string, unknown>>(
  original: T,
  updated: T
): Partial<T> {
  const changes: Partial<T> = {};

  for (const key in updated) {
    if (updated[key] !== original[key]) {
      changes[key] = updated[key];
    }
  }

  return changes;
}
