import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import axios from "axios";
import { SourceCard, type SourceCardData } from "../components/SourceCard";
import { getAvailableSources } from "@/sources";
import { useAppSettingsStore } from "@/shared/stores";

export function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showNsfwSources } = useAppSettingsStore();

  // Get sources filtered by NSFW preference
  const sources = getAvailableSources(showNsfwSources);

  // Map sources to display format
  const sourceList: SourceCardData[] = sources.map((s) => ({
    id: s.id,
    name: s.name,
    icon: s.config.icon,
    logo: s.config.logo,
    language: s.config.language,
  }));

  const handleView = (id: string) => {
    router.push(`/source/${id}`);
  };

  const testAxios = async () => {
    try {
      console.log("[Test] Calling JSONPlaceholder API...");
      const response = await axios.get(
        "https://jsonplaceholder.typicode.com/todos/1"
      );
      console.log("[Test] Response:", response.data);
      Alert.alert("Success!", JSON.stringify(response.data, null, 2));
    } catch (error: any) {
      console.log("[Test] Error:", error.message);
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Global Search Button */}
        <View className="px-4 pb-3">
          <Pressable
            onPress={() => router.push("/global-search")}
            className="bg-surface border border-border rounded-lg p-4 flex-row items-center"
          >
            <View className="flex-1">
              <Text className="text-foreground font-semibold text-base mb-1">
                🔍 Search All Sources
              </Text>
              <Text className="text-muted text-sm">
                Find manga across all sources at once
              </Text>
            </View>
            <Text className="text-primary text-2xl">→</Text>
          </Pressable>
        </View>

        {/* Test Axios Button */}
        {/* <View className="px-4 py-2">
          <Pressable
            onPress={testAxios}
            className="bg-primary px-4 py-3 rounded-lg"
          >
            <Text className="text-black text-center font-semibold">
              Test Axios (JSONPlaceholder)
            </Text>
          </Pressable>
        </View> */}

        {/* Sources Section */}
        <View className="mt-2">
          {/* Section Header */}
          <View className="px-4 py-2">
            <Text className="text-muted text-xs font-semibold uppercase tracking-wider">
              Sources
            </Text>
          </View>

          {/* Sources List */}
          {sourceList.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              onView={() => handleView(source.id)}
            />
          ))}

          {/* Empty state */}
          {sourceList.length === 0 && (
            <Text className="text-muted text-sm text-center py-8">
              No sources found
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
