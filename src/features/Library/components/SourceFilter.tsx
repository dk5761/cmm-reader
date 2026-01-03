import { memo, useMemo } from "react";
import { ScrollView, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLibraryStore } from "../stores/useLibraryStore";
import { useLibraryManga } from "../hooks";
import { getAllSources } from "@/sources";

type SourceFilterProps = {
  disabled?: boolean;
};

/**
 * Filter chips for filtering library by source.
 * Only shows sources that have manga in the library.
 */
export const SourceFilter = memo(function SourceFilter({
  disabled = false,
}: SourceFilterProps) {
  const activeSource = useLibraryStore((s) => s.activeSource);
  const setActiveSource = useLibraryStore((s) => s.setActiveSource);
  const libraryManga = useLibraryManga();

  // Get sources that exist in library
  const availableSources = useMemo(() => {
    const allSources = getAllSources();
    const sourceIdsInLibrary = new Set(libraryManga.map((m) => m.sourceId));

    return allSources.filter((source) => sourceIdsInLibrary.has(source.id));
  }, [libraryManga]);

  // Don't render if only one source or no manga
  if (availableSources.length < 2) {
    return null;
  }

  const allOption = { id: "all", name: "All Sources" };
  const options = [allOption, ...availableSources];

  return (
    <View style={disabled ? { opacity: 0.5 } : undefined}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        className="py-1"
      >
        {options.map((source) => {
          const isActive = source.id === activeSource;
          return (
            <Pressable
              key={source.id}
              onPress={() => !disabled && setActiveSource(source.id)}
              disabled={disabled}
              className={`flex-row items-center px-3 py-1 rounded-full border ${
                isActive
                  ? "bg-accent border-accent"
                  : "bg-card border-border-subtle"
              }`}
            >
              {source.id !== "all" && (
                <Ionicons
                  name="globe-outline"
                  size={12}
                  color={isActive ? "#fff" : "#71717a"}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                className={`text-xs font-medium ${
                  isActive ? "text-white" : "text-muted"
                }`}
              >
                {source.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});
