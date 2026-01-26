import { Stack } from "expo-router";

/**
 * Auth route group layout.
 * These routes are accessible without authentication.
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sync" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
