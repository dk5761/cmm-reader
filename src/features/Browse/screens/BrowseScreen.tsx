import { useMemo } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import axios from "axios";
import { SearchBar } from "@/shared/components/SearchBar";
import { SourceCard, type SourceCardData } from "../components/SourceCard";
import { useBrowseStore } from "../stores/useBrowseStore";
import { getAllSources } from "@/sources";

export function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { searchQuery, setSearchQuery } = useBrowseStore();

  // Get real sources
  const sources = getAllSources();

  const filteredSources: SourceCardData[] = useMemo(() => {
    const sourceList = sources.map((s) => ({
      id: s.id,
      name: s.name,
      icon: s.config.icon,
      logo: s.config.logo,
      language: s.config.language,
    }));
    if (!searchQuery.trim()) return sourceList;
    return sourceList.filter((src) =>
      src.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, sources]);

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
        {/* Search Bar */}
        <View className="py-3">
          <SearchBar
            placeholder="Search sources..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
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
          {filteredSources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              onView={() => handleView(source.id)}
            />
          ))}

          {/* Empty state */}
          {filteredSources.length === 0 && (
            <Text className="text-muted text-sm text-center py-8">
              No sources found
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
