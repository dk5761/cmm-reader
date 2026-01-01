import { Stack, useLocalSearchParams } from "expo-router";
import { HistoryDetailScreen } from "@/features/History";
import { useCSSVariable } from "uniwind";

export default function HistoryDetailRoute() {
  const params = useLocalSearchParams();
  const mangaTitle = params.mangaTitle as string;

  const bgColor = useCSSVariable("--color-background");
  const fgColor = useCSSVariable("--color-foreground");

  const backgroundColor = typeof bgColor === "string" ? bgColor : "#000";
  const foregroundColor = typeof fgColor === "string" ? fgColor : "#fff";

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: mangaTitle || "Reading History",
          headerTransparent: false,
          headerStyle: { backgroundColor },
          headerTintColor: foregroundColor,
          headerShadowVisible: false,
        }}
      />
      <HistoryDetailScreen />
    </>
  );
}
