/**
 * Sync Service
 *
 * Main orchestrator for syncing events to Firebase Firestore.
 * Features:
 * - Batch processing for optimal Firestore usage
 * - Retry logic with exponential backoff
 * - Network state awareness
 * - Progress tracking
 * - Error handling and reporting
 */

import type { Firestore } from "firebase/firestore";
import type { SyncEvent, SyncResult, SyncError } from "../types/events.types";
import { SyncEntityType, SyncEventType } from "../types/events.types";
import { FIRESTORE_PATHS } from "../config/sync.config";
import type { EventQueue } from "../queue/EventQueue";
import { getSyncConfig, SyncLogger } from "../config/sync.config";
import { chunk, sleep, groupBy } from "../utils/chunk";

/**
 * Sync Service class
 * Processes events from the queue and writes them to Firestore
 */
export class SyncService {
  private isSyncing = false;
  private abortController: AbortController | null = null;
  private logger: SyncLogger;
  private config = getSyncConfig();

  constructor(
    private firestore: Firestore,
    private eventQueue: EventQueue,
    private userId: string
  ) {
    this.logger = new SyncLogger(this.config);
  }

  /**
   * Start the sync service
   * Begins processing events from the queue
   */
  async start(): Promise<void> {
    if (this.isSyncing) {
      this.logger.warn("Sync already in progress");
      return;
    }

    this.isSyncing = true;
    this.abortController = new AbortController();

    this.logger.info("Starting sync service...");

    try {
      while (this.isSyncing && !this.abortController.signal.aborted) {
        // Get a batch of events
        const events = await this.eventQueue.getBatch(this.config.batchSize);

        if (events.length === 0) {
          // No events to process, wait a bit
          await sleep(1000);
          continue;
        }

        this.logger.info("Processing batch", { size: events.length });

        // Process the batch
        const result = await this.processBatch(events);

        // Mark events as processed
        const successIds = events
          .filter((e) => !result.errors.some((err) => err.eventId === e.id))
          .map((e) => e.id);

        await this.eventQueue.markProcessed(successIds);

        // Handle failures
        for (const error of result.errors) {
          if (error.retryable) {
            await this.eventQueue.markFailed(error.eventId, true);
          } else {
            await this.eventQueue.markFailed(error.eventId, false);
          }
        }

        this.logger.info("Batch completed", {
          processed: result.processed,
          failed: result.failed,
        });

        // Small delay between batches
        await sleep(500);
      }
    } catch (error) {
      this.logger.error("Sync service error", error);
    } finally {
      this.isSyncing = false;
      this.logger.info("Sync service stopped");
    }
  }

  /**
   * Stop the sync service
   */
  stop(): void {
    this.logger.info("Stopping sync service...");
    this.isSyncing = false;
    this.abortController?.abort();
  }

  /**
   * Process a batch of events
   */
  private async processBatch(events: SyncEvent[]): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let processed = 0;

    // Group events by entity type for efficient processing
    const grouped = groupBy(events, (e) => e.entityType);

    // Process each entity type
    for (const [entityType, entityEvents] of grouped.entries()) {
      try {
        const result = await this.processEntityType(
          entityType as SyncEntityType,
          entityEvents
        );
        processed += result.processed;
        errors.push(...result.errors);
      } catch (error) {
        this.logger.error(`Failed to process ${entityType}`, error);

        // Mark all events for this entity type as failed
        for (const event of entityEvents) {
          errors.push({
            eventId: event.id,
            entityType: event.entityType,
            entityId: event.entityId,
            error: error instanceof Error ? error.message : "Unknown error",
            retryable: true,
          });
        }
      }
    }

    return {
      success: errors.length === 0,
      processed,
      failed: errors.length,
      errors,
      timestamp: Date.now() - startTime,
    };
  }

  /**
   * Process events for a specific entity type
   */
  private async processEntityType(
    entityType: SyncEntityType,
    events: SyncEvent[]
  ): Promise<SyncResult> {
    // Split into smaller batches (Firestore limit: 500 operations)
    const batches = chunk(events, this.config.batchSize);
    const errors: SyncError[] = [];
    let processed = 0;

    for (const batch of batches) {
      try {
        await this.withRetry(
          () => this.writeBatch(batch, entityType),
          this.config.maxRetries,
          this.config.retryDelays
        );
        processed += batch.length;
      } catch (error) {
        this.logger.error("Batch write failed", error);

        // Mark all events in this batch as failed
        for (const event of batch) {
          errors.push({
            eventId: event.id,
            entityType: event.entityType,
            entityId: event.entityId,
            error: error instanceof Error ? error.message : "Unknown error",
            retryable: true,
          });
        }
      }
    }

    return {
      success: errors.length === 0,
      processed,
      failed: errors.length,
      errors,
      timestamp: Date.now(),
    };
  }

  /**
   * Write a batch of events to Firestore
   */
  private async writeBatch(events: SyncEvent[], entityType: SyncEntityType): Promise<void> {
    const { writeBatch, doc, collection, setDoc, updateDoc, deleteDoc } = await import("firebase/firestore");

    const batch = writeBatch(this.firestore);
    const collectionPath = FIRESTORE_PATHS[
      entityType === "manga"
        ? "MANGA"
        : entityType === "chapter"
        ? "CHAPTERS"
        : entityType === "category"
        ? "CATEGORIES"
        : "SETTINGS"
    ](this.userId);

    const collectionRef = collection(this.firestore, collectionPath);

    for (const event of events) {
      const docRef = doc(collectionRef, event.entityId);

      switch (event.type) {
        case SyncEventType.MANGA_CREATE:
        case SyncEventType.MANGA_UPDATE:
          batch.set(docRef, this.transformMangaData(event.data), { merge: true });
          break;

        case SyncEventType.MANGA_DELETE:
          batch.update(docRef, { _deleted: true });
          break;

        case SyncEventType.CHAPTER_UPDATE:
          batch.set(docRef, this.transformChapterData(event.data), { merge: true });
          break;

        case SyncEventType.CATEGORY_CREATE:
        case SyncEventType.CATEGORY_UPDATE:
          batch.set(docRef, this.transformCategoryData(event.data), { merge: true });
          break;

        case SyncEventType.CATEGORY_DELETE:
          batch.update(docRef, { _deleted: true });
          break;

        default:
          this.logger.warn("Unknown event type", { type: event.type });
      }
    }

    await batch.commit();
    this.logger.debug("Batch committed", { size: events.length, entityType });
  }

  /**
   * Transform manga event data to Firestore format
   */
  private transformMangaData(data: unknown): Record<string, unknown> {
    const d = data as {
      _id: string;
      title: string;
      url: string;
      sourceId: string;
      cover?: string | null;
      localCover?: string | null;
      author?: string | null;
      artist?: string | null;
      description?: string | null;
      genres?: string[];
      status?: string;
      readingStatus?: string;
      addedAt?: number;
      lastUpdated?: number;
    };

    return {
      _id: d._id,
      _rev: 1,
      _created: d.addedAt || Date.now(),
      _modified: Date.now(),
      _deleted: false,
      _synced: Date.now(),
      title: d.title,
      url: d.url,
      sourceId: d.sourceId,
      cover: d.cover ?? null,
      localCover: d.localCover ?? null,
      author: d.author ?? null,
      artist: d.artist ?? null,
      description: d.description ?? null,
      genres: d.genres ?? [],
      status: d.status ?? "unknown",
      readingStatus: d.readingStatus ?? "plan_to_read",
      addedAt: d.addedAt ?? Date.now(),
      lastUpdated: d.lastUpdated ?? Date.now(),
    };
  }

  /**
   * Transform chapter event data to Firestore format
   */
  private transformChapterData(data: unknown): Record<string, unknown> {
    const d = data as {
      id: string;
      mangaId: string;
      number: number;
      isRead?: boolean;
      lastPageRead?: number;
      totalPages?: number;
    };

    return {
      id: d.id,
      mangaId: d.mangaId,
      number: d.number,
      isRead: d.isRead ?? false,
      lastPageRead: d.lastPageRead ?? 0,
      totalPages: d.totalPages ?? 0,
      _modified: Date.now(),
    };
  }

  /**
   * Transform category event data to Firestore format
   */
  private transformCategoryData(data: unknown): Record<string, unknown> {
    const d = data as {
      _id: string;
      name: string;
      order: number;
      mangaIds: string[];
    };

    return {
      _id: d._id,
      _rev: 1,
      _created: Date.now(),
      _modified: Date.now(),
      _deleted: false,
      _synced: Date.now(),
      name: d.name,
      order: d.order,
      mangaIds: d.mangaIds,
    };
  }

  /**
   * Retry logic with exponential backoff
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    delays: number[]
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = delays[attempt] ?? delays[delays.length - 1];
          this.logger.debug(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
          await sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if sync is currently in progress
   */
  isActive(): boolean {
    return this.isSyncing;
  }
}

/**
 * Default SyncService instance
 */
let defaultService: SyncService | null = null;

export function getSyncService(
  firestore: Firestore,
  eventQueue: EventQueue,
  userId: string
): SyncService {
  if (!defaultService) {
    defaultService = new SyncService(firestore, eventQueue, userId);
  }
  return defaultService;
}

export function destroySyncService(): void {
  if (defaultService) {
    defaultService.stop();
    defaultService = null;
  }
}
