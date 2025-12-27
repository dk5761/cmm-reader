import "../global.css";

import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryProvider } from "@/core/providers";
import { SessionProvider } from "@/shared/contexts/SessionContext";
import { WebViewFetcherProvider } from "@/shared/contexts/WebViewFetcherContext";
import { DatabaseProvider } from "@/core/database";
import { UpdateScreen } from "@/shared/components/UpdateScreen";

export default function RootLayout() {
  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <DatabaseProvider>
          <QueryProvider>
            <SessionProvider>
              <WebViewFetcherProvider>
                <Stack
                  screenOptions={{
                    headerShown: true,
                    headerStyle: { backgroundColor: "#0a0a0f" },
                    headerTintColor: "#fff",
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
                </Stack>

                {/* Force Update Screen - blocks app until update is applied */}
                <UpdateScreen />
              </WebViewFetcherProvider>
            </SessionProvider>
          </QueryProvider>
        </DatabaseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
