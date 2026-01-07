import { useState, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCSSVariable } from "uniwind";
import { SearchBar, LibraryGridSkeleton } from "@/shared/components";
import { useGlobalSearch } from "../hooks/useGlobalSearch";
import { GlobalSearchResultSection } from "../components/GlobalSearchResultSection";
import { useDebounce } from "@/shared/hooks/useDebounce";

export function GlobalSearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();

  const [searchQuery, setSearchQuery] = useState(params.q || "");
  const [debouncedQuery] = useDebounce(searchQuery, 800);

  const fgColor = useCSSVariable("--color-foreground");
  const foreground = typeof fgColor === "string" ? fgColor : "#fff";

  const { results, isLoading, totalResults } = useGlobalSearch(
    debouncedQuery,
    true // enabled
  );

  // Debug logging
  useEffect(() => {
    console.log("[GlobalSearchScreen] State:", {
      searchQuery,
      debouncedQuery,
      isLoading,
      totalResults,
      resultsCount: results.length,
    });
  }, [searchQuery, debouncedQuery, isLoading, totalResults, results.length]);

  return (
    <View className="flex-1 bg-background">
      {/* Search Bar */}
      <View className="px-4 py-3">
        <SearchBar
          placeholder="Search all sources..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Search Info */}
      {debouncedQuery.trim() && !isLoading && (
        <View className="px-4 pb-2">
          <Text className="text-muted text-sm">
            {`Found ${totalResults} result${
                  totalResults !== 1 ? "s" : ""
                } across all sources`}
          </Text>
        </View>
      )}

      {/* Results */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {!debouncedQuery.trim() ? (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-muted text-base">
              Search for manga across all sources
            </Text>
            <Text className="text-muted/60 text-sm mt-2">
              Enter a title to get started
            </Text>
          </View>
        ) : isLoading && results.length === 0 ? (
          <LibraryGridSkeleton />
        ) : (
          <>
            {/* Render each source's results */}
            {results.map((result) => (
              <GlobalSearchResultSection
                key={result.sourceId}
                result={result}
              />
            ))}

            {/* No results state - only show if all sources finished loading */}
            {!isLoading && totalResults === 0 && (
              <View className="flex-1 items-center justify-center py-20">
                <Text className="text-muted text-base">No results found</Text>
                <Text className="text-muted/60 text-sm mt-2">
                  Try a different search term
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
