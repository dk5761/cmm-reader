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
  SyncState,
  SYNC_QUEUE_KEY,
  SYNC_STATE_KEY,
} from "./SyncTypes";

const DEBOUNCE_MS = 30000; // 30 seconds
const BATCH_SIZE = 100;

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
      await signInWithCredential(jsAuth, credential);
      console.log(
        "[SyncService] JS Auth synced with stored token - user:",
        jsAuth.currentUser?.uid
      );
      return true;
    } catch (e) {
      console.log(
        "[SyncService] Stored token expired, attempting silent refresh..."
      );
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
        await signInWithCredential(jsAuth, credential);
        console.log(
          "[SyncService] JS Auth synced with refreshed token - user:",
          jsAuth.currentUser?.uid
        );
        return true;
      }
    }
  } catch (e) {
    console.error("[SyncService] Silent refresh failed:", e);
  }

  console.log(
    "[SyncService] Failed to authenticate JS SDK - user may need to re-login"
  );
  return false;
}

class SyncServiceClass {
  private queue: SyncEvent[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
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
        console.log(
          "[SyncService] Loaded",
          this.queue.length,
          "pending events"
        );
      }
    } catch (e) {
      console.error("[SyncService] Failed to load queue:", e);
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
    this.scheduleSync();
  }

  /**
   * Schedule debounced sync
   */
  private scheduleSync(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => this.flush(), DEBOUNCE_MS);
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
      console.log("[SyncService] No user, skipping sync");
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
      console.log("[SyncService] Sync complete");
    } catch (e) {
      console.error("[SyncService] Sync failed:", e);
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

    // Process manga events
    for (const event of mangaEvents) {
      const mangaRef = doc(collection(userDocRef, "manga"), event.entityId);

      if (event.type === "manga_removed") {
        await updateDoc(mangaRef, {
          inLibrary: false,
          lastUpdated: event.timestamp,
        });
      } else if (event.data) {
        await setDoc(mangaRef, event.data as CloudManga, { merge: true });
      }
    }

    // Process history events
    for (const event of historyEvents) {
      if (event.data) {
        const historyRef = doc(
          collection(userDocRef, "history"),
          event.entityId
        );
        await setDoc(historyRef, event.data as CloudHistoryEntry);
      }
    }
  }

  /**
   * Download all data from cloud (for login sync)
   */
  async downloadAll(userId: string): Promise<{
    manga: CloudManga[];
    history: CloudHistoryEntry[];
  }> {
    // Ensure JS SDK is authenticated
    await ensureJsAuth();

    const db = getFirestoreDb();
    const userDocRef = doc(db, "users", userId);

    const mangaCollectionRef = collection(userDocRef, "manga");
    const historyCollectionRef = collection(userDocRef, "history");

    const [mangaSnap, historySnap] = await Promise.all([
      getDocs(mangaCollectionRef),
      getDocs(
        query(historyCollectionRef, orderBy("timestamp", "desc"), limit(500))
      ),
    ]);

    const manga = mangaSnap.docs.map((d) => d.data() as CloudManga);
    const history = historySnap.docs.map((d) => d.data() as CloudHistoryEntry);

    console.log(
      "[SyncService] Downloaded",
      manga.length,
      "manga,",
      history.length,
      "history"
    );
    return { manga, history };
  }

  /**
   * Upload full library to cloud (initial sync or manual)
   */
  async uploadFull(
    userId: string,
    manga: CloudManga[],
    history: CloudHistoryEntry[]
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
      batch.set(mangaRef, m, { merge: true });
      opCount++;
      if (opCount >= BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }

    for (const h of history) {
      const historyRef = doc(collection(userDocRef, "history"), h.id);
      batch.set(historyRef, h);
      opCount++;
      if (opCount >= BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    await this.updateSyncState({ lastSyncTimestamp: Date.now() });
    console.log(
      "[SyncService] Full upload complete:",
      manga.length,
      "manga,",
      history.length,
      "history"
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
      console.error("[SyncService] Failed to update state:", e);
    }
  }
}

// Singleton instance
export const SyncService = new SyncServiceClass();
