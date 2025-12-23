import "../global.css";

import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryProvider } from "@/core/providers";
import { SessionProvider } from "@/shared/contexts/SessionContext";

export default function RootLayout() {
  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <QueryProvider>
          <SessionProvider>
            <Stack
              screenOptions={{
                headerShown: false,
              }}
            />
          </SessionProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
