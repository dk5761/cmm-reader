import { useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { SortBy } from "../stores/useLibraryStore";

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

type SortSheetProps = {
  visible: boolean;
  currentSort: SortBy;
  sortAscending: boolean;
  onSelect: (sort: SortBy) => void;
  onToggleOrder: () => void;
  onClose: () => void;
};

export function SortSheet({
  visible,
  currentSort,
  sortAscending,
  onSelect,
  onToggleOrder,
  onClose,
}: SortSheetProps) {
  const foregroundColor = useCSSVariable("--color-foreground");
  const primaryColor = useCSSVariable("--color-primary");
  const foreground =
    typeof foregroundColor === "string" ? foregroundColor : "#fff";
  const primary = typeof primaryColor === "string" ? primaryColor : "#8b5cf6";

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
            <Text className="text-foreground text-lg font-bold">Sort By</Text>
            <Pressable
              onPress={onToggleOrder}
              className="flex-row items-center gap-1 px-3 py-1.5 bg-background rounded-full"
            >
              <Ionicons
                name={sortAscending ? "arrow-up" : "arrow-down"}
                size={16}
                color={foreground}
              />
              <Text className="text-foreground text-sm">
                {sortAscending ? "Ascending" : "Descending"}
              </Text>
            </Pressable>
          </View>

          {/* Options */}
          <View className="pb-6">
            {SORT_OPTIONS.map((option) => {
              const isSelected = currentSort === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                  className="flex-row items-center px-4 py-4 active:bg-background/50"
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{
                      backgroundColor: isSelected
                        ? `${primary}20`
                        : "#6b728020",
                    }}
                  >
                    <Ionicons
                      name={option.icon}
                      size={22}
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
                    <Ionicons name="checkmark" size={22} color={primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
