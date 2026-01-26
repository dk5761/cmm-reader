import { Stack } from "expo-router";
import { useCSSVariable } from "uniwind";

export default function BrowseStackLayout() {
  const bgColor = useCSSVariable("--color-background");
  const fgColor = useCSSVariable("--color-foreground");

  const backgroundColor = typeof bgColor === "string" ? bgColor : "#000";
  const foregroundColor = typeof fgColor === "string" ? fgColor : "#fff";

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor },
        headerTintColor: foregroundColor,
        headerTitleStyle: { fontWeight: "bold" },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[sourceId]" options={{ title: "Source", headerBackTitle: "Browse" }} />
      <Stack.Screen name="global-search" options={{ title: "Search", headerBackTitle: "Browse" }} />
    </Stack>
  );
}
