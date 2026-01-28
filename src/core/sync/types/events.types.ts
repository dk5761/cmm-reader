/**
 * Sync event types
 * Defines all possible event types that can be synced to Firestore
 */
export enum SyncEventType {
  // Manga events
  MANGA_CREATE = "MANGA_CREATE",
  MANGA_UPDATE = "MANGA_UPDATE",
  MANGA_DELETE = "MANGA_DELETE",

  // Chapter events
  CHAPTER_UPDATE = "CHAPTER_UPDATE", // Chapter read status, page progress
  CHAPTERS_BATCH_UPDATE = "CHAPTERS_BATCH_UPDATE", // Multiple chapters at once

  // Category events
  CATEGORY_CREATE = "CATEGORY_CREATE",
  CATEGORY_UPDATE = "CATEGORY_UPDATE",
  CATEGORY_DELETE = "CATEGORY_DELETE",

  // Settings events
  SETTINGS_UPDATE = "SETTINGS_UPDATE",

  // Batch operations
  BATCH_OPERATION = "BATCH_OPERATION", // Multiple changes at once
}

/**
 * Entity types that can be synced
 */
export enum SyncEntityType {
  MANGA = "manga",
  CHAPTER = "chapter",
  CATEGORY = "category",
  SETTINGS = "settings",
}

/**
 * Sync event priority levels
 */
export enum SyncEventPriority {
  HIGH = "high", // User-initiated actions (add to library, mark as read)
  NORMAL = "normal", // Background sync updates
  LOW = "low", // Non-critical metadata updates
}

/**
 * Core sync event interface
 * Represents a single change that needs to be synced to Firestore
 */
export interface SyncEvent {
  id: string; // Unique event ID (UUID)
  type: SyncEventType;
  entityType: SyncEntityType;
  entityId: string;
  userId: string;
  timestamp: number;
  data: unknown; // Entity data (partial for updates, full for creates)
  version: number; // Entity version for conflict resolution
  retryCount: number;
  priority: SyncEventPriority;
}

/**
 * Manga sync event data
 */
export interface MangaEventData {
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
}

/**
 * Chapter sync event data
 */
export interface ChapterEventData {
  id: string;
  mangaId: string;
  number: number;
  isRead?: boolean;
  lastPageRead?: number;
  totalPages?: number;
}

/**
 * Category sync event data
 */
export interface CategoryEventData {
  _id: string;
  name: string;
  order: number;
  mangaIds: string[];
}

/**
 * Settings sync event data
 */
export interface SettingsEventData {
  nsfwSourcesEnabled?: boolean;
  theme?: "system" | "light" | "dark";
}

/**
 * Sync result interface
 * Returned after sync operations complete
 */
export interface SyncResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: SyncError[];
  timestamp: number;
}

/**
 * Sync error interface
 */
export interface SyncError {
  eventId: string;
  entityType: SyncEntityType;
  entityId: string;
  error: string;
  retryable: boolean;
}

/**
 * Sync queue statistics
 */
export interface SyncQueueStats {
  total: number;
  byPriority: {
    high: number;
    normal: number;
    low: number;
  };
  byType: {
    manga: number;
    chapter: number;
    category: number;
    settings: number;
  };
}

/**
 * Batch operation event data
 * Contains multiple events grouped together
 */
export interface BatchEventData {
  events: Omit<SyncEvent, "id">[];
}

/**
 * Type guard functions
 */
export function isMangaEvent(event: SyncEvent): event is SyncEvent & { data: MangaEventData } {
  return event.entityType === SyncEntityType.MANGA;
}

export function isChapterEvent(event: SyncEvent): event is SyncEvent & { data: ChapterEventData } {
  return event.entityType === SyncEntityType.CHAPTER;
}

export function isCategoryEvent(event: SyncEvent): event is SyncEvent & { data: CategoryEventData } {
  return event.entityType === SyncEntityType.CATEGORY;
}

export function isSettingsEvent(event: SyncEvent): event is SyncEvent & { data: SettingsEventData } {
  return event.entityType === SyncEntityType.SETTINGS;
}

/**
 * Event creation helper
 */
export function createSyncEvent(
  type: SyncEventType,
  entityType: SyncEntityType,
  entityId: string,
  userId: string,
  data: unknown,
  priority: SyncEventPriority = SyncEventPriority.NORMAL
): SyncEvent {
  return {
    id: crypto.randomUUID(),
    type,
    entityType,
    entityId,
    userId,
    timestamp: Date.now(),
    data,
    version: 1,
    retryCount: 0,
    priority,
  };
}

/**
 * Event key generator for deduplication
 * Combines entity type and ID for unique identification
 */
export function eventKey(event: SyncEvent): string {
  return `${event.entityType}:${event.entityId}`;
}

/**
 * Event comparison for version tracking
 */
export function compareEventVersions(a: SyncEvent, b: SyncEvent): number {
  return b.version - a.version; // Higher version first
}
