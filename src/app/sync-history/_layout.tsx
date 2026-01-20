import { Stack, useRouter } from "expo-router";
import { useCSSVariable } from "uniwind";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function SyncHistoryLayout() {
  const bgColor = useCSSVariable("--color-background");
  const fgColor = useCSSVariable("--color-foreground");

  const backgroundColor = typeof bgColor === "string" ? bgColor : "#000";
  const foregroundColor = typeof fgColor === "string" ? fgColor : "#fff";

  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor,
        },
        headerTintColor: foregroundColor,
        headerTitleStyle: {
          fontWeight: "bold",
        },
        headerShadowVisible: false,
        headerBackVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Sync History",
          headerShown: true,
          presentation: "card",
          headerLeft: () => (
            <Pressable onPress={() => router.navigate("/(tabs)/settings")} hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={foregroundColor} />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: "Sync Details",
          headerShown: true,
          presentation: "card",
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={foregroundColor} />
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}