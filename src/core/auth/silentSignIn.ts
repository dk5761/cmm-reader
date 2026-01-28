/**
 * Silent Sign-In Helper
 *
 * Performs silent Google sign-in to refresh authentication tokens.
 * This is used by the TokenRefreshService to maintain valid sessions
 * without requiring user interaction.
 *
 * Flow:
 * 1. Call GoogleSignin.signInSilently() to get a fresh ID token
 * 2. Get Firebase JS SDK auth instance
 * 3. Create Google credential from the ID token
 * 4. Sign in to Firebase JS SDK with the credential
 */

import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential, type User } from "firebase/auth";
import { getFirebaseClient } from "@/core/sync/firebase/FirebaseClient";

/**
 * Perform silent Google sign-in to refresh the Firebase auth token
 *
 * @returns true if silent sign-in succeeded, false otherwise
 */
export async function silentSignIn(): Promise<boolean> {
  try {
    // Step 1: Check if Google Sign-In is configured
    const isConfigured = await GoogleSignin.hasPlayServices();
    if (!isConfigured) {
      console.warn("[silentSignIn] Google Play Services not available");
      return false;
    }

    // Step 2: Perform silent sign-in to get fresh ID token
    console.log("[silentSignIn] Attempting silent Google sign-in...");
    const signInResult = await GoogleSignin.signInSilently();

    if (!signInResult) {
      console.warn("[silentSignIn] No result from silent sign-in");
      return false;
    }

    // Get ID token from the result
    const idToken = signInResult.data?.idToken;
    if (!idToken) {
      console.warn("[silentSignIn] No ID token in silent sign-in result");
      return false;
    }

    console.log("[silentSignIn] Got fresh ID token from Google");

    // Step 3: Get Firebase JS SDK auth instance
    const firebaseClient = getFirebaseClient();
    const auth = firebaseClient.getAuth();

    // Step 4: Create Google credential and sign in
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);

    console.log("[silentSignIn] Successfully refreshed Firebase auth:", result.user.uid);

    // Step 5: Store the new ID token for future use (for auth bridging compatibility during migration)
    // Note: This can be removed after full migration is complete
    try {
      const { GOOGLE_OAUTH_TOKEN_KEY } = require("./AuthContext");
      const AsyncStorage = require("@react-native-async-storage/async-storage").default;
      await AsyncStorage.setItem(GOOGLE_OAUTH_TOKEN_KEY, idToken);
      console.log("[silentSignIn] Updated stored ID token");
    } catch {
      // Ignore if storage fails or key doesn't exist yet
    }

    return true;
  } catch (error: unknown) {
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes("SIGN_IN_REQUIRED")) {
        console.warn("[silentSignIn] User needs to sign in again (session expired)");
      } else if (error.message.includes("NETWORK_ERROR")) {
        console.warn("[silentSignIn] Network error during silent sign-in");
      } else {
        console.error("[silentSignIn] Silent sign-in failed:", error.message);
      }
    } else {
      console.error("[silentSignIn] Unknown error during silent sign-in");
    }

    return false;
  }
}

/**
 * Check if the current user has a valid session
 * Can be used to determine if silent sign-in is likely to succeed
 *
 * @returns true if user is currently signed in
 */
export async function isUserSignedIn(): Promise<boolean> {
  try {
    const currentUser = await GoogleSignin.getCurrentUser();
    return currentUser !== null;
  } catch {
    return false;
  }
}

/**
 * Get the current Firebase user from the JS SDK
 *
 * @returns The current Firebase user or null
 */
export function getCurrentFirebaseUser(): User | null {
  try {
    const firebaseClient = getFirebaseClient();
    const auth = firebaseClient.getAuth();
    return auth.currentUser;
  } catch {
    return null;
  }
}
