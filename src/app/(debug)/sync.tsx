import { View, Text, useColorScheme } from "react-native";

/**
 * Debug sync queue screen.
 * TODO: Implement sync queue debugging interface.
 */
export default function DebugSyncScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View
      className="flex-1 items-center justify-center px-6"
      style={{ backgroundColor: isDark ? "#0a0a0f" : "#ffffff" }}
    >
      <Text
        className="text-xl font-semibold"
        style={{ color: isDark ? "#fff" : "#000" }}
      >
        Debug Sync Queue
      </Text>
      <Text
        className="text-sm mt-4 opacity-60 text-center"
        style={{ color: isDark ? "#fff" : "#000" }}
      >
        Sync queue debugging coming soon
      </Text>
    </View>
  );
}
