import { useState, useEffect } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { useCSSVariable } from "uniwind";
import type { PublisherFilter, SortOption } from "@/sources/base/types";

const PUBLISHER_OPTIONS: { value: PublisherFilter; label: string }[] = [
  { value: "all", label: "All Publishers" },
  { value: "Marvel", label: "Marvel" },
  { value: "DC-Comics", label: "DC Comics" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "", label: "Alphabetical" },
  { value: "MostPopular", label: "Most Popular" },
  { value: "LatestUpdate", label: "Latest Update" },
  { value: "Newest", label: "Newest" },
];

type SourceFilterSheetProps = {
  visible: boolean;
  publisher: PublisherFilter;
  sort: SortOption;
  onApply: (filters: { publisher: PublisherFilter; sort: SortOption }) => void;
  onClose: () => void;
};

export function SourceFilterSheet({
  visible,
  publisher,
  sort,
  onApply,
  onClose,
}: SourceFilterSheetProps) {
  const foregroundColor = useCSSVariable("--color-foreground");
  const primaryColor = useCSSVariable("--color-primary");
  const foreground =
    typeof foregroundColor === "string" ? foregroundColor : "#fff";
  const primary = typeof primaryColor === "string" ? primaryColor : "#8b5cf6";

  // Local state for selections
  const [localPublisher, setLocalPublisher] =
    useState<PublisherFilter>(publisher);
  const [localSort, setLocalSort] = useState<SortOption>(sort);

  // Sync local state when props change
  useEffect(() => {
    setLocalPublisher(publisher);
    setLocalSort(sort);
  }, [publisher, sort, visible]);

  const handleApply = () => {
    onApply({ publisher: localPublisher, sort: localSort });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose}>
        <Pressable
          className="bg-surface rounded-t-2xl"
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
              onPress={handleApply}
              className="px-4 py-1.5 bg-primary rounded-full"
            >
              <Text className="text-black font-semibold text-sm">Apply</Text>
            </Pressable>
          </View>

          {/* Publisher Section */}
          <View className="px-4 pb-4">
            <Text className="text-muted text-sm font-medium mb-2">
              Publisher
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {PUBLISHER_OPTIONS.map((option) => {
                const isSelected = localPublisher === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setLocalPublisher(option.value)}
                    className={`px-4 py-2 rounded-full border ${
                      isSelected
                        ? "bg-primary border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        isSelected ? "text-black" : "text-foreground"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Sort Section */}
          <View className="px-4 pb-6">
            <Text className="text-muted text-sm font-medium mb-2">Sort By</Text>
            <View className="gap-1">
              {SORT_OPTIONS.map((option) => {
                const isSelected = localSort === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setLocalSort(option.value)}
                    className="flex-row items-center py-3 px-2 rounded-lg active:bg-background/50"
                  >
                    <View
                      className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                        isSelected ? "border-primary" : "border-muted"
                      }`}
                    >
                      {isSelected && (
                        <View className="w-3 h-3 rounded-full bg-primary" />
                      )}
                    </View>
                    <Text
                      style={{ color: isSelected ? primary : foreground }}
                      className="font-medium"
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
