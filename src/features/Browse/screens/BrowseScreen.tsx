import { useState, useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchBar } from "@/shared/components/SearchBar";
import { ExtensionCard } from "../components";
import { MOCK_EXTENSIONS } from "../data/mockData";
import { useBrowseStore } from "../stores/useBrowseStore";

export function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const { searchQuery, setSearchQuery } = useBrowseStore();

  const filteredExtensions = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_EXTENSIONS;
    return MOCK_EXTENSIONS.filter((ext) =>
      ext.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleView = (id: string) => {
    console.log("View source:", id);
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

        {/* Sources Section */}
        <View className="mt-2">
          {/* Section Header */}
          <View className="px-4 py-2">
            <Text className="text-muted text-xs font-semibold uppercase tracking-wider">
              Sources
            </Text>
          </View>

          {/* Extensions List */}
          {filteredExtensions.map((extension) => (
            <ExtensionCard
              key={extension.id}
              extension={extension}
              onView={() => handleView(extension.id)}
            />
          ))}

          {/* Empty state */}
          {filteredExtensions.length === 0 && (
            <Text className="text-muted text-sm text-center py-8">
              No sources found
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
