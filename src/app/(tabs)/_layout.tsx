import { Tabs } from "expo-router";
import { FloatingTabBar } from "@/shared/components";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="library" options={{ title: "Library" }} />
      <Tabs.Screen name="browse" options={{ title: "Browse" }} />
      <Tabs.Screen name="updates" options={{ title: "History" }} />
      <Tabs.Screen name="settings" options={{ title: "More" }} />
    </Tabs>
  );
}
