import { useEffect, useRef } from "react";
import { View, Pressable, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";
import { useSyncLibrary } from "../hooks";
import { useSyncStore } from "../stores/useSyncStore";

export function LibraryHeaderRight() {
  const foregroundColor = useCSSVariable("--color-foreground");
  const color = typeof foregroundColor === "string" ? foregroundColor : "#fff";

  const { syncLibrary, isSyncing } = useSyncLibrary();
  const { progress } = useSyncStore();

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
    if (!isSyncing) {
      syncLibrary();
    }
  };

  return (
    <View className="flex-row gap-2 mr-2">
      <Pressable
        onPress={handleSync}
        disabled={isSyncing}
        hitSlop={8}
        className="p-2"
        style={{ opacity: isSyncing ? 0.7 : 1 }}
      >
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Ionicons name="sync-outline" size={22} color={color} />
        </Animated.View>
      </Pressable>
    </View>
  );
}
