/**
 * Firebase Client
 *
 * Firebase SDK initialization and configuration for the sync system.
 * Uses Firebase JS SDK for both Auth and Firestore.
 *
 * Note: Authentication is now managed by AuthContext using the JS SDK directly.
 * This client provides access to the Firebase instances for the sync system.
 */

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getAuth, Auth, signInWithCredential, GoogleAuthProvider, signOut as firebaseSignOut, onAuthStateChanged, User } from "firebase/auth";
import { firebaseConfig, isFirebaseConfigured } from "./firebaseConfig";

/**
 * Firebase configuration interface
 */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/**
 * Firebase client class
 * Manages Firebase app, Firestore, and Auth instances
 */
export class FirebaseClient {
  private _app: FirebaseApp | null = null;
  private firestore: Firestore | null = null;
  private auth: Auth | null = null;
  private initialized = false;

  constructor(private config: FirebaseConfig) {}

  /**
   * Initialize Firebase services
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Validate config
      if (!isFirebaseConfigured()) {
        throw new Error(
          "Firebase config is not properly configured. Please update firebaseConfig.ts with your Firebase credentials."
        );
      }

      // Initialize Firebase app
      if (!getApps().length) {
        this._app = initializeApp(this.config);
      } else {
        this._app = getApps()[0];
      }

      // Initialize Firestore with persistent cache
      this.firestore = initializeFirestore(this._app, {
        localCache: persistentLocalCache(/* settings */ {
          // Use AsyncStorage for cache persistence
          cacheSizeBytes: 10 * 1024 * 1024, // 10MB
        }),
      });

      // Initialize Auth
      this.auth = getAuth(this._app);
      this.auth.useDeviceLanguage();

      this.initialized = true;
      console.log("[FirebaseClient] Initialized successfully");
    } catch (error) {
      console.error("[FirebaseClient] Initialization failed:", error);
      throw error;
    }
  }

  /**
   * Get the Firebase app instance
   */
  get app(): FirebaseApp {
    if (!this._app) {
      throw new Error("Firebase app not initialized. Call initialize() first.");
    }
    return this._app;
  }

  /**
   * Get Firestore instance
   */
  getFirestore(): Firestore {
    if (!this.firestore) {
      throw new Error("Firestore not initialized. Call initialize() first.");
    }
    return this.firestore;
  }

  /**
   * Get Auth instance
   */
  getAuth(): Auth {
    if (!this.auth) {
      throw new Error("Auth not initialized. Call initialize() first.");
    }
    return this.auth;
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.auth?.currentUser ?? null;
  }

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null {
    return this.auth?.currentUser?.uid ?? null;
  }

  /**
   * Sign in with Google OAuth credential
   */
  async signInWithGoogle(idToken: string): Promise<User> {
    const auth = this.getAuth();
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    console.log("[FirebaseClient] Signed in with Google:", result.user.uid);
    return result.user;
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    const auth = this.getAuth();
    await firebaseSignOut(auth);
    console.log("[FirebaseClient] Signed out");
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    const auth = this.getAuth();
    return onAuthStateChanged(auth, callback);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.auth?.currentUser != null;
  }
}

/**
 * Default Firebase client instance
 */
let defaultClient: FirebaseClient | null = null;

/**
 * Get or create Firebase client
 */
export function getFirebaseClient(config?: FirebaseConfig): FirebaseClient {
  if (!defaultClient) {
    if (!config) {
      throw new Error("Firebase config required for first initialization");
    }
    defaultClient = new FirebaseClient(config);
  }
  return defaultClient;
}

/**
 * Initialize Firebase with configuration from config file
 */
export async function initializeFirebase(): Promise<FirebaseClient> {
  const client = getFirebaseClient(firebaseConfig);
  await client.initialize();
  return client;
}

/**
 * Get Firestore instance
 */
export function getFirestoreInstance(): Firestore {
  const client = getFirebaseClient();
  return client.getFirestore();
}

/**
 * Get Auth instance
 */
export function getAuthInstance(): Auth {
  const client = getFirebaseClient();
  return client.getAuth();
}

/**
 * Get current user ID (throws if not authenticated)
 */
export function requireUserId(): string {
  const client = getFirebaseClient();
  const userId = client.getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return userId;
}

/**
 * Get current user ID (returns null if not authenticated)
 */
export function getUserId(): string | null {
  const client = getFirebaseClient();
  return client.getCurrentUserId();
}
