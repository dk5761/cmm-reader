/**
 * Firebase Client
 *
 * Firebase SDK initialization and configuration for the sync system.
 * Uses Firebase JS SDK for Firestore to avoid native build issues.
 *
 * Note: This bridges authentication with the native Firebase Auth by using
 * the stored Google OAuth token from the app's main auth system.
 */

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getAuth, Auth, signInWithCredential, GoogleAuthProvider, signOut as firebaseSignOut, onAuthStateChanged, User } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { firebaseConfig, isFirebaseConfigured } from "./firebaseConfig";

// Google OAuth token key (must match the one in AuthContext)
const GOOGLE_OAUTH_TOKEN_KEY = "@google_oauth_id_token";

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
  private app: FirebaseApp | null = null;
  private firestore: Firestore | null = null;
  private auth: Auth | null = null;
  private initialized = false;
  private authUnsubscribe: (() => void) | null = null;

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
        this.app = initializeApp(this.config);
      } else {
        this.app = getApps()[0];
      }

      // Initialize Firestore with persistent cache
      this.firestore = initializeFirestore(this.app, {
        localCache: persistentLocalCache(/* settings */ {
          // Use AsyncStorage for cache persistence
          cacheSizeBytes: 10 * 1024 * 1024, // 10MB
        }),
      });

      // Initialize Auth
      this.auth = getAuth(this.app);
      this.auth.useDeviceLanguage();

      // Bridge authentication: Check if user is already authenticated via native Firebase
      // by looking for the stored Google OAuth token
      await this.bridgeAuthentication();

      this.initialized = true;
      console.log("[FirebaseClient] Initialized successfully");
    } catch (error) {
      console.error("[FirebaseClient] Initialization failed:", error);
      throw error;
    }
  }

  /**
   * Bridge authentication from native Firebase Auth to JS SDK
   * Uses the stored Google OAuth token to sign in to the JS SDK
   */
  private async bridgeAuthentication(): Promise<void> {
    try {
      // Check if already authenticated in JS SDK
      if (this.auth!.currentUser) {
        console.log("[FirebaseClient] Already authenticated in JS SDK");
        return;
      }

      // Get stored Google OAuth token
      const idToken = await AsyncStorage.getItem(GOOGLE_OAUTH_TOKEN_KEY);

      if (!idToken) {
        console.log("[FirebaseClient] No stored Google OAuth token found");
        return;
      }

      // Sign in to JS SDK using the stored token
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(this.auth!, credential);

      console.log("[FirebaseClient] Successfully bridged authentication to JS SDK");
    } catch (error) {
      console.warn("[FirebaseClient] Failed to bridge authentication:", error);
      // Don't throw - authentication can be retried later
    }
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

  /**
   * Refresh/bridge authentication from native Firebase Auth
   * Call this when the user signs in via the native auth system
   */
  async refreshAuthentication(): Promise<void> {
    if (!this.initialized) {
      console.warn("[FirebaseClient] Cannot refresh auth - client not initialized");
      return;
    }
    await this.bridgeAuthentication();
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

/**
 * Refresh authentication bridge from native Firebase Auth
 * Call this when the user signs in via the native auth system
 */
export async function refreshAuthentication(): Promise<void> {
  const client = getFirebaseClient();
  await client.refreshAuthentication();
}
