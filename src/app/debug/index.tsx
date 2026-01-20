import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { useQuery } from "@realm/react";
import { MangaSchema } from "@/core/database";

type SettingItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function SettingItem({ icon, title, subtitle, onPress }: SettingItemProps) {
  const mutedColor = useCSSVariable("--color-muted");
  const muted = typeof mutedColor === "string" ? mutedColor : "#71717a";

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-4 active:bg-surface/50"
    >
      <View className="w-10 h-10 bg-surface rounded-lg items-center justify-center mr-3">
        <Ionicons name={icon} size={20} color={muted} />
      </View>
      <View className="flex-1">
        <Text className="text-foreground font-medium">{title}</Text>
        <Text className="text-muted text-xs mt-0.5">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={muted} />
    </Pressable>
  );
}

export default function DebugMenuScreen() {
  const router = useRouter();
  const allManga = useQuery(MangaSchema);

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 16 }}
      >
        <View className="px-4 mb-4">
          <Text className="text-foreground text-sm">
            Select a debug utility to view detailed information
          </Text>
        </View>

        <SettingItem
          icon="bug-outline"
          title="Realm Database"
          subtitle={`${allManga.length} manga in library`}
          onPress={() => router.push("/debug/realm")}
        />

        <SettingItem
          icon="document-text-outline"
          title="CF Debug Logs"
          subtitle="View Cloudflare challenge logs"
          onPress={() => router.push("/debug/logs")}
        />
      </ScrollView>
    </View>
  );
}