import { useMemo } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import {
  useLibraryStore,
  SortBy,
  LibraryCategory,
} from "../stores/useLibraryStore";
import { useLibraryManga } from "../hooks";
import { getAllSources, isNsfwSource } from "@/sources";
import { useAppSettingsStore } from "@/shared/stores";
import { LIBRARY_FILTERS } from "../data/mockData";

const SORT_OPTIONS: {
  value: SortBy;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "title", label: "Title", icon: "text-outline" },
  { value: "lastRead", label: "Last Read", icon: "time-outline" },
  { value: "dateAdded", label: "Date Added", icon: "calendar-outline" },
  { value: "unread", label: "Unread Count", icon: "layers-outline" },
  { value: "latestChapter", label: "Latest Chapter", icon: "flash-outline" },
];

const CATEGORY_OPTIONS: {
  value: LibraryCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "All", label: "All", icon: "library-outline" },
  { value: "Reading", label: "Reading", icon: "book-outline" },
  { value: "Completed", label: "Completed", icon: "checkmark-circle-outline" },
  { value: "Plan to Read", label: "Plan to Read", icon: "bookmark-outline" },
  { value: "On Hold", label: "On Hold", icon: "pause-circle-outline" },
  { value: "Dropped", label: "Dropped", icon: "close-circle-outline" },
];

type FilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  disabled?: boolean;
};

export function FilterSheet({
  visible,
  onClose,
  disabled = false,
}: FilterSheetProps) {
  const foregroundColor = useCSSVariable("--color-foreground");
  const primaryColor = useCSSVariable("--color-primary");
  const mutedColor = useCSSVariable("--color-muted");
  const foreground =
    typeof foregroundColor === "string" ? foregroundColor : "#fff";
  const primary = typeof primaryColor === "string" ? primaryColor : "#8b5cf6";
  const muted = typeof mutedColor === "string" ? mutedColor : "#71717a";

  const {
    activeCategory,
    setActiveCategory,
    activeSource,
    setActiveSource,
    sortBy,
    setSortBy,
    sortAscending,
    toggleSortOrder,
  } = useLibraryStore();

  const { showNsfwSources } = useAppSettingsStore();
  const libraryManga = useLibraryManga();

  // Get sources that exist in library, filtering out NSFW if toggle is off
  const availableSources = useMemo(() => {
    const allSources = getAllSources();
    const sourceIdsInLibrary = new Set(libraryManga.map((m) => m.sourceId));

    return allSources.filter((source) => {
      // Must have manga in library
      if (!sourceIdsInLibrary.has(source.id)) return false;
      // Hide NSFW sources if toggle is off
      if (!showNsfwSources && isNsfwSource(source.id)) return false;
      return true;
    });
  }, [libraryManga, showNsfwSources]);

  const sourceOptions = [
    { id: "all", name: "All Sources" },
    ...availableSources,
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose}>
        <Pressable
          className="bg-surface rounded-t-2xl max-h-[80%]"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View className="items-center pt-3 pb-2">
            <View className="w-10 h-1 bg-muted/50 rounded-full" />
          </View>

          {/* Title */}
          <View className="flex-row items-center justify-between px-4 pb-3">
            <Text className="text-foreground text-lg font-bold">Filters</Text>
            <Pressable
              onPress={() => {
                setActiveCategory("All");
                setActiveSource("all");
              }}
              className="px-3 py-1.5 bg-background rounded-full"
            >
              <Text className="text-muted text-sm">Reset</Text>
            </Pressable>
          </View>

          <ScrollView className="pb-6" showsVerticalScrollIndicator={false}>
            {/* Status/Category Section */}
            <View className="px-4 pb-4">
              <Text className="text-muted text-xs font-semibold uppercase tracking-wide mb-3">
                Status
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((option) => {
                  const isSelected = activeCategory === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() =>
                        !disabled && setActiveCategory(option.value)
                      }
                      disabled={disabled}
                      className={`flex-row items-center px-3 py-2 rounded-lg border ${
                        isSelected
                          ? "bg-primary/20 border-primary"
                          : "bg-background border-border-subtle"
                      }`}
                    >
                      <Ionicons
                        name={option.icon}
                        size={16}
                        color={isSelected ? primary : muted}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        className={`text-sm font-medium ${
                          isSelected ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Source Section - only show if multiple sources */}
            {availableSources.length >= 2 && (
              <View className="px-4 pb-4">
                <Text className="text-muted text-xs font-semibold uppercase tracking-wide mb-3">
                  Source
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {sourceOptions.map((source) => {
                    const isSelected = activeSource === source.id;
                    return (
                      <Pressable
                        key={source.id}
                        onPress={() => !disabled && setActiveSource(source.id)}
                        disabled={disabled}
                        className={`flex-row items-center px-3 py-2 rounded-lg border ${
                          isSelected
                            ? "bg-accent/20 border-accent"
                            : "bg-background border-border-subtle"
                        }`}
                      >
                        {source.id !== "all" && (
                          <Ionicons
                            name="globe-outline"
                            size={14}
                            color={isSelected ? primary : muted}
                            style={{ marginRight: 6 }}
                          />
                        )}
                        <Text
                          className={`text-sm font-medium ${
                            isSelected ? "text-accent" : "text-foreground"
                          }`}
                        >
                          {source.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Sort Section */}
            <View className="px-4 pb-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-muted text-xs font-semibold uppercase tracking-wide">
                  Sort By
                </Text>
                <Pressable
                  onPress={toggleSortOrder}
                  className="flex-row items-center gap-1 px-2 py-1 bg-background rounded-full"
                >
                  <Ionicons
                    name={sortAscending ? "arrow-up" : "arrow-down"}
                    size={14}
                    color={foreground}
                  />
                  <Text className="text-foreground text-xs">
                    {sortAscending ? "Asc" : "Desc"}
                  </Text>
                </Pressable>
              </View>
              <View className="gap-1">
                {SORT_OPTIONS.map((option) => {
                  const isSelected = sortBy === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        setSortBy(option.value);
                      }}
                      className={`flex-row items-center px-3 py-3 rounded-lg ${
                        isSelected ? "bg-primary/10" : "active:bg-background"
                      }`}
                    >
                      <View
                        className="w-8 h-8 rounded-full items-center justify-center mr-3"
                        style={{
                          backgroundColor: isSelected
                            ? `${primary}20`
                            : "#6b728020",
                        }}
                      >
                        <Ionicons
                          name={option.icon}
                          size={18}
                          color={isSelected ? primary : foreground}
                        />
                      </View>
                      <Text
                        className="flex-1 font-medium"
                        style={{ color: isSelected ? primary : foreground }}
                      >
                        {option.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={20} color={primary} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Bottom padding for safe area */}
            <View className="h-6" />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
