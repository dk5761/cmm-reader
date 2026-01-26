import { Stack, useLocalSearchParams } from "expo-router";
import { MangaDetailScreen } from "@/features/Manga";
import { useCSSVariable } from "uniwind";

export default function MangaDetailRoute() {
  const bgColor = useCSSVariable("--color-background");
  const fgColor = useCSSVariable("--color-foreground");

  const backgroundColor = typeof bgColor === "string" ? bgColor : "#000";
  const foregroundColor = typeof fgColor === "string" ? fgColor : "#fff";

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerTransparent: false,
          headerStyle: { backgroundColor },
          headerTintColor: foregroundColor,
          headerShadowVisible: false,
        }}
      />
      <MangaDetailScreen />
    </>
  );
}
