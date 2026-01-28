/**
 * Event Queue for Sync System
 *
 * Manages the queue of sync events waiting to be uploaded to Firestore.
 * Features:
 * - In-memory queue with deduplication
 * - AsyncStorage persistence for offline support
 * - Priority-based event ordering
 * - Automatic flushing on threshold
 * - Event statistics
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SyncEvent, SyncQueueStats, SyncEventPriority } from "../types/events.types";
import { eventKey, SyncEntityType } from "../types/events.types";
import type { SyncConfig } from "../config/sync.config";
import { getSyncConfig, SyncLogger } from "../config/sync.config";

/**
 * Event Queue class
 * Manages sync events with deduplication, priority, and persistence
 */
export class EventQueue {
  private memoryQueue: Map<string, SyncEvent> = new Map();
  private processing = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private logger: SyncLogger;

  constructor(private config: SyncConfig = getSyncConfig()) {
    this.logger = new SyncLogger(config);
  }

  /**
   * Initialize the queue by loading persisted events
   */
  async initialize(): Promise<void> {
    this.logger.info("Initializing event queue...");
    await this.restore();
    this.startAutoFlush();
    this.logger.info("Event queue initialized", { size: this.memoryQueue.size });
  }

  /**
   * Add an event to the queue
   * If an event for the same entity already exists, it will be replaced (deduplication)
   */
  async enqueue(event: SyncEvent): Promise<void> {
    // Check queue size limit
    if (this.memoryQueue.size >= this.config.maxQueueSize) {
      this.logger.warn("Queue is full, cannot add event", {
        type: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
      });
      throw new Error("Queue is full");
    }

    // Deduplicate: replace existing event for same entity
    const key = eventKey(event);
    const existing = this.memoryQueue.get(key);

    if (existing) {
      // Keep the event with higher version
      if (event.version <= existing.version) {
        this.logger.debug("Skipping event (older version)", { key, existingVersion: existing.version, newVersion: event.version });
        return;
      }
    }

    this.memoryQueue.set(key, event);
    this.logger.debug("Event enqueued", { key, type: event.type, priority: event.priority });

    // Persist to disk
    if (this.config.persistToDisk) {
      await this.persist();
    }

    // Auto-flush if threshold reached
    if (this.memoryQueue.size >= this.config.flushThreshold) {
      await this.flush();
    }
  }

  /**
   * Get a batch of events for processing
   * Events are ordered by priority (high > normal > low) and then by timestamp
   */
  async getBatch(size: number = this.config.batchSize): Promise<SyncEvent[]> {
    const events = Array.from(this.memoryQueue.values())
      .sort((a, b) => {
        // First by priority
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const aPriority = priorityOrder[a.priority];
        const bPriority = priorityOrder[b.priority];

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        // Then by timestamp (older first)
        return a.timestamp - b.timestamp;
      })
      .slice(0, size);

    this.logger.debug("Retrieved batch", { size: events.length, queueSize: this.memoryQueue.size });
    return events;
  }

  /**
   * Mark events as processed and remove them from the queue
   */
  async markProcessed(eventIds: string[]): Promise<void> {
    let removed = 0;

    // Find and remove events by ID
    for (const eventId of eventIds) {
      for (const [key, event] of this.memoryQueue) {
        if (event.id === eventId) {
          this.memoryQueue.delete(key);
          removed++;
          break;
        }
      }
    }

    this.logger.debug("Marked events as processed", { count: removed, remaining: this.memoryQueue.size });

    // Persist to disk
    if (removed > 0 && this.config.persistToDisk) {
      await this.persist();
    }
  }

  /**
   * Mark an event as failed (increment retry count)
   */
  async markFailed(eventId: string, retryable: boolean = true): Promise<void> {
    for (const [key, event] of this.memoryQueue) {
      if (event.id === eventId) {
        if (retryable && event.retryCount < this.config.maxRetries) {
          // Increment retry count and keep in queue
          event.retryCount++;
          this.logger.debug("Event retry count incremented", { eventId, retryCount: event.retryCount });
        } else {
          // Max retries reached, remove from queue
          this.memoryQueue.delete(key);
          this.logger.warn("Event removed after max retries", { eventId, retryCount: event.retryCount });
        }

        if (this.config.persistToDisk) {
          await this.persist();
        }
        return;
      }
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): SyncQueueStats {
    const events = Array.from(this.memoryQueue.values());

    const byPriority = {
      high: 0,
      normal: 0,
      low: 0,
    };

    const byType = {
      manga: 0,
      chapter: 0,
      category: 0,
      settings: 0,
    };

    for (const event of events) {
      byPriority[event.priority]++;
      byType[event.entityType]++;
    }

    return {
      total: events.length,
      byPriority,
      byType,
    };
  }

  /**
   * Clear all events from the queue
   */
  async clear(): Promise<void> {
    this.memoryQueue.clear();
    this.logger.info("Queue cleared");

    if (this.config.persistToDisk) {
      await this.persist();
    }
  }

  /**
   * Get the number of events in the queue
   */
  size(): number {
    return this.memoryQueue.size;
  }

  /**
   * Check if the queue is empty
   */
  isEmpty(): boolean {
    return this.memoryQueue.size === 0;
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (!this.processing && this.memoryQueue.size > 0) {
        this.flush().catch((error) => {
          this.logger.error("Auto-flush failed", error);
        });
      }
    }, this.config.flushInterval);
  }

  /**
   * Stop auto-flush timer
   */
  stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Flush the queue (trigger processing)
   * This is called automatically when threshold is reached or on interval
   */
  private async flush(): Promise<void> {
    if (this.processing) {
      this.logger.debug("Flush skipped (already processing)");
      return;
    }

    this.processing = true;

    try {
      const events = await this.getBatch(this.config.batchSize);

      if (events.length === 0) {
        return;
      }

      this.logger.info("Flushing batch", { size: events.length });

      // The actual processing will be done by SyncService
      // This just ensures the queue is ready to be processed
    } finally {
      this.processing = false;
    }
  }

  /**
   * Persist queue to AsyncStorage
   */
  private async persist(): Promise<void> {
    try {
      const events = Array.from(this.memoryQueue.values());
      await AsyncStorage.setItem(this.config.queueStorageKey, JSON.stringify(events));
      this.logger.debug("Queue persisted", { size: events.length });
    } catch (error) {
      this.logger.error("Failed to persist queue", error);
    }
  }

  /**
   * Restore queue from AsyncStorage
   */
  private async restore(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.config.queueStorageKey);

      if (stored) {
        const events: SyncEvent[] = JSON.parse(stored);
        let restored = 0;

        for (const event of events) {
          const key = eventKey(event);
          this.memoryQueue.set(key, event);
          restored++;
        }

        this.logger.info("Queue restored", { size: restored });
      }
    } catch (error) {
      this.logger.error("Failed to restore queue", error);
    }
  }

  /**
   * Destroy the queue and clean up resources
   */
  async destroy(): Promise<void> {
    this.stopAutoFlush();
    await this.clear();
    this.logger.info("Event queue destroyed");
  }
}

/**
 * Default event queue instance
 * Will be initialized by SyncService
 */
let defaultQueue: EventQueue | null = null;

export function getEventQueue(config?: SyncConfig): EventQueue {
  if (!defaultQueue) {
    defaultQueue = new EventQueue(config);
  }
  return defaultQueue;
}

export function destroyEventQueue(): void {
  if (defaultQueue) {
    defaultQueue.destroy();
    defaultQueue = null;
  }
}
