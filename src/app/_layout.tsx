import "../global.css";

import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { QueryProvider } from "@/core/providers";
import { SessionProvider } from "@/shared/contexts/SessionContext";
import { WebViewFetcherProvider } from "@/shared/contexts/WebViewFetcherContext";
import { DatabaseProvider } from "@/core/database";
import { UpdateScreen } from "@/shared/components/UpdateScreen";
import { requestNotificationPermissions } from "@/shared/services/notifications";
import { AuthProvider, AuthGuard, configureGoogleSignIn } from "@/core/auth";

// Keep splash screen visible while app loads
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Request notification permissions, configure auth, and hide splash on startup
  useEffect(() => {
    configureGoogleSignIn();
    requestNotificationPermissions();
    // Hide splash screen after a brief delay to ensure providers are ready
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <DatabaseProvider>
          <QueryProvider>
            <AuthProvider>
              <AuthGuard>
                <SessionProvider>
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
                      {/* Hide header for tabs - tabs have their own headers */}
                      <Stack.Screen
                        name="(tabs)"
                        options={{ headerShown: false, title: "" }}
                      />
                      {/* Hide header for reader - full screen experience */}
                      <Stack.Screen
                        name="reader/[chapterId]"
                        options={{ headerShown: false }}
                      />
                      {/* Sign-in screen */}
                      <Stack.Screen
                        name="sign-in"
                        options={{ headerShown: false, title: "Sign In" }}
                      />
                    </Stack>

                    {/* Force Update Screen - blocks app until update is applied */}
                    <UpdateScreen />
                  </WebViewFetcherProvider>
                </SessionProvider>
              </AuthGuard>
            </AuthProvider>
          </QueryProvider>
        </DatabaseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
