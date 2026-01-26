import { Stack } from "expo-router";

/**
 * Debug route group layout.
 * Contains development-only screens for debugging.
 */
export default function DebugLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="debug" />
      <Stack.Screen name="cf" />
      <Stack.Screen name="sync" />
    </Stack>
  );
}
