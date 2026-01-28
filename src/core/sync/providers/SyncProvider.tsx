/**
 * Sync Provider
 *
 * Provider component that manages the Firebase sync system lifecycle.
 * Initializes Firebase when the app starts and manages sync based on auth state.
 *
 * This should be wrapped around the authenticated portion of the app.
 */

import { useEffect, useState, useRef } from "react";
import type React from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { initializeFirebase, refreshAuthentication } from "../firebase/FirebaseClient";
import { isFirebaseConfigured } from "../firebase/firebaseConfig";
import { useRealm } from "@realm/react";
import { useAuth } from "@/core/auth";

type SyncProviderProps = {
  children: React.ReactNode;
};

type SyncState = "initializing" | "ready" | "error";

export function SyncProvider({ children }: SyncProviderProps) {
  const { user } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>("initializing");
  const [error, setError] = useState<string | null>(null);
  const realm = useRealm();
  const firebaseInitializedRef = useRef(false);

  // Initialize Firebase once
  useEffect(() => {
    let mounted = true;

    async function initializeSync() {
      // Only initialize once
      if (firebaseInitializedRef.current) {
        return;
      }

      try {
        console.log("[SyncProvider] Initializing Firebase sync system...");

        // Check if Firebase is configured
        if (!isFirebaseConfigured()) {
          console.warn("[SyncProvider] Firebase not configured, sync will be disabled");
          setSyncState("ready");
          firebaseInitializedRef.current = true;
          return;
        }

        // Initialize Firebase (JS SDK)
        await initializeFirebase();

        console.log("[SyncProvider] Firebase initialized successfully");
        firebaseInitializedRef.current = true;
        if (mounted) {
          setSyncState("ready");
        }
      } catch (err) {
        console.error("[SyncProvider] Firebase initialization failed:", err);
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to initialize Firebase");
          setSyncState("error");
        }
        firebaseInitializedRef.current = true;
      }
    }

    initializeSync();

    return () => {
      mounted = false;
    };
  }, []);

  // Refresh authentication when user signs in or out
  useEffect(() => {
    if (!firebaseInitializedRef.current || !isFirebaseConfigured()) {
      return;
    }

    async function handleUserChange() {
      if (user) {
        console.log("[SyncProvider] User signed in, refreshing sync authentication...");
        try {
          await refreshAuthentication();
          console.log("[SyncProvider] Sync authentication refreshed successfully");
        } catch (err) {
          console.warn("[SyncProvider] Failed to refresh sync authentication:", err);
        }
      } else {
        console.log("[SyncProvider] User signed out");
      }
    }

    handleUserChange();
  }, [user?.uid]);

  // Render children when ready, or show loading/error state
  if (syncState === "initializing") {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
        <Text className="text-muted mt-4">Setting up sync...</Text>
      </View>
    );
  }

  if (syncState === "error") {
    return (
      <View className="flex-1 items-center justify-center bg-background p-8">
        <Text className="text-red-500 text-lg mb-2">Sync Error</Text>
        <Text className="text-muted text-center">{error}</Text>
      </View>
    );
  }

  // Ready - render children
  return <>{children}</>;
}

/**
 * Hook to access Firebase auth state for sync
 */
export function useFirebaseSync() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(isFirebaseConfigured());
  }, []);

  return {
    isConfigured: isReady,
    isAvailable: isFirebaseConfigured(),
  };
}
