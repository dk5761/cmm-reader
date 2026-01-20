import "../global.css";

import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Uniwind } from "uniwind";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { QueryProvider } from "@/core/providers";
import { SessionProvider } from "@/shared/contexts/SessionContext";
import { WebViewFetcherProvider } from "@/shared/contexts/WebViewFetcherContext";
import { DownloadProvider } from "@/shared/contexts/DownloadContext";
import { DatabaseProvider } from "@/core/database";
import { UpdateScreen } from "@/shared/components/UpdateScreen";
import { requestNotificationPermissions } from "@/shared/services/notifications";
import { pruneCache } from "@/core/services/ImageCacheService";
import { AuthProvider, useAuth } from "@/shared/contexts/AuthContext";

// Keep splash screen visible while app loads
SplashScreen.preventAutoHideAsync();

// Force dark theme and disable adaptive mode
if (typeof Uniwind !== 'undefined') {
  Uniwind.setTheme('dark');
}

function AuthGate() {
  const { isLoading, isAuthenticated } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inLoginGroup = segments[0] === "login";

    if (!isAuthenticated && !inLoginGroup) {
      // Redirect to login if not authenticated
      router.replace("/login");
    } else if (isAuthenticated && inLoginGroup) {
      // Redirect to main app if authenticated and on login
      router.replace("/(tabs)/library");
    }
  }, [isLoading, isAuthenticated, segments]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#00d9ff" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  // Request notification permissions, hide splash, and clean cache
  useEffect(() => {
    requestNotificationPermissions();

    // Prune image cache (500MB limit)
    pruneCache(500).catch(err => console.error("Failed to prune cache:", err));

    // Hide splash screen after a brief delay to ensure providers are ready
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <AuthProvider>
          <DatabaseProvider>
            <QueryProvider>
              <SessionProvider>
                <DownloadProvider>
                  <WebViewFetcherProvider>
                    <AuthGate />

                    {/* Force Update Screen - blocks app until update is applied */}
                    <UpdateScreen />
                  </WebViewFetcherProvider>
                </DownloadProvider>
              </SessionProvider>
            </QueryProvider>
          </DatabaseProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
