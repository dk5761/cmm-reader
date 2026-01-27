import { useState, useEffect, useRef } from "react";
import { View, Pressable, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { useSyncLibrary } from "../hooks";
import { useLibraryStore } from "../stores/useLibraryStore";
import { FilterSheet } from "./FilterSheet";

export function LibraryHeaderRight() {
  const foregroundColor = useCSSVariable("--color-foreground");
  const primaryColor = useCSSVariable("--color-primary");
  const color = typeof foregroundColor === "string" ? foregroundColor : "#fff";
  const primary = typeof primaryColor === "string" ? primaryColor : "#8b5cf6";

  const { syncLibrary, isSyncing } = useSyncLibrary();
  const { activeCategory, activeSource } = useLibraryStore();

  const syncDisabled = isSyncing;

  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  // Check if any filters are active (not default)
  const hasActiveFilters = activeCategory !== "All" || activeSource !== "all";

  // Rotation animation for sync icon (source sync - checking for new chapters)
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSyncing) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [isSyncing, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handleSync = () => {
    if (!syncDisabled) {
      syncLibrary();
    }
  };

  return (
    <>
      <View className="flex-row gap-1 mr-2">
        {/* Filter button */}
        <Pressable
          onPress={() => setFilterSheetVisible(true)}
          hitSlop={8}
          className="p-2 relative"
        >
          <Ionicons name="options-outline" size={22} color={color} />
          {/* Active filter indicator */}
          {hasActiveFilters && (
            <View
              className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-background"
              style={{ backgroundColor: primary }}
            />
          )}
        </Pressable>

        {/* Sync button */}
        <Pressable
          onPress={handleSync}
          disabled={syncDisabled}
          hitSlop={8}
          className="p-2 relative"
          style={{ opacity: syncDisabled ? 0.7 : 1 }}
        >
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="sync-outline" size={22} color={color} />
          </Animated.View>

          {/* Sync active badge */}
          {isSyncing && (
            <View className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full border-2 border-background" />
          )}
        </Pressable>
      </View>

      {/* Filter Sheet */}
      <FilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        disabled={syncDisabled}
      />
    </>
  );
}
