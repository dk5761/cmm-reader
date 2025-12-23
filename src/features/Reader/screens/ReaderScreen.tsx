import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { WebtoonReader, WebtoonReaderHandle } from "../components";
import { useChapterPages } from "../api/reader.queries";
import { getSource } from "@/sources";
import { useChapterList } from "../../Manga/api/manga.queries";

export function ReaderScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { chapterId, sourceId, url, mangaUrl } = useLocalSearchParams<{
    chapterId: string;
    sourceId: string;
    url: string;
    mangaUrl: string;
  }>();

  const source = getSource(sourceId || "");
  const {
    data: pages,
    isLoading,
    error,
  } = useChapterPages(sourceId || "", url || "");

  // Fetch chapter list for prev/next navigation
  const { data: chapters } = useChapterList(sourceId || "", mangaUrl || "");

  const [currentPage, setCurrentPage] = useState(1);
  const controlsVisible = useSharedValue(1);
  const scrollY = useSharedValue(0);
  const scrollViewRef = useRef<WebtoonReaderHandle>(null);

  // Find current chapter index and determine prev/next
  const currentChapterIndex = chapters?.findIndex((ch) => ch.url === url) ?? -1;
  const hasPrevChapter = currentChapterIndex < (chapters?.length ?? 0) - 1;
  const hasNextChapter = currentChapterIndex > 0;

  const goToPrevChapter = useCallback(() => {
    if (!chapters || !hasPrevChapter) return;
    const prevChapter = chapters[currentChapterIndex + 1];
    router.replace({
      pathname: "/reader/[chapterId]",
      params: {
        chapterId: prevChapter.id,
        sourceId,
        url: prevChapter.url,
        mangaUrl,
      },
    });
  }, [
    chapters,
    currentChapterIndex,
    hasPrevChapter,
    router,
    sourceId,
    mangaUrl,
  ]);

  const goToNextChapter = useCallback(() => {
    if (!chapters || !hasNextChapter) return;
    const nextChapter = chapters[currentChapterIndex - 1];
    router.replace({
      pathname: "/reader/[chapterId]",
      params: {
        chapterId: nextChapter.id,
        sourceId,
        url: nextChapter.url,
        mangaUrl,
      },
    });
  }, [
    chapters,
    currentChapterIndex,
    hasNextChapter,
    router,
    sourceId,
    mangaUrl,
  ]);

  const scrollToPage = useCallback((page: number) => {
    // Use index-based scrolling (like Tachiyomi's RecyclerView.scrollToPosition)
    const targetIndex = page - 1; // Convert 1-based page to 0-based index
    scrollViewRef.current?.scrollToIndex(targetIndex, true);
  }, []);

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
        ref={scrollViewRef}
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
        <View className="px-4">
          {/* Page indicator */}
          <Text className="text-white text-sm font-medium text-center mb-2">
            {currentPage} / {pages.length}
          </Text>

          {/* Page Slider with Chapter Navigation */}
          <View className="flex-row items-center">
            {/* Previous Chapter Arrow */}
            <Pressable
              onPress={goToPrevChapter}
              disabled={!hasPrevChapter}
              className="p-2"
              style={{ opacity: hasPrevChapter ? 1 : 0.3 }}
            >
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </Pressable>

            <Text className="text-zinc-400 text-xs w-6 text-center">1</Text>
            <View className="flex-1 mx-1">
              <Slider
                style={{ width: "100%", height: 40 }}
                minimumValue={1}
                maximumValue={pages.length}
                step={1}
                value={currentPage}
                onValueChange={(value: number) => {
                  // Update displayed page number during drag
                  setCurrentPage(Math.round(value));
                }}
                onSlidingComplete={(value: number) => {
                  // Scroll to selected page when user releases slider
                  const targetPage = Math.round(value);
                  scrollToPage(targetPage);
                }}
                minimumTrackTintColor="#00d9ff"
                maximumTrackTintColor="#3f3f46"
                thumbTintColor="#00d9ff"
              />
            </View>
            <Text className="text-zinc-400 text-xs w-6 text-center">
              {pages.length}
            </Text>

            {/* Next Chapter Arrow */}
            <Pressable
              onPress={goToNextChapter}
              disabled={!hasNextChapter}
              className="p-2"
              style={{ opacity: hasNextChapter ? 1 : 0.3 }}
            >
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
