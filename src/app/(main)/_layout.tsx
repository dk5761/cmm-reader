import { Stack } from "expo-router";

/**
 * Main protected route group layout.
 * These routes require authentication (handled by root layout).
 */
export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="manga/[id]" options={{ headerBackTitle: "Back" }} />
      <Stack.Screen name="reader/[chapterId]" options={{ headerBackTitle: "Manga" }} />
    </Stack>
  );
}
