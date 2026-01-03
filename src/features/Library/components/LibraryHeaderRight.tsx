import { useState, useEffect, useRef } from "react";
import { View, Pressable, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { useSyncLibrary } from "../hooks";
import { useSyncStore } from "../stores/useSyncStore";
import { useLibraryStore } from "../stores/useLibraryStore";
import { SortSheet } from "./SortSheet";

export function LibraryHeaderRight() {
  const foregroundColor = useCSSVariable("--color-foreground");
  const color = typeof foregroundColor === "string" ? foregroundColor : "#fff";

  const { syncLibrary, isSyncing } = useSyncLibrary();
  const { progress, isCloudSyncing } = useSyncStore();
  const { sortBy, sortAscending, setSortBy, toggleSortOrder } =
    useLibraryStore();

  // Disable sync button during both library update sync and cloud sync
  const syncDisabled = isSyncing || isCloudSyncing;

  const [sortSheetVisible, setSortSheetVisible] = useState(false);

  // Rotation animation for sync icon
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSyncing) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
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
      <View className="flex-row gap-2 mr-2">
        {/* Sort button */}
        <Pressable
          onPress={() => setSortSheetVisible(true)}
          hitSlop={8}
          className="p-2"
        >
          <Ionicons name="swap-vertical-outline" size={22} color={color} />
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

      {/* Sort Sheet */}
      <SortSheet
        visible={sortSheetVisible}
        currentSort={sortBy}
        sortAscending={sortAscending}
        onSelect={setSortBy}
        onToggleOrder={toggleSortOrder}
        onClose={() => setSortSheetVisible(false)}
      />
    </>
  );
}
