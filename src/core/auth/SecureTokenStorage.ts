/**
 * Secure Token Storage
 *
 * Provides encoded storage for authentication tokens using AsyncStorage.
 * Uses Base64 encoding for basic obfuscation (not true encryption, but prevents casual inspection).
 *
 * For production apps requiring true encryption, consider using:
 * - expo-secure-store for iOS Keychain/Android Keystore integration
 * - expo-encrypted-local-storage for full encryption
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "firebase/auth";

// Storage keys
const STORAGE_KEYS = {
  USER_SESSION: "@auth_user_session_v2",
  TOKEN_TIMESTAMP: "@auth_token_timestamp",
} as const;

// Token expiration
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * User session data to be stored
 */
export interface StoredUserSession {
  user: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    emailVerified: boolean;
  };
  idToken: string;
  refreshToken?: string;
  timestamp: number;
}

/**
 * Simple Base64 encoding for basic obfuscation
 * Note: This is NOT encryption, just encoding to prevent casual inspection
 */
function encode(data: string): string {
  try {
    // Convert to Base64
    return Buffer.from(data).toString("base64");
  } catch (error) {
    console.error("[SecureTokenStorage] Encoding failed:", error);
    throw new Error("Failed to encode data");
  }
}

/**
 * Simple Base64 decoding
 */
function decode(encoded: string): string {
  try {
    return Buffer.from(encoded, "base64").toString();
  } catch (error) {
    console.error("[SecureTokenStorage] Decoding failed:", error);
    throw new Error("Failed to decode data");
  }
}

/**
 * Store user session with encoding
 * @param user - Firebase user object
 * @param idToken - Google ID token
 * @param refreshToken - Optional refresh token
 */
export async function storeUserSession(
  user: User,
  idToken: string,
  refreshToken?: string
): Promise<void> {
  try {
    console.log("[SecureTokenStorage] Storing user session...");

    // Prepare session data
    const sessionData: StoredUserSession = {
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
      },
      idToken,
      refreshToken,
      timestamp: Date.now(),
    };

    // Encode and store
    const serialized = JSON.stringify(sessionData);
    const encoded = encode(serialized);

    await AsyncStorage.setItem(STORAGE_KEYS.USER_SESSION, encoded);
    await AsyncStorage.setItem(STORAGE_KEYS.TOKEN_TIMESTAMP, Date.now().toString());

    console.log("[SecureTokenStorage] User session stored successfully");
  } catch (error) {
    console.error("[SecureTokenStorage] Failed to store user session:", error);
    throw new Error("Failed to store user session");
  }
}

/**
 * Retrieve stored user session
 * @returns Stored session data or null if not found
 */
export async function getUserSession(): Promise<StoredUserSession | null> {
  try {
    const encoded = await AsyncStorage.getItem(STORAGE_KEYS.USER_SESSION);

    if (!encoded) {
      console.log("[SecureTokenStorage] No stored session found");
      return null;
    }

    // Decode session data
    const decoded = decode(encoded);
    const sessionData: StoredUserSession = JSON.parse(decoded);

    console.log("[SecureTokenStorage] Retrieved stored session for user:", sessionData.user.uid);

    // Check if session is still valid (not expired)
    if (isTokenExpired(sessionData.timestamp)) {
      console.log("[SecureTokenStorage] Stored session has expired");
      await clearUserSession();
      return null;
    }

    return sessionData;
  } catch (error) {
    console.error("[SecureTokenStorage] Failed to retrieve user session:", error);
    // If decoding fails, clear the corrupted data
    await clearUserSession();
    return null;
  }
}

/**
 * Clear stored user session
 * Called on sign out or when session expires
 */
export async function clearUserSession(): Promise<void> {
  try {
    console.log("[SecureTokenStorage] Clearing user session...");

    await AsyncStorage.multiRemove([
      STORAGE_KEYS.USER_SESSION,
      STORAGE_KEYS.TOKEN_TIMESTAMP,
    ]);

    console.log("[SecureTokenStorage] User session cleared successfully");
  } catch (error) {
    console.error("[SecureTokenStorage] Failed to clear user session:", error);
    throw new Error("Failed to clear user session");
  }
}

/**
 * Check if a token has expired
 * @param timestamp - Token creation timestamp
 * @returns true if token is expired
 */
export function isTokenExpired(timestamp: number): boolean {
  const now = Date.now();
  const age = now - timestamp;
  return age >= TOKEN_EXPIRY_MS;
}

/**
 * Get the time until token expires (in milliseconds)
 * @param timestamp - Token creation timestamp
 * @returns Milliseconds until expiry, or 0 if already expired
 */
export function getTimeUntilExpiry(timestamp: number): number {
  const now = Date.now();
  const age = now - timestamp;
  const remaining = TOKEN_EXPIRY_MS - age;
  return Math.max(0, remaining);
}

/**
 * Get stored ID token directly (for compatibility with existing code)
 * @returns ID token or null
 */
export async function getIdToken(): Promise<string | null> {
  try {
    const session = await getUserSession();
    return session?.idToken || null;
  } catch {
    return null;
  }
}

/**
 * Update just the ID token (useful for token refresh)
 * @param idToken - New ID token
 */
export async function updateIdToken(idToken: string): Promise<void> {
  try {
    const session = await getUserSession();
    if (!session) {
      throw new Error("No session to update");
    }

    // Update session with new token
    await storeUserSession(
      session.user as any, // Type coercion for compatibility
      idToken,
      session.refreshToken
    );

    console.log("[SecureTokenStorage] ID token updated successfully");
  } catch (error) {
    console.error("[SecureTokenStorage] Failed to update ID token:", error);
    throw new Error("Failed to update ID token");
  }
}

/**
 * Check if a user session exists
 */
export async function hasStoredSession(): Promise<boolean> {
  try {
    const session = await AsyncStorage.getItem(STORAGE_KEYS.USER_SESSION);
    return session !== null;
  } catch {
    return false;
  }
}
