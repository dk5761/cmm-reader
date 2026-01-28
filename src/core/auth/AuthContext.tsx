/**
 * Auth Context
 *
 * Manages Firebase authentication using the Firebase JS SDK.
 * Provides auth state, sign-in/sign-out methods via React Context.
 *
 * This replaces the native Firebase Auth with the JS SDK for a unified auth system.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getAuth,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { getFirebaseClient } from "@/core/sync/firebase/FirebaseClient";
import { TokenRefreshService } from "./TokenRefreshService";
import {
  storeUserSession,
  getUserSession,
  clearUserSession,
  hasStoredSession,
} from "./SecureTokenStorage";

// Key for storing Google OAuth token (for compatibility during migration)
export const GOOGLE_OAUTH_TOKEN_KEY = "@google_oauth_id_token";

/**
 * Auth context type
 * Maintains the same API as the original native auth version
 */
type AuthContextType = {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

/**
 * Auth provider that manages Firebase auth state using JS SDK.
 * Wraps the app and provides user/auth methods via context.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth and listen to auth state changes
  useEffect(() => {
    let unsubscribe: Unsubscribe | null = null;
    let mounted = true;

    async function initializeAuth() {
      try {
        console.log("[AuthContext] Initializing Firebase JS SDK auth...");

        // Get Firebase client and auth instance
        const firebaseClient = getFirebaseClient();
        const auth = getAuth(firebaseClient.app);

        // Check for stored session to restore
        const hasSession = await hasStoredSession();
        if (hasSession) {
          console.log("[AuthContext] Found stored session, attempting restoration...");
          const storedSession = await getUserSession();
          if (storedSession) {
            console.log("[AuthContext] Restored session from storage:", storedSession.user.uid);
            // Note: Firebase JS SDK doesn't have a direct way to restore from a stored token
            // The onAuthStateChanged listener will handle this when the auth state is ready
          }
        }

        // Listen to auth state changes
        unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          if (!mounted) return;

          console.log("[AuthContext] Auth state changed:", firebaseUser?.uid || "null");

          if (firebaseUser) {
            setUser(firebaseUser);

            // Start token refresh service when user is signed in
            TokenRefreshService.start();
          } else {
            setUser(null);

            // Stop token refresh service when user is signed out
            TokenRefreshService.stop();
          }

          setLoading(false);
        });

        console.log("[AuthContext] Firebase JS SDK auth initialized");
      } catch (error) {
        console.error("[AuthContext] Auth initialization failed:", error);
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  /**
   * Sign in with Google.
   * Opens native Google sign-in UI, then authenticates with Firebase JS SDK.
   */
  const signInWithGoogle = useCallback(async () => {
    try {
      // Check Play Services availability (Android)
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      // Sign in with Google
      const signInResult = await GoogleSignin.signIn();

      // Get ID token
      const idToken = signInResult.data?.idToken;
      if (!idToken) {
        throw new Error("No ID token received from Google Sign-In");
      }

      console.log("[AuthContext] Got Google ID token, signing in to Firebase JS SDK...");

      // Store Google OAuth token for compatibility
      await AsyncStorage.setItem(GOOGLE_OAUTH_TOKEN_KEY, idToken);

      // Get Firebase auth instance from JS SDK
      const firebaseClient = getFirebaseClient();
      const auth = getAuth(firebaseClient.app);

      // Create Google credential and sign in to Firebase JS SDK
      const googleCredential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, googleCredential);

      console.log("[AuthContext] Google sign-in successful:", result.user.uid);

      // Store user session for persistence
      await storeUserSession(result.user, idToken);

      // User state will be updated by onAuthStateChanged listener
    } catch (error: unknown) {
      // Handle Google Sign-In errors
      const errorCode = (error as { code?: string }).code;
      if (errorCode === statusCodes.SIGN_IN_CANCELLED) {
        console.log("[AuthContext] Google sign-in was cancelled");
        throw new Error("Sign-in cancelled");
      } else if (errorCode === statusCodes.IN_PROGRESS) {
        console.log("[AuthContext] Google sign-in is already in progress");
        throw new Error("Sign-in already in progress");
      } else if (errorCode === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.error("[AuthContext] Google Play Services not available");
        throw new Error("Google Play Services not available");
      }

      console.error("[AuthContext] Google sign-in failed:", error);
      throw error;
    }
  }, []);

  /**
   * Sign out from both Firebase JS SDK and Google.
   */
  const signOut = useCallback(async () => {
    try {
      console.log("[AuthContext] Signing out...");

      // Stop token refresh service
      TokenRefreshService.stop();

      // Get Firebase auth instance and sign out
      const firebaseClient = getFirebaseClient();
      const auth = getAuth(firebaseClient.app);
      await firebaseSignOut(auth);

      // Sign out from Google
      await GoogleSignin.signOut();

      // Clear stored sessions
      await clearUserSession();
      await AsyncStorage.removeItem(GOOGLE_OAUTH_TOKEN_KEY);

      // Clear the hasHadUserSession flag
      await AsyncStorage.removeItem("@has_had_user_session");

      console.log("[AuthContext] Sign-out successful");
    } catch (error) {
      console.error("[AuthContext] Sign-out failed:", error);
      throw error;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context.
 * Returns { user, loading, signInWithGoogle, signOut }
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
