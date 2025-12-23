import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { WebtoonReader } from "../components";
import { useChapterPages } from "../api/reader.queries";
import { getSource } from "@/sources";

export function ReaderScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { chapterId, sourceId, url } = useLocalSearchParams<{
    chapterId: string;
    sourceId: string;
    url: string;
  }>();

  const source = getSource(sourceId || "");
  const {
    data: pages,
    isLoading,
    error,
  } = useChapterPages(sourceId || "", url || "");

  const [currentPage, setCurrentPage] = useState(1);
  const controlsVisible = useSharedValue(1);
  const scrollY = useSharedValue(0);

  const toggleControls = useCallback(() => {
    controlsVisible.value = withTiming(controlsVisible.value === 1 ? 0 : 1, {
      duration: 200,
    });
  }, [controlsVisible]);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: controlsVisible.value,
    transform: [
      { translateY: interpolate(controlsVisible.value, [0, 1], [-50, 0]) },
    ],
  }));

  const footerStyle = useAnimatedStyle(() => ({
    opacity: controlsVisible.value,
    transform: [
      { translateY: interpolate(controlsVisible.value, [0, 1], [50, 0]) },
    ],
  }));

  // Loading state
  if (isLoading) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#fff" />
        <Text className="text-zinc-400 mt-4">Loading chapter...</Text>
      </View>
    );
  }

  // Error state
  if (error || !pages || pages.length === 0) {
    return (
      <View className="flex-1 bg-black items-center justify-center p-6">
        <Text className="text-red-500 text-lg font-bold">
          Failed to load pages
        </Text>
        <Text className="text-zinc-400 text-center mt-2">
          {(error as Error)?.message || "No pages found"}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-6 bg-zinc-800 px-6 py-3 rounded-lg"
        >
          <Text className="text-white">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <StatusBar hidden />

      {/* WebtoonReader Component */}
      <WebtoonReader
        pages={pages}
        baseUrl={source?.baseUrl}
        onPageChange={setCurrentPage}
        onTap={toggleControls}
        scrollY={scrollY}
        paddingBottom={insets.bottom}
      />

      {/* Header Controls */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            paddingTop: insets.top,
          },
          headerStyle,
        ]}
        className="bg-black/70"
        pointerEvents="box-none"
      >
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <View className="flex-1 mx-4">
            <Text
              className="text-white text-sm font-semibold"
              numberOfLines={1}
            >
              Chapter {chapterId}
            </Text>
          </View>
          <Pressable className="p-2 -mr-2">
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </Pressable>
        </View>
      </Animated.View>

      {/* Footer Controls */}
      <Animated.View
        style={[
          {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: insets.bottom + 16,
          },
          footerStyle,
        ]}
        className="bg-black/70"
        pointerEvents="box-none"
      >
        <View className="flex-row items-center justify-between px-6 py-4">
          <Pressable className="p-2">
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>

          <View className="items-center">
            <Text className="text-white text-sm font-medium">
              {currentPage} / {pages.length}
            </Text>
          </View>

          <Pressable className="p-2">
            <Ionicons name="chevron-forward" size={28} color="#fff" />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
