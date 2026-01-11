/**
 * SyncService - Core sync orchestrator
 * Uses Firebase JS SDK for Firestore (avoids native build issues)
 */

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  writeBatch,
  query,
  orderBy,
  limit,
  updateDoc,
  deleteDoc, // Added import
  Firestore,
} from "firebase/firestore";
import {
  getAuth,
  signInWithCustomToken,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SyncEvent,
  CloudManga,
  CloudHistoryEntry,
  CloudCategory,
  SyncState,
  SYNC_QUEUE_KEY,
  SYNC_STATE_KEY,
} from "./SyncTypes";
import { SYNC_CONFIG } from "./config";
import { logger } from "@/utils/logger";

// Firebase config - extracted from google-services.json
const firebaseConfig = {
  apiKey: "AIzaSyCCqsnbGFuO3_gE47cVlg1okUpNJRQ18Wc",
  authDomain: "manga-reader-53a5b.firebaseapp.com",
  projectId: "manga-reader-53a5b",
  storageBucket: "manga-reader-53a5b.firebasestorage.app",
  messagingSenderId: "448954263976",
  appId: "1:448954263976:android:d4a6df82be50d42ff1159d",
};

let jsApp: FirebaseApp | null = null;
let jsDb: Firestore | null = null;

// Initialize Firebase JS app
function getJsApp(): FirebaseApp {
  if (!jsApp) {
    const apps = getApps();
    const existingApp = apps.find((a) => a.name === "js-sdk");
    jsApp = existingApp || initializeApp(firebaseConfig, "js-sdk");
  }
  return jsApp;
}

// Get Firestore instance
function getFirestoreDb(): Firestore {
  if (!jsDb) {
    jsDb = getFirestore(getJsApp());
  }
  return jsDb;
}

// Key matching AuthContext
const GOOGLE_OAUTH_TOKEN_KEY = "@google_oauth_id_token";

// Sync auth state from native to JS SDK using Google OAuth token
// Handles token expiration by attempting silent refresh
async function ensureJsAuth(): Promise<boolean> {
  const jsAuth = getAuth(getJsApp());

  // Already authenticated in JS SDK
  if (jsAuth.currentUser) {
    return true;
  }

  // First, try stored token
  let googleIdToken = await AsyncStorage.getItem(GOOGLE_OAUTH_TOKEN_KEY);

  // Try to sign in with stored token
  if (googleIdToken) {
    try {
      const credential = GoogleAuthProvider.credential(googleIdToken);
      const userCredential = await signInWithCredential(jsAuth, credential);
      logger.sync.log(
        `JS Auth synced with stored token - user: ${
          userCredential.user?.uid ?? "unknown"
        }`
      );
      return true;
    } catch (e) {
      logger.sync.log("Stored token expired, attempting silent refresh...");
      // Token expired, try silent refresh below
    }
  }

  // Attempt silent sign-in to get fresh token
  try {
    const isSignedIn = await GoogleSignin.hasPreviousSignIn();
    if (isSignedIn) {
      const userInfo = await GoogleSignin.signInSilently();
      const freshToken = userInfo.data?.idToken;

      if (freshToken) {
        // Store the fresh token
        await AsyncStorage.setItem(GOOGLE_OAUTH_TOKEN_KEY, freshToken);

        // Sign in to JS SDK
        const credential = GoogleAuthProvider.credential(freshToken);
        const userCredential = await signInWithCredential(jsAuth, credential);
        logger.sync.log(
          `JS Auth synced with refreshed token - user: ${
            userCredential.user?.uid ?? "unknown"
          }`
        );
        return true;
      }
    }
  } catch (e) {
    logger.sync.error("Silent refresh failed:", { error: e });
  }

  logger.sync.log("Failed to authenticate JS SDK - user may need to re-login");
  return false;
}

// Helper to remove undefined fields recursively
function sanitizeData<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeData(item)) as unknown as T;
  }

  const result: any = {};
  for (const key in obj) {
    const value = (obj as any)[key];
    if (value !== undefined) {
      result[key] = sanitizeData(value);
    }
  }
  return result as T;
}

class SyncServiceClass {
  private queue: SyncEvent[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private periodicSyncTimer: ReturnType<typeof setInterval> | null = null;
  private realtimeUnsubscribe: (() => void) | null = null;
  private isSyncing = false;
  private listeners: Set<(state: SyncState) => void> = new Set();

  /**
   * Initialize service - load persisted queue
   */
  async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        logger.sync.log(`Loaded ${this.queue.length} pending events`);
      }
    } catch (e) {
      logger.sync.error("Failed to load queue:", { error: e });
    }
  }

  /**
   * Add event to sync queue
   */
  async enqueue(event: Omit<SyncEvent, "id" | "timestamp">): Promise<void> {
    const fullEvent: SyncEvent = {
      ...event,
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
    };

    // Dedupe: remove older events for same entity+type
    this.queue = this.queue.filter(
      (e) => !(e.entityId === event.entityId && e.type === event.type)
    );

    this.queue.push(fullEvent);
    await this.persistQueue();
    this.notifyListeners();

    // Sync immediately for all events - no debounce
    logger.sync.log(`Event ${event.type} queued, syncing immediately`);
    this.flush();
  }

  /**
   * Schedule debounced sync
   */
  private scheduleSync(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(
      () => this.flush(),
      SYNC_CONFIG.DEBOUNCE_MS
    );
  }

  /**
   * Force immediate sync (for app background, logout, manual trigger)
   */
  async flush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.isSyncing || this.queue.length === 0) return;

    const user = auth().currentUser;
    if (!user) {
      logger.sync.log("No user, skipping sync");
      return;
    }

    // Ensure JS SDK is authenticated
    await ensureJsAuth();

    this.isSyncing = true;
    this.notifyListeners();

    try {
      await this.uploadQueue(user.uid);
      this.queue = [];
      await this.persistQueue();
      await this.updateSyncState({ lastSyncTimestamp: Date.now() });
      logger.sync.log("Sync complete");
    } catch (e) {
      logger.sync.error("Sync failed:", { error: e });
      await this.updateSyncState({ error: (e as Error).message });
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Upload queued events to Firestore
   */
  private async uploadQueue(userId: string): Promise<void> {
    const db = getFirestoreDb();
    const userDocRef = doc(db, "users", userId);

    // Group events by entity for batch efficiency
    const mangaEvents = this.queue.filter((e) =>
      [
        "manga_added",
        "manga_removed",
        "manga_updated",
        "chapter_read",
        "chapter_unread",
        "progress_updated",
      ].includes(e.type)
    );
    const historyEvents = this.queue.filter((e) => e.type === "history_added");
    const categoryEvents = this.queue.filter((e) =>
      ["category_added", "category_updated", "category_deleted"].includes(
        e.type
      )
    );

    let batch = writeBatch(db);
    let opCount = 0;

    // Process manga events
    for (const event of mangaEvents) {
      const mangaRef = doc(collection(userDocRef, "manga"), event.entityId);

      if (event.type === "manga_removed") {
        batch.update(mangaRef, {
          inLibrary: false,
          lastUpdated: event.timestamp,
        });
      } else if (event.data) {
        batch.set(mangaRef, sanitizeData(event.data as CloudManga), {
          merge: true,
        });
      }

      opCount++;
      if (opCount >= SYNC_CONFIG.BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }

    // Process category events
    for (const event of categoryEvents) {
      const catRef = doc(collection(userDocRef, "categories"), event.entityId);

      if (event.type === "category_deleted") {
        batch.delete(catRef);
      } else if (event.data) {
        batch.set(catRef, sanitizeData(event.data as CloudCategory));
      }

      opCount++;
      if (opCount >= SYNC_CONFIG.BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }

    // Process history events
    for (const event of historyEvents) {
      if (event.data) {
        const historyRef = doc(
          collection(userDocRef, "history"),
          event.entityId
        );
        batch.set(historyRef, sanitizeData(event.data as CloudHistoryEntry));

        opCount++;
        if (opCount >= SYNC_CONFIG.BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }
  }

  /**
   * Download all data from cloud (for login sync)
   */
  async downloadAll(userId: string): Promise<{
    manga: CloudManga[];
    history: CloudHistoryEntry[];
    categories: CloudCategory[];
  }> {
    // Ensure JS SDK is authenticated
    await ensureJsAuth();

    const db = getFirestoreDb();
    const userDocRef = doc(db, "users", userId);

    const mangaCollectionRef = collection(userDocRef, "manga");
    const historyCollectionRef = collection(userDocRef, "history");
    const categoryCollectionRef = collection(userDocRef, "categories");

    const [mangaSnap, historySnap, categorySnap] = await Promise.all([
      getDocs(mangaCollectionRef),
      getDocs(
        query(historyCollectionRef, orderBy("timestamp", "desc"), limit(500))
      ),
      getDocs(categoryCollectionRef),
    ]);

    const manga = mangaSnap.docs.map((d) => d.data() as CloudManga);
    const history = historySnap.docs.map((d) => d.data() as CloudHistoryEntry);
    const categories = categorySnap.docs.map((d) => d.data() as CloudCategory);

    logger.sync.log(
      `Downloaded ${manga.length} manga, ${history.length} history, ${categories.length} categories`
    );
    return { manga, history, categories };
  }

  /**
   * Upload full library to cloud (initial sync or manual)
   */
  async uploadFull(
    userId: string,
    manga: CloudManga[],
    history: CloudHistoryEntry[],
    categories: CloudCategory[] = []
  ): Promise<void> {
    // Ensure JS SDK is authenticated
    await ensureJsAuth();

    const db = getFirestoreDb();
    const userDocRef = doc(db, "users", userId);

    // Batch writes for efficiency (Firestore JS SDK batches)
    let batch = writeBatch(db);
    let opCount = 0;

    for (const m of manga) {
      const mangaRef = doc(collection(userDocRef, "manga"), m.id);
      batch.set(mangaRef, sanitizeData(m), { merge: true });
      opCount++;
      if (opCount >= SYNC_CONFIG.BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }

    for (const c of categories) {
      const catRef = doc(collection(userDocRef, "categories"), c.id);
      batch.set(catRef, sanitizeData(c));
      opCount++;
      if (opCount >= SYNC_CONFIG.BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }

    for (const h of history) {
      const historyRef = doc(collection(userDocRef, "history"), h.id);
      batch.set(historyRef, sanitizeData(h));
      opCount++;
      if (opCount >= SYNC_CONFIG.BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    await this.updateSyncState({ lastSyncTimestamp: Date.now() });
    logger.sync.log(
      `Full upload complete: ${manga.length} manga, ${categories.length} categories, ${history.length} history`
    );
  }

  /**
   * Clear queue (for logout)
   */
  async clearQueue(): Promise<void> {
    this.queue = [];
    await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
    await AsyncStorage.removeItem(SYNC_STATE_KEY);
  }

  /**
   * Get current sync state
   */
  getState(): SyncState {
    return {
      lastSyncTimestamp: 0, // Will be loaded from storage
      isSyncing: this.isSyncing,
      pendingChanges: this.queue.length,
    };
  }

  /**
   * Get pending sync events (for debugging)
   */
  getQueue(): SyncEvent[] {
    return [...this.queue];
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }

  private async persistQueue(): Promise<void> {
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.queue));
  }

  private async updateSyncState(partial: Partial<SyncState>): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(SYNC_STATE_KEY);
      const state = existing ? JSON.parse(existing) : {};
      await AsyncStorage.setItem(
        SYNC_STATE_KEY,
        JSON.stringify({ ...state, ...partial })
      );
    } catch (e) {
      logger.sync.error("Failed to update state:", { error: e });
    }
  }

  /**
   * Start periodic sync interval (call when app is active and user is logged in)
   */
  startPeriodicSync(): void {
    if (this.periodicSyncTimer) return; // Already running

    logger.sync.log(
      `Starting periodic sync every ${
        SYNC_CONFIG.PERIODIC_SYNC_INTERVAL_MS / 1000
      }s`
    );
    this.periodicSyncTimer = setInterval(() => {
      if (this.queue.length > 0) {
        logger.sync.log("Periodic sync triggered");
        this.flush();
      }
    }, SYNC_CONFIG.PERIODIC_SYNC_INTERVAL_MS);
  }

  /**
   * Stop periodic sync interval (call on logout or app background)
   */
  stopPeriodicSync(): void {
    if (this.periodicSyncTimer) {
      clearInterval(this.periodicSyncTimer);
      this.periodicSyncTimer = null;
      logger.sync.log("Stopped periodic sync");
    }
  }

  /**
   * Setup real-time Firestore listener for incoming changes
   * This enables bi-directional sync (changes from other devices sync down)
   */
  setupRealtimeListener(
    userId: string,
    onMangaChange: (manga: CloudManga[]) => void,
    onHistoryChange: (history: CloudHistoryEntry[]) => void
  ): () => void {
    // Clean up existing listener
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
    }

    const db = getFirestoreDb();
    const userDocRef = doc(db, "users", userId);
    const mangaCollectionRef = collection(userDocRef, "manga");
    const historyCollectionRef = collection(userDocRef, "history");

    // Import onSnapshot for real-time updates
    const { onSnapshot } = require("firebase/firestore");

    const unsubManga = onSnapshot(mangaCollectionRef, (snapshot: any) => {
      const changes = snapshot.docChanges();
      if (changes.length > 0) {
        const manga = snapshot.docs.map((d: any) => d.data() as CloudManga);
        logger.sync.log(`Real-time: ${changes.length} manga changes received`);
        onMangaChange(manga);
      }
    });

    const unsubHistory = onSnapshot(
      query(historyCollectionRef, orderBy("timestamp", "desc"), limit(100)),
      (snapshot: any) => {
        const changes = snapshot.docChanges();
        if (changes.length > 0) {
          const history = snapshot.docs.map(
            (d: any) => d.data() as CloudHistoryEntry
          );
          logger.sync.log(
            `Real-time: ${changes.length} history changes received`
          );
          onHistoryChange(history);
        }
      }
    );

    this.realtimeUnsubscribe = () => {
      unsubManga();
      unsubHistory();
      logger.sync.log("Real-time listener stopped");
    };

    logger.sync.log("Real-time Firestore listener started");
    return this.realtimeUnsubscribe;
  }

  /**
   * Stop real-time listener
   */
  stopRealtimeListener(): void {
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }
  }
}

// Singleton instance
export const SyncService = new SyncServiceClass();
