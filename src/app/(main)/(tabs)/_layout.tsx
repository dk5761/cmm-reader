import { Tabs } from "expo-router";
import { useCSSVariable } from "uniwind";
import { FloatingTabBar } from "@/shared/components";

export default function TabLayout() {
  const bgColor = useCSSVariable("--color-background");
  const fgColor = useCSSVariable("--color-foreground");

  const backgroundColor = typeof bgColor === "string" ? bgColor : "#000";
  const foregroundColor = typeof fgColor === "string" ? fgColor : "#fff";

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor },
        headerTintColor: foregroundColor,
        headerTitleStyle: { fontWeight: "bold" },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="library" options={{ title: "Library" }} />
      <Tabs.Screen name="browse" options={{ title: "Browse" }} />
      <Tabs.Screen name="history" options={{ title: "History" }} />
      <Tabs.Screen name="settings" options={{ title: "More" }} />
    </Tabs>
  );
}
