import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Key for storing Google OAuth token for JS SDK auth
export const GOOGLE_OAUTH_TOKEN_KEY = "@google_oauth_id_token";

type AuthContextType = {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

/**
 * Auth provider that manages Firebase auth state.
 * Wraps the app and provides user/auth methods via context.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  /**
   * Sign in with Google.
   * Opens native Google sign-in UI, then authenticates with Firebase.
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

      // Store Google OAuth token for JS SDK auth sync
      await AsyncStorage.setItem(GOOGLE_OAUTH_TOKEN_KEY, idToken);

      // Create Firebase credential and sign in
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(googleCredential);

      console.log("[AuthContext] Google sign-in successful");
    } catch (error) {
      console.error("[AuthContext] Google sign-in failed:", error);
      throw error;
    }
  }, []);

  /**
   * Sign out from both Firebase and Google.
   */
  const signOut = useCallback(async () => {
    try {
      // Clear stored Google OAuth token
      await AsyncStorage.removeItem(GOOGLE_OAUTH_TOKEN_KEY);
      await GoogleSignin.signOut();
      await auth().signOut();
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
