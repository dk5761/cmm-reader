/**
 * Realm Listener
 *
 * Listens for changes in the Realm database and creates sync events.
 * Features:
 * - Automatic change detection for manga and categories
 * - Debouncing to prevent excessive events
 * - Event creation with proper priority
 * - Integration with EventQueue
 *
 * Note: Chapters are embedded objects within Manga, so chapter changes
 * will be captured as manga updates.
 */

import type Realm from "realm";
import type { MangaSchema, CategorySchema } from "@/core/database";
import { SyncEventType, SyncEventPriority, type SyncEvent } from "../types/events.types";
import { createSyncEvent, SyncEntityType } from "../types/events.types";
import type { EventQueue } from "../queue/EventQueue";
import { getEventPriority, SyncLogger } from "../config/sync.config";
import { EventEmitter } from "../utils/EventEmitter";

/**
 * Configuration for RealmListener
 */
export interface RealmListenerConfig {
  debounceMs: number;
  enableLogging: boolean;
}

/**
 * Realm Listener class
 * Captures changes from Realm and creates sync events
 */
export class RealmListener extends EventEmitter {
  private unsubscribes: Map<string, unknown> = new Map();
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private pendingChanges: Map<string, () => SyncEvent> = new Map();
  private logger: SyncLogger;

  constructor(
    private realm: Realm,
    private eventQueue: EventQueue,
    private userId: string,
    config?: Partial<RealmListenerConfig>
  ) {
    super();

    const defaultConfig: RealmListenerConfig = {
      debounceMs: 1000,
      enableLogging: true,
    };

    const finalConfig = { ...defaultConfig, ...config };
    this.logger = new SyncLogger({
      enableLogging: finalConfig.enableLogging,
      logLevel: "info",
      maxRetries: 3,
      retryDelays: [],
      batchSize: 50,
      flushInterval: 5000,
      flushThreshold: 50,
      maxQueueSize: 1000,
      persistToDisk: true,
      queueStorageKey: "",
      syncOnAppForeground: true,
      syncOnAppStart: true,
      syncOnNetworkChange: true,
      debounceMs: finalConfig.debounceMs,
      chapterProgressDebounceMs: 2000,
      enableRealtimeSync: true,
      realtimeSyncThrottleMs: 500,
      conflictResolution: "last_write_wins",
    });
  }

  /**
   * Start listening to all Realm collections
   */
  start(): void {
    this.logger.info("Starting Realm listeners...");
    this.listenManga();
    this.listenCategories();
    this.logger.info("Realm listeners started");
  }

  /**
   * Stop all listeners
   */
  stop(): void {
    this.logger.info("Stopping Realm listeners...");

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Unsubscribe from all Realm listeners
    for (const unsubscribe of this.unsubscribes.values()) {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    }
    this.unsubscribes.clear();

    this.logger.info("Realm listeners stopped");
  }

  /**
   * Listen for manga changes
   * Note: Chapters are embedded objects, so their changes will trigger manga modifications
   */
  private listenManga(): void {
    const manga = this.realm.objects<MangaSchema>("MangaSchema");

    const unsubscribe = manga.addListener((collection, changes) => {
      // Process insertions
      for (const index of changes.insertions) {
        const item = collection[index];
        this.scheduleEvent("manga", item.id, () =>
          this.createMangaEvent(SyncEventType.MANGA_CREATE, item)
        );
      }

      // Process modifications (includes chapter changes since they're embedded)
      for (const index of changes.newModifications) {
        const item = collection[index];
        this.scheduleEvent("manga", item.id, () =>
          this.createMangaEvent(SyncEventType.MANGA_UPDATE, item)
        );
      }

      // Process deletions
      for (const index of changes.deletions) {
        // Note: deleted items are no longer in the collection
        this.scheduleEvent("manga", `deleted_${index}`, () =>
          this.createDeleteEvent(SyncEntityType.MANGA, `deleted_${index}`)
        );
      }
    });

    this.unsubscribes.set("manga", unsubscribe);
    this.logger.debug("Manga listener registered");
  }

  /**
   * Listen for category changes
   */
  private listenCategories(): void {
    const categories = this.realm.objects<CategorySchema>("CategorySchema");

    const unsubscribe = categories.addListener((collection, changes) => {
      // Process insertions
      for (const index of changes.insertions) {
        const category = collection[index];
        this.scheduleEvent("category", category.id, () =>
          this.createCategoryEvent(SyncEventType.CATEGORY_CREATE, category)
        );
      }

      // Process modifications
      for (const index of changes.newModifications) {
        const category = collection[index];
        this.scheduleEvent("category", category.id, () =>
          this.createCategoryEvent(SyncEventType.CATEGORY_UPDATE, category)
        );
      }

      // Process deletions
      for (const index of changes.deletions) {
        this.scheduleEvent("category", `deleted_${index}`, () =>
          this.createDeleteEvent(SyncEntityType.CATEGORY, `deleted_${index}`)
        );
      }
    });

    this.unsubscribes.set("categories", unsubscribe);
    this.logger.debug("Category listener registered");
  }

  /**
   * Schedule an event with debouncing
   */
  private scheduleEvent(
    category: string,
    entityId: string,
    eventFactory: () => SyncEvent
  ): void {
    // Store the pending change
    this.pendingChanges.set(`${category}:${entityId}`, eventFactory);

    // Clear existing timer for this entity
    const existingTimer = this.debounceTimers.get(`${category}:${entityId}`);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Determine debounce time based on category
    const debounceMs = 1000;

    // Schedule new timer
    const timer = setTimeout(async () => {
      const factory = this.pendingChanges.get(`${category}:${entityId}`);
      if (factory) {
        try {
          const event = factory();
          await this.eventQueue.enqueue(event);
          this.logger.debug("Event enqueued", {
            type: event.type,
            entityType: event.entityType,
            entityId: event.entityId,
          });
        } catch (error) {
          this.logger.error("Failed to enqueue event", error);
        }
        this.pendingChanges.delete(`${category}:${entityId}`);
      }
      this.debounceTimers.delete(`${category}:${entityId}`);
    }, debounceMs);

    this.debounceTimers.set(`${category}:${entityId}`, timer);
  }

  /**
   * Create a manga sync event
   */
  private createMangaEvent(type: SyncEventType, manga: MangaSchema): SyncEvent {
    const priority = getEventPriority(type);

    return createSyncEvent(
      type,
      SyncEntityType.MANGA,
      manga.id,
      this.userId,
      {
        _id: manga.id,
        title: manga.title,
        url: manga.url,
        sourceId: manga.sourceId,
        cover: manga.cover ?? null,
        localCover: manga.localCover ?? null,
        author: manga.author ?? null,
        artist: manga.artist ?? null,
        description: manga.description ?? null,
        genres: Array.from(manga.genres || []),
        status: manga.status ?? "unknown",
        readingStatus: manga.readingStatus ?? "plan_to_read",
        addedAt: manga.addedAt ?? Date.now(),
        lastUpdated: manga.lastUpdated ?? Date.now(),
      },
      priority
    );
  }

  /**
   * Create a category sync event
   */
  private createCategoryEvent(type: SyncEventType, category: CategorySchema): SyncEvent {
    const priority = getEventPriority(type);

    return createSyncEvent(
      type,
      SyncEntityType.CATEGORY,
      category.id,
      this.userId,
      {
        _id: category.id,
        name: category.name,
        order: category.order,
        mangaIds: Array.from(category.mangaIds || []),
      },
      priority
    );
  }

  /**
   * Create a delete event
   */
  private createDeleteEvent(entityType: SyncEntityType, entityId: string): SyncEvent {
    return createSyncEvent(
      entityType === SyncEntityType.MANGA
        ? SyncEventType.MANGA_DELETE
        : SyncEventType.CATEGORY_DELETE,
      entityType,
      entityId,
      this.userId,
      { _id: entityId },
      SyncEventPriority.HIGH
    );
  }
}

/**
 * Default RealmListener instance
 */
let defaultListener: RealmListener | null = null;

export function getRealmListener(
  realm: Realm,
  eventQueue: EventQueue,
  userId: string,
  config?: Partial<RealmListenerConfig>
): RealmListener {
  if (!defaultListener) {
    defaultListener = new RealmListener(realm, eventQueue, userId, config);
  }
  return defaultListener;
}

export function destroyRealmListener(): void {
  if (defaultListener) {
    defaultListener.stop();
    defaultListener = null;
  }
}
