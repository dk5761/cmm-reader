import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";

type SettingItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
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
        {subtitle && (
          <Text className="text-muted text-xs mt-0.5">{subtitle}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={muted} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      <View
        className="px-4 border-b border-border"
        style={{ paddingTop: insets.top + 8, paddingBottom: 12 }}
      >
        <Text className="text-foreground text-2xl font-bold">More</Text>
        <Text className="text-muted text-sm mt-1">Settings & preferences</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Debug Section */}
        <View className="mt-4">
          <Text className="text-muted text-xs font-bold uppercase px-4 mb-2">
            Developer
          </Text>
          <SettingItem
            icon="bug-outline"
            title="Debug Realm Database"
            subtitle="View all stored manga and chapters"
            onPress={() => router.push("/(tabs)/debug")}
          />
        </View>
      </ScrollView>
    </View>
  );
}
