import "../global.css";

import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { QueryProvider } from "@/core/providers";
import { SessionProvider } from "@/shared/contexts/SessionContext";
import { WebViewFetcherProvider } from "@/shared/contexts/WebViewFetcherContext";
import { DownloadProvider } from "@/shared/contexts/DownloadContext";
import { DatabaseProvider } from "@/core/database";
import { UpdateScreen } from "@/shared/components/UpdateScreen";
import { requestNotificationPermissions } from "@/shared/services/notifications";
import { AuthProvider, AuthGuard, configureGoogleSignIn } from "@/core/auth";
import { pruneCache } from "@/core/services/ImageCacheService";
import { SyncProvider } from "@/core/sync";

// Keep splash screen visible while app loads
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      configureGoogleSignIn();
      requestNotificationPermissions();

      // Prune image cache (500MB limit)
      pruneCache(500).catch(err => console.error("Failed to prune cache:", err));

      setReady(true);
    }

    prepare();
  }, []);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <DatabaseProvider>
          <QueryProvider>
            <AuthProvider>
              <AuthGuard>
                <SyncProvider>
                  <SessionProvider>
                    <DownloadProvider>
                      <WebViewFetcherProvider>
                      <Stack
                        screenOptions={{
                          headerShown: true,
                          headerStyle: {
                            backgroundColor: isDark ? "#0a0a0f" : "#ffffff",
                          },
                          headerTintColor: isDark ? "#fff" : "#000",
                          headerTitleStyle: { fontWeight: "600" },
                          headerShadowVisible: false,
                          headerBackTitle: "",
                        }}
                      >
                        {/* Auth routes - shown when not authenticated */}
                        <Stack.Screen
                          name="(auth)"
                          options={{ headerShown: false }}
                        />
                        {/* Main protected app routes - shown when authenticated */}
                        <Stack.Screen
                          name="(main)"
                          options={{ headerShown: false }}
                        />
                        {/* Debug routes - development only */}
                        <Stack.Screen
                          name="(debug)"
                          options={{ headerShown: false }}
                        />
                      </Stack>

                      {/* Force Update Screen - blocks app until update is applied */}
                      <UpdateScreen />
                    </WebViewFetcherProvider>
                  </DownloadProvider>
                </SessionProvider>
              </SyncProvider>
            </AuthGuard>
          </AuthProvider>
          </QueryProvider>
        </DatabaseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
