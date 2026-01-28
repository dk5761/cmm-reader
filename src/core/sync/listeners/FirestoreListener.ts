/**
 * Firestore Listener
 *
 * Real-time listeners for Firestore collections.
 * Listens for changes from the server and applies them to the local Realm database.
 * Features:
 * - Real-time sync using Firestore onSnapshot
 * - Conflict resolution with last-write-wins strategy
 * - Automatic merging of server changes with local data
 * - Subscription management for cleanup
 */

import { onSnapshot, query, where, orderBy, documentId } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import type Realm from "realm";
import type { Results } from "realm";
import type { MangaSchema, CategorySchema } from "@/core/database";
import type { MangaDocument, ChapterDocument, CategoryDocument } from "../types/firestore.types";
import { FirestoreCollections } from "../types/firestore.types";
import { isDeleted } from "../validation/type-guards";
import { firestoreToRealmManga, firestoreToRealmCategory } from "../types/realm.types";
import { FirestoreValidator } from "../validation/validators";
import { getSyncConfig, SyncLogger } from "../config/sync.config";

/**
 * Listener state
 */
interface ListenerState {
  unsubscribe: () => void;
  active: boolean;
}

/**
 * Firestore Listener class
 * Manages real-time sync from Firestore to Realm
 */
export class FirestoreListener {
  private subscriptions: Map<string, ListenerState> = new Map();
  private logger: SyncLogger;
  private config = getSyncConfig();

  constructor(
    private firestore: Firestore,
    private realm: Realm,
    private userId: string
  ) {
    this.logger = new SyncLogger(this.config);
  }

  /**
   * Start listening to all collections
   */
  start(): void {
    this.logger.info("Starting Firestore listeners...");
    this.listenManga();
    this.listenCategories();
    this.logger.info("Firestore listeners started");
  }

  /**
   * Stop all listeners
   */
  stop(): void {
    this.logger.info("Stopping Firestore listeners...");

    for (const [name, state] of this.subscriptions.entries()) {
      if (state.active) {
        state.unsubscribe();
        this.logger.debug(`Stopped ${name} listener`);
      }
    }

    this.subscriptions.clear();
    this.logger.info("Firestore listeners stopped");
  }

  /**
   * Listen for manga changes
   */
  private listenManga(): void {
    const mangaRef = query(
      collection(this.firestore, `users/${this.userId}/${FirestoreCollections.MANGA}`),
      where("_deleted", "==", false),
      orderBy("_modified", "desc")
    );

    const unsubscribe = onSnapshot(
      mangaRef,
      (snapshot) => {
        this.logger.debug(`[MangaListener] Received ${snapshot.docChanges().length} changes`);

        this.realm.write(() => {
          for (const change of snapshot.docChanges()) {
            const doc = change.doc.data();

            switch (change.type) {
              case "added":
              case "modified":
                this.handleMangaUpsert(doc, change.type);
                break;

              case "removed":
                this.handleMangaDelete(doc);
                break;
            }
          }
        });
      },
      (error) => {
        this.logger.error("[MangaListener] Error:", error);
      }
    );

    this.subscriptions.set("manga", { unsubscribe, active: true });
    this.logger.debug("[MangaListener] Listening for manga changes");
  }

  /**
   * Handle manga upsert (add or update)
   */
  private handleMangaUpsert(doc: unknown, changeType: string): void {
    // Validate document
    const mangaDoc = FirestoreValidator.validateMangaSafe(doc);
    if (!mangaDoc) {
      this.logger.warn("[MangaListener] Invalid manga document:", doc);
      return;
    }

    // Check if already soft-deleted
    if (isDeleted(mangaDoc)) {
      this.handleMangaDelete(mangaDoc);
      return;
    }

    // Get existing manga
    const existing = this.realm.objectForPrimaryKey<MangaSchema>("MangaSchema", mangaDoc._id);

    if (existing) {
      // Conflict resolution: use latest _modified timestamp
      const localModified = existing.lastUpdated || 0;
      const serverModified = mangaDoc._modified;

      if (serverModified > localModified) {
        // Server is newer, apply update
        this.logger.debug(`[MangaListener] Updating ${mangaDoc._id} (server newer)`);
        this.applyMangaUpdate(existing, mangaDoc);
      } else {
        this.logger.debug(`[MangaListener] Skipping ${mangaDoc._id} (local newer)`);
      }
    } else {
      // Create new manga
      this.logger.debug(`[MangaListener] Creating ${mangaDoc._id}`);
      this.realm.create("MangaSchema", this.createMangaFromFirestore(mangaDoc));
    }
  }

  /**
   * Apply manga update to existing object
   */
  private applyMangaUpdate(existing: MangaSchema, doc: MangaDocument): void {
    const updateData = firestoreToRealmManga(doc);

    // Update each field manually to avoid Realm List issues
    for (const [key, value] of Object.entries(updateData)) {
      if (key === "genres") {
        // Handle Realm.List separately
        (existing as any)[key] = value;
      } else if (value !== undefined && key in existing) {
        (existing as any)[key] = value;
      }
    }
  }

  /**
   * Create Realm manga from Firestore document
   */
  private createMangaFromFirestore(doc: MangaDocument): Partial<MangaSchema> {
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
      genres: doc.genres as any, // Realm.List will be created
      status: doc.status as any,
      readingStatus: doc.readingStatus as any,
      inLibrary: true,
      addedAt: doc.addedAt,
      lastUpdated: doc.lastUpdated,
      categories: [] as any, // Empty Realm.List
    };
  }

  /**
   * Handle manga delete
   */
  private handleMangaDelete(doc: unknown): void {
    const mangaDoc = FirestoreValidator.validateMangaSafe(doc);
    if (!mangaDoc) {
      return;
    }

    const existing = this.realm.objectForPrimaryKey<MangaSchema>("MangaSchema", mangaDoc._id);

    if (existing) {
      this.logger.debug(`[MangaListener] Deleting ${mangaDoc._id}`);
      this.realm.delete(existing);
    }
  }

  /**
   * Listen for category changes
   */
  private listenCategories(): void {
    const categoriesRef = query(
      collection(this.firestore, `users/${this.userId}/${FirestoreCollections.CATEGORIES}`),
      where("_deleted", "==", false),
      orderBy("order", "asc")
    );

    const unsubscribe = onSnapshot(
      categoriesRef,
      (snapshot) => {
        this.logger.debug(`[CategoryListener] Received ${snapshot.docChanges().length} changes`);

        this.realm.write(() => {
          for (const change of snapshot.docChanges()) {
            const doc = change.doc.data();

            switch (change.type) {
              case "added":
              case "modified":
                this.handleCategoryUpsert(doc);
                break;

              case "removed":
                this.handleCategoryDelete(doc);
                break;
            }
          }
        });
      },
      (error) => {
        this.logger.error("[CategoryListener] Error:", error);
      }
    );

    this.subscriptions.set("categories", { unsubscribe, active: true });
    this.logger.debug("[CategoryListener] Listening for category changes");
  }

  /**
   * Handle category upsert
   */
  private handleCategoryUpsert(doc: unknown): void {
    const categoryDoc = FirestoreValidator.validateCategorySafe(doc);
    if (!categoryDoc) {
      this.logger.warn("[CategoryListener] Invalid category document:", doc);
      return;
    }

    if (isDeleted(categoryDoc)) {
      this.handleCategoryDelete(categoryDoc);
      return;
    }

    const existing = this.realm.objectForPrimaryKey<CategorySchema>("CategorySchema", categoryDoc._id);

    if (existing) {
      // Update existing
      this.logger.debug(`[CategoryListener] Updating category ${categoryDoc._id}`);
      this.applyCategoryUpdate(existing, categoryDoc);
    } else {
      // Create new
      this.logger.debug(`[CategoryListener] Creating category ${categoryDoc._id}`);
      this.realm.create("CategorySchema", this.createCategoryFromFirestore(categoryDoc));
    }
  }

  /**
   * Apply category update
   */
  private applyCategoryUpdate(existing: CategorySchema, doc: CategoryDocument): void {
    const updateData = firestoreToRealmCategory(doc);

    for (const [key, value] of Object.entries(updateData)) {
      if (key === "mangaIds") {
        // Handle Realm.List separately
        (existing as any)[key] = value;
      } else if (value !== undefined && key in existing) {
        (existing as any)[key] = value;
      }
    }
  }

  /**
   * Create Realm category from Firestore document
   */
  private createCategoryFromFirestore(doc: CategoryDocument): Partial<CategorySchema> {
    return {
      id: doc._id,
      name: doc.name,
      order: doc.order,
      mangaIds: doc.mangaIds as any, // Realm.List will be created
    };
  }

  /**
   * Handle category delete
   */
  private handleCategoryDelete(doc: unknown): void {
    const categoryDoc = FirestoreValidator.validateCategorySafe(doc);
    if (!categoryDoc) {
      return;
    }

    const existing = this.realm.objectForPrimaryKey<CategorySchema>("CategorySchema", categoryDoc._id);

    if (existing) {
      this.logger.debug(`[CategoryListener] Deleting category ${categoryDoc._id}`);
      this.realm.delete(existing);
    }
  }

  /**
   * Check if listener is active
   */
  isActive(): boolean {
    return this.subscriptions.size > 0;
  }

  /**
   * Get count of active listeners
   */
  getActiveListenerCount(): number {
    let count = 0;
    for (const state of this.subscriptions.values()) {
      if (state.active) count++;
    }
    return count;
  }
}

/**
 * Helper function to get collection reference
 */
import { collection as getCollection } from "firebase/firestore";

function collection(firestore: Firestore, path: string) {
  return getCollection(firestore, path);
}

/**
 * Default FirestoreListener instance
 */
let defaultListener: FirestoreListener | null = null;

export function getFirestoreListener(
  firestore: Firestore,
  realm: Realm,
  userId: string
): FirestoreListener {
  if (!defaultListener) {
    defaultListener = new FirestoreListener(firestore, realm, userId);
  }
  return defaultListener;
}

export function destroyFirestoreListener(): void {
  if (defaultListener) {
    defaultListener.stop();
    defaultListener = null;
  }
}
